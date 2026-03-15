import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
import { generationQueue } from '@/lib/queue/generationQueue'

const generateSchema = z.object({
  restaurantId: z.string().min(1),
  productName: z.string().min(1).max(100),
  productImage: z.string().url(),
  promotionText: z.string().min(1).max(80),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = generateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { restaurantId, productName, productImage, promotionText } = parsed.data

  // Verify restaurant exists
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } })
  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  }

  // Create kit record immediately (pending)
  const kit = await prisma.graphicKit.create({
    data: {
      restaurantId,
      productName,
      productImage,
      promotionText,
      status: 'pending',
    },
  })

  // Enqueue async generation job
  const job = await generationQueue.add('generate', {
    kitId: kit.id,
    restaurantId,
    productName,
    productImage,
    promotionText,
  })

  // Store jobId reference
  await prisma.graphicKit.update({
    where: { id: kit.id },
    data: { jobId: job.id },
  })

  return NextResponse.json({ kitId: kit.id, jobId: job.id }, { status: 202 })
}
