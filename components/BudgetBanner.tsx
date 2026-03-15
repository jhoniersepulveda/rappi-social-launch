'use client'

import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useBudgetContext } from '@/components/BudgetProvider'
import { useSession } from 'next-auth/react'

export function BudgetBanner() {
  const { data: session }                             = useSession()
  const { hasBudgetIssue, estimatedCostUSD, loading } = useBudgetContext()
  const [dismissed, setDismissed]                     = useState(false)

  if (!session || loading || !hasBudgetIssue || dismissed) return null

  return (
    <div className="w-full bg-red-950 border-b border-red-800 px-4 py-2.5 flex items-center gap-3 z-50">
      <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />

      <p className="text-red-300 text-sm flex-1">
        <span className="font-bold text-red-200">Sin saldo disponible.</span>
        {' '}No hay saldo disponible para generar imágenes en este momento.
        {estimatedCostUSD > 0 && (
          <span className="text-red-500 ml-2 text-xs">
            (uso estimado este mes: ${estimatedCostUSD.toFixed(2)} USD)
          </span>
        )}
      </p>

      <button
        onClick={() => setDismissed(true)}
        className="text-red-600 hover:text-red-400 transition-colors flex-shrink-0 p-1"
        aria-label="Cerrar"
      >
        <X size={14} />
      </button>
    </div>
  )
}
