import { Storage } from '@google-cloud/storage'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import axios from 'axios'
import fs from 'fs'
import path from 'path'

const GCS_BUCKET = 'rappi-social-launch-images'
const S3_BUCKET  = process.env.S3_BUCKET || 'rappi-social-launch'

// ── Google Cloud Storage (production — Firebase App Hosting) ──────────────────
function isGCSConfigured(): boolean {
  return !!process.env.GOOGLE_CLOUD_PROJECT
}

function getGCSClient(): Storage {
  return new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT })
}

async function uploadBufferGCS(buffer: Buffer, key: string, contentType: string): Promise<string> {
  const storage = getGCSClient()
  const file    = storage.bucket(GCS_BUCKET).file(key)
  await file.save(buffer, {
    contentType,
    metadata: { cacheControl: 'public, max-age=31536000' },
  })
  // Make the file publicly readable (requires Fine-Grained ACL on bucket)
  try { await file.makePublic() } catch { /* bucket may use Uniform Access — public via bucket policy */ }
  return `https://storage.googleapis.com/${GCS_BUCKET}/${key}`
}

// ── S3 / Cloudflare R2 (optional fallback) ────────────────────────────────────
function isS3Configured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_ACCESS_KEY_ID !== 'xxx' &&
    process.env.AWS_SECRET_ACCESS_KEY !== 'xxx'
  )
}

function getS3Client(): S3Client {
  const config: ConstructorParameters<typeof S3Client>[0] = {
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  }
  if (process.env.STORAGE_ENDPOINT) {
    config.endpoint      = process.env.STORAGE_ENDPOINT
    config.forcePathStyle = true
  }
  return new S3Client(config)
}

// ── Local filesystem (dev mode) ───────────────────────────────────────────────
async function uploadBufferLocal(buffer: Buffer, key: string): Promise<string> {
  const filePath = path.join(process.cwd(), 'public', 'uploads', key)
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
  await fs.promises.writeFile(filePath, buffer)
  return `/uploads/${key}`
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function uploadBuffer(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const normalizedKey = key.replace(/\\/g, '/')

  if (isGCSConfigured()) {
    return uploadBufferGCS(buffer, normalizedKey, contentType)
  }

  if (isS3Configured()) {
    const s3 = getS3Client()
    await s3.send(new PutObjectCommand({
      Bucket:      S3_BUCKET,
      Key:         normalizedKey,
      Body:        buffer,
      ContentType: contentType,
    }))
    return `s3://${S3_BUCKET}/${normalizedKey}`
  }

  return uploadBufferLocal(buffer, normalizedKey)
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const normalizedKey = key.replace(/\\/g, '/')

  // Local path
  if (normalizedKey.startsWith('/uploads/')) return normalizedKey

  // GCS — bucket is public, return direct URL (no signing needed)
  if (isGCSConfigured()) {
    return `https://storage.googleapis.com/${GCS_BUCKET}/${normalizedKey}`
  }

  if (!isS3Configured()) {
    return `/uploads/${normalizedKey}`
  }

  const s3 = getS3Client()
  return getSignedUrl(s3, new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key:    normalizedKey,
  }), { expiresIn })
}

export async function uploadFromUrl(url: string, key: string): Promise<string> {
  const response    = await axios.get<Buffer>(url, { responseType: 'arraybuffer' })
  const buffer      = Buffer.from(response.data)
  const contentType = response.headers['content-type'] || 'image/png'
  return uploadBuffer(buffer, key, contentType)
}

export function extractKeyFromUri(uri: string): string {
  // https://storage.googleapis.com/bucket/key → key
  const gcsMatch = uri.match(/^https:\/\/storage\.googleapis\.com\/[^/]+\/(.+)$/)
  if (gcsMatch) return gcsMatch[1]

  // s3://bucket/key → key
  const s3Match = uri.match(/^s3:\/\/[^/]+\/(.+)$/)
  if (s3Match) return s3Match[1]

  return uri
}
