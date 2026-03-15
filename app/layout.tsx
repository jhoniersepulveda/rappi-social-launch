import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SessionProviderWrapper } from '@/components/SessionProviderWrapper'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })

export const metadata: Metadata = {
  title: 'Rappi Social Launch',
  description: 'Genera piezas gráficas con IA para promocionar tu restaurante en redes sociales',
  icons: {
    icon:  '/assets/rappi/rappi-logo.png',
    apple: '/assets/rappi/rappi-logo.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={inter.className}>
      <body className="antialiased min-h-screen bg-[#0d0d0d]">
        <SessionProviderWrapper>
          {children}
        </SessionProviderWrapper>
      </body>
    </html>
  )
}
