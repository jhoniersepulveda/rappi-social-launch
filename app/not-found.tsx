import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="text-6xl font-bold text-rappi-orange">404</div>
        <h2 className="text-xl font-bold text-gray-800">Página no encontrada</h2>
        <p className="text-gray-500 text-sm">La página que buscas no existe.</p>
        <Link
          href="/"
          className="inline-block bg-rappi-orange text-white font-bold px-6 py-3 rounded-xl hover:bg-[#e03a16] transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
