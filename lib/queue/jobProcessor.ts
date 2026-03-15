import type { Job } from 'bullmq'
import type { GenerationJobData } from './generationQueue'
import { query } from '@/lib/db'
import { generateImage } from '@/lib/ai/generateImage'
import { BudgetExceededError } from '@/lib/errors'
import { composeGraphicKit, DIMENSIONS, type Variant } from '@/lib/services/imageComposer'
import { uploadBuffer } from '@/lib/services/storage'
import { generateHash, buildRappiUrl } from '@/lib/services/deeplink'

const VARIANTS: Variant[] = ['feed', 'stories', 'whatsapp']

function buildPrompt(
  restaurantName: string,
  productName: string,
  promotionText: string,
  rappiUrl: string
): string {
  return (
    `You are an award-winning art director for a top Latin American advertising agency.\n` +
    `Create a stunning social media advertisement for ${restaurantName} on Rappi Colombia.\n` +
    `Product: ${productName}. Promotion: ${promotionText}.\n\n` +
    `Brand rules (the ONLY constraints):\n` +
    `- Rappi orange #FF441B must be present\n` +
    `- Restaurant name "${restaurantName}" must appear in the design\n` +
    `- Include a clear call to action with the text "Pide en Rappi" — this CTA links to ${rappiUrl}\n\n` +
    `Everything else is YOUR creative decision.\n` +
    `Make it so good people stop scrolling and order immediately.\n` +
    `Square format, no watermarks.\n\n` +
    `IMPORTANT - Rappi branding must be included in the design:\n` +
    `- The word "Rappi" in the brand's signature orange color #FF441B\n` +
    `- The iconic Rappi mustache/bigote symbol (two curved lines forming a smile shape) as part of the Rappi logo\n` +
    `- These elements must look professional and integrated into the design, NOT placed in a circle badge in a corner\n` +
    `- Place the Rappi branding wherever makes the most design sense`
  )
}

export async function processGenerationJob(job: Job<GenerationJobData>): Promise<void> {
  const { kitId, restaurantId, productName, promotionText } = job.data

  console.log(`[Job ${job.id}] Starting generation for kit ${kitId}`)

  try {
    await query('UPDATE "GraphicKit" SET status = $1 WHERE id = $2', ['generating', kitId])
    console.log(`[Job ${job.id}] DB update OK`)
  } catch (e) {
    console.error(`[Job ${job.id}] DB update failed:`, (e as Error).message)
    throw e
  }

  try {
    const { rows } = await query('SELECT * FROM "Restaurant" WHERE id = $1', [restaurantId])
    if (!rows.length) throw new Error(`Restaurant ${restaurantId} not found`)
    const restaurant = rows[0]

    const storeUrl   = (restaurant.rappiUrl as string | null) ?? buildRappiUrl(restaurant.slug as string, kitId)
    const basePrompt = buildPrompt(restaurant.name as string, productName, promotionText, storeUrl)

    // Look up product description from topProducts for the prompt emphasis
    type TopProduct = { name: string; description?: string }
    const topProducts = (restaurant.topProducts as TopProduct[] | null) ?? []
    const matchedProduct = topProducts.find(
      p => p.name.toLowerCase() === productName.toLowerCase()
    )
    const productDescription = matchedProduct?.description ?? productName

    const hash     = generateHash()
    const rappiUrl = buildRappiUrl(restaurant.slug as string, kitId)
    console.log(`[Job ${job.id}] Store URL: ${storeUrl}`)
    console.log(`[Job ${job.id}] Deep link: ${rappiUrl}`)

    const formatSuffix: Record<Variant, string> = {
      feed:     'Square format 1:1, 1080x1080 pixels.',
      stories:  'Vertical format 9:16, 1080x1920 pixels. Design optimized for vertical mobile screen, keep all important elements centered vertically.',
      whatsapp: 'Vertical format 4:5, 1080x1350 pixels.',
    }

    const { default: axios } = await import('axios')
    const imageUris: Record<string, string> = {}

    for (const variant of VARIANTS) {
      const prompt = `${basePrompt}\n\nFormat: ${formatSuffix[variant]}`
      console.log(`[Job ${job.id}] Generating ${variant} image...`)
      const aiImageUrl = await generateImage(prompt, productName, undefined, productDescription)

      let imageBuffer: Buffer
      if (aiImageUrl.startsWith('data:')) {
        imageBuffer = Buffer.from(aiImageUrl.split(',')[1], 'base64')
      } else {
        const res = await axios.get<Buffer>(aiImageUrl, { responseType: 'arraybuffer', timeout: 30000 })
        imageBuffer = Buffer.from(res.data)
      }

      const { width, height } = DIMENSIONS[variant]
      const composed = await composeGraphicKit(imageBuffer, width, height)
      const key = `kits/${kitId}/${variant}.png`
      imageUris[variant] = await uploadBuffer(composed, key, 'image/png')
      console.log(`[Job ${job.id}] Uploaded ${variant}: ${imageUris[variant]}`)
    }

    await query(
      'UPDATE "GraphicKit" SET status = $1, "imageUrls" = $2, "deepLink" = $3, "shortHash" = $4 WHERE id = $5',
      ['ready', JSON.stringify(imageUris), rappiUrl, hash, kitId]
    )

    console.log(`[Job ${job.id}] Kit ${kitId} ready ✓`)
  } catch (error) {
    // Budget exceeded — mark kit, do NOT rethrow (BullMQ must not retry this)
    if (error instanceof BudgetExceededError) {
      console.warn(`[Job ${job.id}] Presupuesto de IA agotado — kit ${kitId} marcado como budget_exceeded`)
      await query('UPDATE "GraphicKit" SET status = $1 WHERE id = $2', ['budget_exceeded', kitId])
      return
    }

    console.error(`[Job ${job.id}] Failed:`, (error as Error).message)
    await query('UPDATE "GraphicKit" SET status = $1 WHERE id = $2', ['failed', kitId])
    throw error
  }
}
