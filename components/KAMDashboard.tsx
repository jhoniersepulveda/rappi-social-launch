'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Restaurant {
  id: string
  name: string
  slug: string
  category: string
  createdAt: string
  isBoosted: boolean
  boostedUntil: string | null
  _count: { kits: number }
  incentives: Array<{ type: string; expiresAt: string }>
  verificationCount: number
  ordersLast28Days: number
}

interface KAMDashboardProps {
  restaurants: Restaurant[]
}

type StatusFilter = 'all' | 'low' | 'mid' | 'high'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  all: { label: 'Todos', color: 'bg-gray-100 text-gray-700' },
  low: { label: '< 3 órdenes', color: 'bg-red-100 text-red-700' },
  mid: { label: '3-9 órdenes', color: 'bg-yellow-100 text-yellow-700' },
  high: { label: '≥ 10 órdenes', color: 'bg-green-100 text-green-700' },
}

export default function KAMDashboard({ restaurants }: KAMDashboardProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateFilter, setDateFilter] = useState('')
  const [search, setSearch] = useState('')

  const filtered = restaurants.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
    if (dateFilter && new Date(r.createdAt) < new Date(dateFilter)) return false
    if (statusFilter === 'low' && r.ordersLast28Days >= 3) return false
    if (statusFilter === 'mid' && (r.ordersLast28Days < 3 || r.ordersLast28Days >= 10)) return false
    if (statusFilter === 'high' && r.ordersLast28Days < 10) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Buscar restaurante</label>
          <input
            type="text"
            placeholder="Nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 focus:border-rappi-orange outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Estado de activación</label>
          <div className="flex gap-2">
            {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  statusFilter === s ? 'bg-rappi-orange text-white' : STATUS_LABELS[s].color
                }`}
              >
                {STATUS_LABELS[s].label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Desde fecha de onboarding</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="border-2 border-gray-200 rounded-xl px-4 py-2 focus:border-rappi-orange outline-none text-sm"
          />
        </div>
        <p className="text-sm text-gray-500 self-center">{filtered.length} restaurante{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-4 font-semibold text-gray-600">Restaurante</th>
                <th className="text-left px-4 py-4 font-semibold text-gray-600">Onboarding</th>
                <th className="text-center px-4 py-4 font-semibold text-gray-600">Kits</th>
                <th className="text-center px-4 py-4 font-semibold text-gray-600">Verificados</th>
                <th className="text-center px-4 py-4 font-semibold text-gray-600">Órdenes (28d)</th>
                <th className="text-center px-4 py-4 font-semibold text-gray-600">Incentivo</th>
                <th className="text-center px-4 py-4 font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-orange-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-gray-800">{r.name}</p>
                      <p className="text-gray-400 text-xs">{r.category} · {r.slug}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-600">
                    {new Date(r.createdAt).toLocaleDateString('es-CO', { dateStyle: 'short' })}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-bold text-gray-800">{r._count.kits}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-bold text-gray-800">{r.verificationCount}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span
                      className={`font-bold px-2 py-1 rounded-lg ${
                        r.ordersLast28Days >= 10
                          ? 'bg-green-100 text-green-700'
                          : r.ordersLast28Days >= 3
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {r.ordersLast28Days}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {r.incentives[0] ? (
                      <div>
                        <span className="text-xs font-medium text-rappi-orange bg-orange-50 px-2 py-1 rounded-full">
                          {r.incentives[0].type === 'boost_visibility' ? '🚀 Boost' : r.incentives[0].type === 'badge_nuevo' ? '🏅 Badge' : '💸 Descuento'}
                        </span>
                        <p className="text-xs text-gray-400 mt-1">
                          hasta {new Date(r.incentives[0].expiresAt).toLocaleDateString('es-CO', { dateStyle: 'short' })}
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <Link
                      href={`/kit/new?restaurantId=${r.id}`}
                      className="inline-block bg-rappi-orange text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#e03a16] transition-colors"
                    >
                      + Kit
                    </Link>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    No se encontraron restaurantes con los filtros seleccionados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
