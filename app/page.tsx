import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function Home() {
  let restaurantCount = 0
  let kitCount = 0
  try {
    restaurantCount = await prisma.restaurant.count()
    kitCount = await prisma.graphicKit.count()
  } catch {
    // DB not yet configured
  }

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center py-16 space-y-6">
        <div className="inline-block bg-rappi-orange text-white text-sm font-semibold px-4 py-2 rounded-full mb-2">
          🚀 Nuevo en Rappi
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
          Genera piezas gráficas con IA<br />
          <span className="text-rappi-orange">para tu restaurante</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto">
          Crea contenido profesional para Instagram, Stories y WhatsApp con deep links directos a tu tienda en Rappi. En menos de 2 minutos.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/kit/new"
            className="bg-rappi-orange text-white font-bold px-8 py-4 rounded-2xl text-lg hover:bg-[#e03a16] transition-colors shadow-lg"
          >
            Crear mi kit gratis →
          </Link>
          <Link
            href="/dashboard"
            className="border-2 border-gray-200 text-gray-700 font-semibold px-8 py-4 rounded-2xl text-lg hover:border-rappi-orange hover:text-rappi-orange transition-colors"
          >
            Ver mi historial
          </Link>
        </div>
      </section>

      {/* Stats */}
      {(restaurantCount > 0 || kitCount > 0) && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Restaurantes', value: restaurantCount, icon: '🍽️' },
            { label: 'Kits generados', value: kitCount, icon: '🎨' },
            { label: 'Redes soportadas', value: 3, icon: '📱' },
            { label: 'Variantes por kit', value: 3, icon: '📐' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-100">
              <div className="text-3xl mb-2">{stat.icon}</div>
              <p className="text-3xl font-bold text-rappi-orange">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </section>
      )}

      {/* Features */}
      <section className="grid md:grid-cols-3 gap-6">
        {[
          {
            icon: '🤖',
            title: 'Generación con IA',
            desc: 'Replicate Flux Schnell genera imágenes profesionales de tus productos en segundos, con fallback a DALL-E 3.',
          },
          {
            icon: '🔗',
            title: 'Deep links con QR',
            desc: 'Cada pieza incluye un QR y URL corta con UTM que lleva directamente a tu tienda en Rappi.',
          },
          {
            icon: '🏆',
            title: 'Incentivos automáticos',
            desc: 'Publica y verifica con IA. Si tu publicación es auténtica, activa boost de visibilidad y badges en Rappi.',
          },
        ].map((f) => (
          <div key={f.title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="text-4xl mb-4">{f.icon}</div>
            <h3 className="font-bold text-lg text-gray-800 mb-2">{f.title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">¿Cómo funciona?</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { step: '1', title: 'Elige un producto', desc: 'Selecciona el producto que quieres destacar esta semana.' },
            { step: '2', title: 'Genera con IA', desc: 'En 30-60 segundos tienes 3 variantes listas para Feed, Stories y WhatsApp.' },
            { step: '3', title: 'Publica y verifica', desc: 'Sube una captura de pantalla para activar tus incentivos en Rappi.' },
          ].map((s) => (
            <div key={s.step} className="flex gap-4">
              <div className="w-10 h-10 bg-rappi-orange text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                {s.step}
              </div>
              <div>
                <p className="font-semibold text-gray-800">{s.title}</p>
                <p className="text-sm text-gray-500 mt-1">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
