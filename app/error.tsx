'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-xl font-bold text-gray-800">Algo salió mal</h2>
        <p className="text-gray-500 text-sm max-w-sm">{error.message || 'Ocurrió un error inesperado.'}</p>
        <button
          onClick={reset}
          className="bg-rappi-orange text-white font-bold px-6 py-3 rounded-xl hover:bg-[#e03a16] transition-colors"
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  )
}
