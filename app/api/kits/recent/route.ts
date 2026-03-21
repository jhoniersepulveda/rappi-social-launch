import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const restaurantId = searchParams.get('restaurantId')

  const kits = await prisma.graphicKit.findMany({
    take:     50,
    orderBy:  { createdAt: 'desc' },
    where:    restaurantId ? { restaurantId } : undefined,
    include:  { restaurant: { select: { name: true } } },
  })
  return NextResponse.json(kits)
}
