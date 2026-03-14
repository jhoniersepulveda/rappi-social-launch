import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import axios from 'axios'

function getS3Client(): S3Client {
  const config: ConstructorParameters<typeof S3Client>[0] = {
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  }
  // Support Cloudflare R2 (S3-compatible)
  if (process.env.STORAGE_ENDPOINT) {
    config.endpoint = process.env.STORAGE_ENDPOINT
    config.forcePathStyle = true
  }
  return new S3Client(config)
}

const BUCKET = process.env.S3_BUCKET || 'rappi-social-launch'

export async function uploadBuffer(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const s3 = getS3Client()
  // Normalize path separators for S3
  const normalizedKey = key.replace(/\\/g, '/')

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: normalizedKey,
      Body: buffer,
      ContentType: contentType,
    })
  )

  return `s3://${BUCKET}/${normalizedKey}`
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const s3 = getS3Client()
  const normalizedKey = key.replace(/\\/g, '/')

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: normalizedKey,
  })

  return getSignedUrl(s3, command, { expiresIn })
}

export async function uploadFromUrl(url: string, key: string): Promise<string> {
  const response = await axios.get<Buffer>(url, { responseType: 'arraybuffer' })
  const buffer = Buffer.from(response.data)
  const contentType = response.headers['content-type'] || 'image/png'
  return uploadBuffer(buffer, key, contentType)
}

export function extractKeyFromUri(s3Uri: string): string {
  // Convert s3://bucket/key → key
  const match = s3Uri.match(/^s3:\/\/[^/]+\/(.+)$/)
  if (match) return match[1]
  return s3Uri
}
