'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-gray-50 flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="text-5xl">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800">Error crítico</h2>
          <p className="text-gray-500 text-sm">{error.message || 'Error inesperado en la aplicación.'}</p>
          <button
            onClick={reset}
            style={{ background: '#FF441B' }}
            className="text-white font-bold px-6 py-3 rounded-xl"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}
