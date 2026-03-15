import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const kits = await prisma.graphicKit.findMany({
    where:   { restaurantId: params.id },
    orderBy: { createdAt: 'desc' },
    take:    20,
  })
  return NextResponse.json(kits)
}
