import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generationQueue } from '@/lib/queue/generationQueue'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const kit = await prisma.graphicKit.findUnique({
    where: { id: params.id },
  })

  if (!kit) {
    return NextResponse.json({ error: 'Kit not found' }, { status: 404 })
  }

  if (!['budget_exceeded', 'failed'].includes(kit.status)) {
    return NextResponse.json(
      { error: `Cannot retry a kit with status "${kit.status}"` },
      { status: 400 }
    )
  }

  // Reset kit to pending
  await prisma.graphicKit.update({
    where: { id: kit.id },
    data: { status: 'pending', imageUrls: undefined, jobId: null },
  })

  // Re-enqueue generation job
  const job = await generationQueue.add('generate', {
    kitId:        kit.id,
    restaurantId: kit.restaurantId,
    productName:  kit.productName,
    productImage: kit.productImage,
    promotionText: kit.promotionText,
  })

  await prisma.graphicKit.update({
    where: { id: kit.id },
    data: { jobId: job.id },
  })

  return NextResponse.json({ kitId: kit.id, jobId: job.id }, { status: 202 })
}
