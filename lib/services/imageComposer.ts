import sharp from 'sharp'
import axios from 'axios'

export type Variant = 'feed' | 'stories' | 'whatsapp'

export interface CompositionOptions {
  aiImageUrl: string
  restaurantName: string
  restaurantLogoUrl: string
  promotionText: string
  qrBuffer: Buffer
  variant: Variant
}

const DIMENSIONS: Record<Variant, { width: number; height: number }> = {
  feed: { width: 1080, height: 1080 },
  stories: { width: 1080, height: 1920 },
  whatsapp: { width: 1080, height: 1350 },
}

const TOP_STRIP_HEIGHT = 80
const BOTTOM_STRIP_HEIGHT = 100
const LOGO_SIZE = 90

async function fetchBuffer(url: string): Promise<Buffer> {
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1]
    return Buffer.from(base64, 'base64')
  }
  const response = await axios.get<Buffer>(url, { responseType: 'arraybuffer' })
  return Buffer.from(response.data)
}

async function makeCircularLogo(logoBuffer: Buffer, size: number): Promise<Buffer> {
  const resized = await sharp(logoBuffer)
    .resize(size, size, { fit: 'cover' })
    .png()
    .toBuffer()

  // Create circular mask
  const circleMask = Buffer.from(
    `<svg width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
    </svg>`
  )

  // White circle background
  const whiteBg = await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .png()
    .toBuffer()

  // Composite logo over white bg with circle mask
  return sharp(whiteBg)
    .composite([
      {
        input: await sharp(resized)
          .composite([{ input: circleMask, blend: 'dest-in' }])
          .png()
          .toBuffer(),
        blend: 'over',
      },
    ])
    .png()
    .toBuffer()
}

function buildTopStripSvg(width: number, height: number): Buffer {
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#FF441B"/>
    <!-- Rappi wordmark (left) -->
    <text x="20" y="${height / 2 + 8}" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" dominant-baseline="middle">rappi</text>
    <!-- "Pide en Rappi" (right) -->
    <text x="${width - 20}" y="${height / 2 + 6}" font-family="Arial, sans-serif" font-size="18" font-weight="600" fill="white" text-anchor="end" dominant-baseline="middle">Pide en Rappi</text>
  </svg>`
  return Buffer.from(svg)
}

function buildBottomStripSvg(
  width: number,
  height: number,
  restaurantName: string,
  promotionText: string
): Buffer {
  const maxTextWidth = width - 220 // Leave space for QR
  const truncatedPromo = promotionText.length > 50
    ? promotionText.substring(0, 47) + '...'
    : promotionText

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="rgba(26,26,26,0.85)" rx="0"/>
    <!-- Slight gradient for depth -->
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:rgba(26,26,26,0.9);stop-opacity:1" />
        <stop offset="100%" style="stop-color:rgba(26,26,26,0.7);stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="${maxTextWidth}" height="${height}" fill="url(#grad)"/>
    <!-- Restaurant name -->
    <text x="20" y="36" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="white">${escapeXml(restaurantName)}</text>
    <!-- Promotion text -->
    <text x="20" y="68" font-family="Arial, sans-serif" font-size="18" font-weight="600" fill="#FF441B">${escapeXml(truncatedPromo)}</text>
  </svg>`
  return Buffer.from(svg)
}

function buildQRChipSvg(qrSize: number): Buffer {
  const chipSize = qrSize + 24
  const svg = `<svg width="${chipSize}" height="${chipSize}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${chipSize}" height="${chipSize}" rx="8" fill="white" stroke="#FF441B" stroke-width="3"/>
  </svg>`
  return Buffer.from(svg)
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function composeGraphicKit(options: CompositionOptions): Promise<Buffer> {
  const { aiImageUrl, restaurantName, restaurantLogoUrl, promotionText, qrBuffer, variant } =
    options
  const { width, height } = DIMENSIONS[variant]

  // Fetch external images
  const [aiImageBuf, logoBuf] = await Promise.all([
    fetchBuffer(aiImageUrl),
    fetchBuffer(restaurantLogoUrl),
  ])

  // Central content area (between strips)
  const contentTop = TOP_STRIP_HEIGHT
  const contentBottom = height - BOTTOM_STRIP_HEIGHT
  const contentHeight = contentBottom - contentTop
  const contentWidth = width

  // Product image: fill 75% of content height, centered
  const productHeight = Math.round(contentHeight * 0.85)
  const productWidth = contentWidth

  const productImage = await sharp(aiImageBuf)
    .resize(productWidth, productHeight, { fit: 'cover', position: 'center' })
    .png()
    .toBuffer()

  // Circular restaurant logo
  const cirularLogo = await makeCircularLogo(logoBuf, LOGO_SIZE)

  // SVG overlays
  const topStripSvg = buildTopStripSvg(width, TOP_STRIP_HEIGHT)
  const bottomStripSvg = buildBottomStripSvg(width, BOTTOM_STRIP_HEIGHT, restaurantName, promotionText)

  // QR chip
  const QR_SIZE = 90
  const qrResized = await sharp(qrBuffer).resize(QR_SIZE, QR_SIZE).png().toBuffer()
  const qrChipSvg = buildQRChipSvg(QR_SIZE)
  const QR_CHIP_SIZE = QR_SIZE + 24

  // Positions
  const logoX = width - LOGO_SIZE - 12
  const logoY = TOP_STRIP_HEIGHT + 12
  const qrChipX = width - QR_CHIP_SIZE - 12
  const qrChipY = height - BOTTOM_STRIP_HEIGHT - QR_CHIP_SIZE - 12
  const qrX = qrChipX + 12
  const qrY = qrChipY + 12

  // Build canvas: white background
  const canvas = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer()

  // Composite all layers
  const composed = await sharp(canvas)
    .composite([
      // Product image in the center area
      { input: productImage, top: contentTop, left: 0 },
      // Top strip (orange bar + Rappi branding)
      { input: topStripSvg, top: 0, left: 0 },
      // Bottom strip (dark bar + restaurant name + promo)
      { input: bottomStripSvg, top: height - BOTTOM_STRIP_HEIGHT, left: 0 },
      // QR chip background
      { input: qrChipSvg, top: qrChipY, left: qrChipX },
      // QR code inside chip
      { input: qrResized, top: qrY, left: qrX },
      // Restaurant logo (circular, top-right)
      { input: cirularLogo, top: logoY, left: logoX },
    ])
    .png()
    .toBuffer()

  return composed
}
