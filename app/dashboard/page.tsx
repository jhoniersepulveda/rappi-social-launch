/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

interface PageProps {
  searchParams: { restaurantId?: string }
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Procesando', color: 'bg-gray-100 text-gray-600' },
  generating: { label: 'Generando', color: 'bg-blue-100 text-blue-600' },
  ready: { label: 'Listo', color: 'bg-green-100 text-green-600' },
  failed: { label: 'Falló', color: 'bg-red-100 text-red-600' },
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const restaurantId = searchParams.restaurantId

  const restaurants = await prisma.restaurant.findMany({ orderBy: { name: 'asc' } })
  const activeRestaurant = restaurantId
    ? restaurants.find((r: { id: string }) => r.id === restaurantId) || restaurants[0]
    : restaurants[0]

  if (!activeRestaurant) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-lg">No hay restaurantes registrados.</p>
        <Link href="/kit/new" className="mt-4 inline-block text-rappi-orange font-semibold hover:underline">
          Crear mi primer kit →
        </Link>
      </div>
    )
  }

  const [kits, activeIncentive] = await Promise.all([
    prisma.graphicKit.findMany({
      where: { restaurantId: activeRestaurant.id },
      orderBy: { createdAt: 'desc' },
      include: { verification: true, incentive: true },
    }),
    prisma.incentive.findFirst({
      where: {
        restaurantId: activeRestaurant.id,
        expiresAt: { gt: new Date() },
      },
      orderBy: { activatedAt: 'desc' },
    }),
  ])

  // Check for unverified kits older than 3 days
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  const unverifiedOldKits = kits.filter(
    (k) => k.status === 'ready' && !k.verification && k.createdAt < threeDaysAgo
  )

  // Countdown timer data
  let daysLeft: number | null = null
  if (activeIncentive) {
    daysLeft = Math.ceil(
      (activeIncentive.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img
            src={activeRestaurant.logoUrl}
            alt={activeRestaurant.name}
            className="w-14 h-14 rounded-full bg-white border-2 border-rappi-orange object-cover"
          />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{activeRestaurant.name}</h1>
            <p className="text-gray-500 text-sm">{activeRestaurant.category}</p>
          </div>
        </div>
        <Link
          href={`/kit/new?restaurantId=${activeRestaurant.id}`}
          className="bg-rappi-orange text-white font-bold px-6 py-3 rounded-xl hover:bg-[#e03a16] transition-colors"
        >
          + Crear nuevo kit
        </Link>
      </div>

      {/* Reminder for unverified kits */}
      {unverifiedOldKits.length > 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-5 flex items-center gap-4">
          <span className="text-3xl">⏰</span>
          <div>
            <p className="font-bold text-yellow-800">
              Tienes {unverifiedOldKits.length} kit{unverifiedOldKits.length > 1 ? 's' : ''} sin verificar
            </p>
            <p className="text-sm text-yellow-600">
              Sube la captura de pantalla de tu publicación para activar tus incentivos en Rappi
            </p>
          </div>
        </div>
      )}

      {/* Active incentive */}
      {activeIncentive && daysLeft !== null && (
        <div className="bg-gradient-to-r from-rappi-orange to-[#FF6B35] text-white rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium uppercase tracking-wide">Incentivo activo</p>
              <p className="text-2xl font-bold mt-1">
                {activeIncentive.type === 'boost_visibility'
                  ? '🚀 Boost de visibilidad'
                  : activeIncentive.type === 'badge_nuevo'
                  ? '🏅 Badge "Nuevo en Rappi"'
                  : '💸 Descuento en comisión'}
              </p>
              <p className="text-orange-100 text-sm mt-2">
                Activo hasta: {activeIncentive.expiresAt.toLocaleDateString('es-CO', { dateStyle: 'long' })}
              </p>
            </div>
            <div className="text-center bg-white/20 rounded-2xl p-4 min-w-20">
              <p className="text-4xl font-bold">{daysLeft}</p>
              <p className="text-orange-100 text-xs">días restantes</p>
            </div>
          </div>
        </div>
      )}

      {/* Kit history */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Historial de kits</h2>

        {kits.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <div className="text-5xl mb-4">🎨</div>
            <p className="text-gray-500 mb-4">Aún no tienes kits generados</p>
            <Link
              href={`/kit/new?restaurantId=${activeRestaurant.id}`}
              className="bg-rappi-orange text-white font-bold px-6 py-3 rounded-xl hover:bg-[#e03a16] transition-colors"
            >
              Crear mi primer kit →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {kits.map((kit) => {
              const status = STATUS_LABELS[kit.status] || STATUS_LABELS.pending
              const verificationStatus = kit.verification?.status
              const urls = kit.imageUrls as Record<string, string> | null

              return (
                <div
                  key={kit.id}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-5"
                >
                  {/* Thumbnail */}
                  {urls?.feed ? (
                    <img
                      src={urls.feed}
                      alt={kit.productName}
                      className="w-20 h-20 rounded-xl object-cover bg-gray-100 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">🎨</span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-gray-800 truncate">{kit.productName}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">&quot;{kit.promotionText}&quot;</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {kit.createdAt.toLocaleDateString('es-CO', { dateStyle: 'medium' })}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {kit.status === 'ready' && (
                      <>
                        <a
                          href={`/api/kits/${kit.id}/download`}
                          download
                          className="text-xs font-semibold text-rappi-orange border border-rappi-orange px-3 py-1.5 rounded-lg hover:bg-orange-50 transition-colors text-center"
                        >
                          Descargar
                        </a>
                        {!verificationStatus && (
                          <Link
                            href={`/kit/new?restaurantId=${activeRestaurant.id}&verifyKitId=${kit.id}`}
                            className="text-xs font-semibold text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors text-center"
                          >
                            Verificar
                          </Link>
                        )}
                        {verificationStatus && (
                          <span
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium text-center ${
                              verificationStatus === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : verificationStatus === 'pending'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {verificationStatus === 'approved' ? '✓ Verificado' : verificationStatus === 'pending' ? '⏳ En revisión' : '✗ Rechazado'}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Restaurant switcher */}
      {restaurants.length > 1 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm font-semibold text-gray-600 mb-3">Ver otro restaurante:</p>
          <div className="flex flex-wrap gap-2">
            {restaurants.map((r) => (
              <Link
                key={r.id}
                href={`/dashboard?restaurantId=${r.id}`}
                className={`text-sm px-4 py-2 rounded-xl border-2 font-medium transition-colors ${
                  r.id === activeRestaurant.id
                    ? 'border-rappi-orange bg-rappi-orange text-white'
                    : 'border-gray-200 text-gray-600 hover:border-rappi-orange hover:text-rappi-orange'
                }`}
              >
                {r.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
