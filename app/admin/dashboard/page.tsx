import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import KAMDashboard from '@/components/KAMDashboard'

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session || (session.user as { role?: string })?.role !== 'admin') {
    redirect('/admin/login')
  }

  const restaurants = await prisma.restaurant.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { kits: true } },
      incentives: {
        where: { expiresAt: { gt: new Date() } },
        orderBy: { activatedAt: 'desc' },
        take: 1,
      },
    },
  })

  // Get verification counts per restaurant
  const verificationCounts = await prisma.verification.groupBy({
    by: ['kitId'],
    where: { status: 'approved' },
    _count: true,
  })

  // Map kitId → restaurantId
  const kitRestaurantMap = await prisma.graphicKit.findMany({
    where: {
      id: { in: verificationCounts.map((v: { kitId: string }) => v.kitId) },
    },
    select: { id: true, restaurantId: true },
  })

  const restaurantVerificationCount: Record<string, number> = {}
  for (const v of verificationCounts) {
    const kit = kitRestaurantMap.find((k: { id: string; restaurantId: string }) => k.id === v.kitId)
    if (kit) {
      restaurantVerificationCount[kit.restaurantId] =
        (restaurantVerificationCount[kit.restaurantId] || 0) + (v._count as unknown as number)
    }
  }

  const enrichedRestaurants = restaurants.map((r: typeof restaurants[0]) => ({
    ...r,
    verificationCount: restaurantVerificationCount[r.id] || 0,
    ordersLast28Days: 0, // Manual field — populated by KAM
    createdAt: r.createdAt.toISOString(),
    boostedUntil: r.boostedUntil?.toISOString() || null,
    incentives: r.incentives.map((i: typeof restaurants[0]['incentives'][0]) => ({
      ...i,
      expiresAt: i.expiresAt.toISOString(),
      activatedAt: i.activatedAt.toISOString(),
    })),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard KAM</h1>
          <p className="text-gray-500 text-sm mt-1">
            {restaurants.length} restaurante{restaurants.length !== 1 ? 's' : ''} registrado{restaurants.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-rappi-orange text-white px-4 py-2 rounded-xl">
          <span className="text-sm font-semibold">👤 {session.user?.name}</span>
        </div>
      </div>

      <KAMDashboard restaurants={enrichedRestaurants as Parameters<typeof KAMDashboard>[0]['restaurants']} />
    </div>
  )
}
