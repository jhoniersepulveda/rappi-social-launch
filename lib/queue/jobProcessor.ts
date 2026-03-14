import type { Job } from 'bullmq'
import type { GenerationJobData } from './generationQueue'
import { prisma } from '@/lib/prisma'
import { generateProductImage } from '@/lib/ai/generateImage'
import { composeGraphicKit, type Variant } from '@/lib/services/imageComposer'
import { uploadBuffer } from '@/lib/services/storage'
import { generateHash, buildRappiUrl, buildShortUrl, generateQRBuffer } from '@/lib/services/deeplink'
import { sendKitReadyEmail } from '@/lib/services/email'

const VARIANTS: Variant[] = ['feed', 'stories', 'whatsapp']

export async function processGenerationJob(job: Job<GenerationJobData>): Promise<void> {
  const { kitId, restaurantId, productName, promotionText } = job.data

  console.log(`[Job ${job.id}] Starting generation for kit ${kitId}`)

  // 1. Mark as generating
  await prisma.graphicKit.update({
    where: { id: kitId },
    data: { status: 'generating' },
  })

  try {
    // 2. Get restaurant details
    const restaurant = await prisma.restaurant.findUniqueOrThrow({
      where: { id: restaurantId },
    })

    // 3. Generate AI product image
    console.log(`[Job ${job.id}] Generating AI image for "${productName}" (${restaurant.category})`)
    const aiImageUrl = await generateProductImage(productName, restaurant.category)

    // 4. Generate deep link + QR
    const hash = generateHash()
    const rappiUrl = buildRappiUrl(restaurant.slug, kitId)
    const shortUrl = buildShortUrl(hash)
    console.log(`[Job ${job.id}] Short URL: ${shortUrl}`)

    const qrBuffer = await generateQRBuffer(shortUrl)

    // 5. Compose 3 variants
    const imageUris: Record<string, string> = {}

    for (const variant of VARIANTS) {
      console.log(`[Job ${job.id}] Composing ${variant} variant`)
      const composed = await composeGraphicKit({
        aiImageUrl,
        restaurantName: restaurant.name,
        restaurantLogoUrl: restaurant.logoUrl,
        promotionText,
        qrBuffer,
        variant,
      })

      const key = `kits/${kitId}/${variant}.png`
      imageUris[variant] = await uploadBuffer(composed, key, 'image/png')
      console.log(`[Job ${job.id}] Uploaded ${variant}: ${imageUris[variant]}`)
    }

    // 6. Save to DB
    await prisma.graphicKit.update({
      where: { id: kitId },
      data: {
        status: 'ready',
        imageUrls: imageUris,
        deepLink: rappiUrl,
        shortHash: hash,
      },
    })

    console.log(`[Job ${job.id}] Kit ${kitId} ready`)

    // 7. Send notification email (non-blocking)
    sendKitReadyEmail(
      { name: restaurant.name, email: restaurant.email },
      kitId
    ).catch((err) => console.warn(`[Job ${job.id}] Email failed:`, err))
  } catch (error) {
    console.error(`[Job ${job.id}] Failed:`, error)
    await prisma.graphicKit.update({
      where: { id: kitId },
      data: { status: 'failed' },
    })
    throw error // BullMQ will retry
  }
}
