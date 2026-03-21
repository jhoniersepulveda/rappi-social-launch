import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const batches = await prisma.bulkBatch.findMany({
    orderBy: { createdAt: 'desc' },
    take:    50,
  })
  return NextResponse.json(batches)
}
