import sharp from 'sharp'

export type Variant = 'feed' | 'stories' | 'whatsapp'

export const DIMENSIONS: Record<Variant, { width: number; height: number }> = {
  feed:     { width: 1080, height: 1080 },
  stories:  { width: 1080, height: 1920 },
  whatsapp: { width: 1080, height: 1350 },
}

export async function composeGraphicKit(imageBuffer: Buffer, width: number, height: number) {
  return await sharp(imageBuffer)
    .resize(width, height, { fit: 'fill' })
    .toBuffer()
}
