import { customAlphabet } from 'nanoid'
import QRCode from 'qrcode'

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6)

export function generateHash(): string {
  return nanoid()
}

export function buildShortUrl(hash: string): string {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  return `${base}/r/${hash}`
}

export function buildRappiUrl(
  slug: string,
  kitId: string,
  channel = 'social_launch'
): string {
  const base = `https://www.rappi.com/restaurantes/${slug}`
  const params = new URLSearchParams({
    utm_source: 'social_launch',
    utm_medium: channel,
    utm_campaign: kitId,
  })
  return `${base}?${params.toString()}`
}

export async function generateQRBuffer(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: 'png',
    width: 200,
    margin: 1,
    color: {
      dark: '#1A1A1A',
      light: '#FFFFFF',
    },
  })
}
