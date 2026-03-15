import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const kits = await prisma.graphicKit.findMany({
    take:     50,
    orderBy:  { createdAt: 'desc' },
    include:  { restaurant: { select: { name: true } } },
  })
  return NextResponse.json(kits)
}
