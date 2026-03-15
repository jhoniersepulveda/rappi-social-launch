import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { generateImage } from '@/lib/ai/generateImage'
import { BudgetExceededError } from '@/lib/errors'
import { composeGraphicKit, DIMENSIONS, type Variant } from '@/lib/services/imageComposer'
import { uploadBuffer } from '@/lib/services/storage'
import { generateHash, buildRappiUrl } from '@/lib/services/deeplink'

export const dynamic = 'force-dynamic'

const VARIANTS: Variant[] = ['feed', 'stories', 'whatsapp']

const generateSchema = z.object({
  restaurantId: z.string().min(1),
  productName: z.string().min(1).max(100),
  productImage: z.string().url(),
  promotionText: z.string().min(1).max(80),
})

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

const formatSuffix: Record<Variant, string> = {
  feed:     'Square format 1:1, 1080x1080 pixels.',
  stories:  'Vertical format 9:16, 1080x1920 pixels. Design optimized for vertical mobile screen, keep all important elements centered vertically.',
  whatsapp: 'Vertical format 4:5, 1080x1350 pixels.',
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = generateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { restaurantId, productName, productImage, promotionText } = parsed.data

  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } })
  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  }

  // Create kit record
  const kit = await prisma.graphicKit.create({
    data: { restaurantId, productName, productImage, promotionText, status: 'generating' },
  })

  try {
    const rappiUrl   = buildRappiUrl(restaurant.slug, kit.id)
    const basePrompt = buildPrompt(restaurant.name, productName, promotionText, rappiUrl)
    const hash       = generateHash()

    // Look up product description for prompt emphasis
    type TopProduct = { name: string; description?: string }
    const topProducts = (restaurant.topProducts as TopProduct[] | null) ?? []
    const matched = topProducts.find(p => p.name.toLowerCase() === productName.toLowerCase())
    const productDescription = matched?.description ?? productName

    const imageUris: Record<string, string> = {}

    for (const variant of VARIANTS) {
      const prompt = `${basePrompt}\n\nFormat: ${formatSuffix[variant]}`
      const aiImageUrl = await generateImage(prompt, productName, undefined, productDescription)

      let imageBuffer: Buffer
      if (aiImageUrl.startsWith('data:')) {
        imageBuffer = Buffer.from(aiImageUrl.split(',')[1], 'base64')
      } else {
        const res = await fetch(aiImageUrl, { signal: AbortSignal.timeout(30000) })
        if (!res.ok) throw new Error(`Failed to download AI image: ${res.status}`)
        imageBuffer = Buffer.from(await res.arrayBuffer())
      }

      const { width, height } = DIMENSIONS[variant]
      const composed = await composeGraphicKit(imageBuffer, width, height)
      const key = `kits/${kit.id}/${variant}.png`
      imageUris[variant] = await uploadBuffer(composed, key, 'image/png')
    }

    await prisma.graphicKit.update({
      where: { id: kit.id },
      data: {
        status: 'ready',
        imageUrls: imageUris,
        deepLink: rappiUrl,
        shortHash: hash,
      },
    })

    return NextResponse.json({ kitId: kit.id, imageUrls: imageUris, deepLink: rappiUrl })

  } catch (error) {
    if (error instanceof BudgetExceededError) {
      await prisma.graphicKit.update({ where: { id: kit.id }, data: { status: 'budget_exceeded' } })
      return NextResponse.json(
        { error: 'Presupuesto de IA agotado. Contacta al administrador.' },
        { status: 503 }
      )
    }

    console.error('[generate] Failed:', (error as Error).message)
    await prisma.graphicKit.update({ where: { id: kit.id }, data: { status: 'failed' } })
    return NextResponse.json({ error: 'La generación falló. Inténtalo nuevamente.' }, { status: 500 })
  }
}
