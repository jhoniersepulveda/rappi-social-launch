import { prisma } from '@/lib/prisma'

export type IncentiveType = 'boost_visibility' | 'badge_nuevo' | 'discount_commission'

const INCENTIVE_DURATION_DAYS: Record<IncentiveType, number> = {
  boost_visibility: 30,
  badge_nuevo: 90,
  discount_commission: 30,
}

export async function activateIncentive(
  restaurantId: string,
  kitId: string,
  type: IncentiveType
): Promise<{ expiresAt: Date }> {
  const now = new Date()
  const days = INCENTIVE_DURATION_DAYS[type]
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  // Create incentive record
  await prisma.incentive.create({
    data: {
      restaurantId,
      kitId,
      type,
      activatedAt: now,
      expiresAt,
    },
  })

  // For boost_visibility: update restaurant flags
  if (type === 'boost_visibility') {
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        isBoosted: true,
        boostedUntil: expiresAt,
      },
    })
  }

  return { expiresAt }
}

export async function checkMonthlyVerificationLimit(
  restaurantId: string
): Promise<{ count: number; limitReached: boolean }> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const count = await prisma.verification.count({
    where: {
      kit: { restaurantId },
      status: 'approved',
      reviewedAt: { gte: startOfMonth },
    },
  })

  return { count, limitReached: count >= 3 }
}

export async function getActiveIncentive(restaurantId: string) {
  return prisma.incentive.findFirst({
    where: {
      restaurantId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { activatedAt: 'desc' },
    include: { kit: true },
  })
}
