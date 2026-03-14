import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const createRestaurantSchema = z.object({
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers and hyphens'),
  logoUrl: z.string().url(),
  category: z.enum(['Fast food', 'Saludable', 'Cafetería', 'Postres', 'Bebidas']),
  topProducts: z
    .array(
      z.object({
        name: z.string(),
        imageUrl: z.string().url(),
        price: z.number().positive(),
      })
    )
    .min(1)
    .max(10),
  email: z.string().email().optional(),
})

export async function GET() {
  const restaurants = await prisma.restaurant.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { kits: true } },
      incentives: {
        where: { expiresAt: { gt: new Date() } },
        orderBy: { activatedAt: 'desc' },
        take: 1,
      },
    },
  })
  return NextResponse.json(restaurants)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = createRestaurantSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const restaurant = await prisma.restaurant.create({ data: parsed.data })
  return NextResponse.json(restaurant, { status: 201 })
}
