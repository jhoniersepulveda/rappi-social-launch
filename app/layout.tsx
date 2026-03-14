import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Rappi Social Launch',
  description: 'Genera piezas gráficas con IA para promocionar tu restaurante en redes sociales',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className="antialiased min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-rappi-orange shadow-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="text-white font-bold text-xl tracking-tight">
              rappi <span className="font-normal text-orange-100">social launch</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/kit/new" className="text-white text-sm font-semibold hover:text-orange-100 transition-colors">
                Crear kit
              </Link>
              <Link href="/dashboard" className="text-white text-sm font-semibold hover:text-orange-100 transition-colors">
                Dashboard
              </Link>
              <Link
                href="/admin/dashboard"
                className="bg-white text-rappi-orange text-sm font-bold px-4 py-1.5 rounded-full hover:bg-orange-50 transition-colors"
              >
                KAM
              </Link>
            </nav>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>

        {/* Footer */}
        <footer className="mt-16 bg-rappi-black text-gray-400 py-6 text-center text-sm">
          <p>© {new Date().getFullYear()} Rappi Social Launch · Todos los derechos reservados</p>
        </footer>
      </body>
    </html>
  )
}
