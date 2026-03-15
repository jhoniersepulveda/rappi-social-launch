'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  open:     boolean
  onRetry?: () => void
  onClose?: () => void
}

export function BudgetModal({ open, onRetry, onClose }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a1a] border border-red-800/60 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">

        <div className="w-14 h-14 rounded-2xl bg-red-950 border border-red-800 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={28} className="text-red-400" />
        </div>

        <h2 className="text-white font-black text-lg mb-2">Sin saldo disponible</h2>
        <p className="text-[#888] text-sm leading-relaxed mb-6">
          No hay saldo disponible para generar imágenes en este momento.
        </p>

        {onRetry && (
          <button
            onClick={() => { onRetry(); onClose?.() }}
            className="flex items-center justify-center gap-2 w-full py-3.5
              bg-[#FF441B] hover:bg-[#e03a16] text-white font-black rounded-xl
              transition-colors text-sm mb-3"
          >
            <RefreshCw size={14} />
            Reintentar
          </button>
        )}

        {onClose && (
          <button
            onClick={onClose}
            className="w-full py-2.5 text-[#555] hover:text-[#888] text-sm transition-colors"
          >
            Cerrar
          </button>
        )}
      </div>
    </div>
  )
}
