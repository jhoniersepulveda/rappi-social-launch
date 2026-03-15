'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Users, Store, Zap } from 'lucide-react'
import Image from 'next/image'

const INFO_CARDS = [
  {
    id:        'asesor',
    icon:      Users,
    title:     'Asesor Rappi',
    desc:      'Gestiona packs para tus restaurantes asignados y ve el historial completo',
    hint:      'asesor@rappi.com',
    email:     'asesor@rappi.com',
    roleLabel: 'Accederás como Asesor Rappi',
    border:    'border-[#FF441B]',
    borderActive: 'border-[#FF441B] shadow-[0_0_0_2px_rgba(255,68,27,0.4)]',
    iconBg:    'bg-[#FF441B]/15',
    iconColor: 'text-[#FF441B]',
    textHint:  'text-[#FF441B]',
    roleCls:   'text-[#FF441B]',
  },
  {
    id:        'restaurant',
    icon:      Store,
    title:     'Restaurante',
    desc:      'Genera tus propias piezas para Instagram, Stories y WhatsApp en minutos',
    hint:      'Tu correo empresarial',
    email:     '',
    roleLabel: 'Accederás como Restaurante',
    border:    'border-[#00C853]/40',
    borderActive: 'border-[#00C853] shadow-[0_0_0_2px_rgba(0,200,83,0.3)]',
    iconBg:    'bg-[#00C853]/15',
    iconColor: 'text-[#00C853]',
    textHint:  'text-[#00C853]',
    roleCls:   'text-[#00C853]',
  },
  {
    id:        'admin',
    icon:      Zap,
    title:     'Admin Masivo',
    desc:      'Sube un CSV y genera packs en batch para múltiples restaurantes',
    hint:      'admin@rappi.com',
    email:     'admin@rappi.com',
    roleLabel: 'Accederás como Administrador',
    border:    'border-[#7C3AED]/40',
    borderActive: 'border-[#7C3AED] shadow-[0_0_0_2px_rgba(124,58,237,0.35)]',
    iconBg:    'bg-[#7C3AED]/15',
    iconColor: 'text-[#7C3AED]',
    textHint:  'text-[#7C3AED]',
    roleCls:   'text-[#7C3AED]',
  },
]

export default function LoginPage() {
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const router = useRouter()

  const isRestaurant = email.includes('@') && !email.toLowerCase().endsWith('@rappi.com')
  const activeCard   = INFO_CARDS.find(c => c.id === selectedCard) ?? null

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) {
      setError(
        isRestaurant
          ? 'Email no encontrado. Verifica que tu restaurante esté registrado.'
          : 'Credenciales incorrectas.'
      )
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  function selectCard(card: typeof INFO_CARDS[0]) {
    setSelectedCard(card.id)
    if (card.email) setEmail(card.email)
    setError('')
  }

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value)
    setSelectedCard(null)   // manual typing clears card selection
    setError('')
  }

  return (
    <div className="min-h-screen bg-[#111111] flex flex-col items-center justify-center p-6">

      {/* Logo */}
      <div className="mb-10 text-center select-none">
        <div className="flex items-center justify-center mb-3">
          <Image src="/assets/rappi/rappi-logo.svg" alt="Rappi" width={180} height={76} priority />
        </div>
        <div className="text-[#FF441B] font-bold text-xs tracking-[0.35em] uppercase">
          Social Launch
        </div>
        <div className="text-[#555] text-xs mt-2">Generación de piezas publicitarias con IA</div>
      </div>

      {/* Login form */}
      <form onSubmit={handleLogin} className="w-full max-w-sm mb-10">
        <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/8">
          <p className="text-white font-bold text-base mb-5">Ingresar</p>

          <div className="space-y-3">
            <div>
              <label className="block text-[#888] text-xs uppercase tracking-widest mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="tu@rappi.com"
                autoComplete="email"
                autoFocus
                className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3
                  text-white placeholder-[#444] text-sm
                  focus:outline-none focus:border-[#FF441B] transition-colors"
                required
              />
              {/* Role label — only when a card is selected */}
              {activeCard && (
                <p className={`mt-1.5 text-xs font-medium ${activeCard.roleCls}`}>
                  {activeCard.roleLabel}
                </p>
              )}
            </div>

            <div>
              <label className="block text-[#888] text-xs uppercase tracking-widest mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3
                  text-white placeholder-[#444] text-sm
                  focus:outline-none focus:border-[#FF441B] transition-colors"
                required
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-950/50 border border-red-800/50 rounded-xl text-red-400 text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full py-3.5 bg-[#FF441B] hover:bg-[#e03a16]
              disabled:bg-[#2a2a2a] disabled:text-[#555]
              text-white font-black rounded-xl transition-colors text-sm"
          >
            {loading ? 'Ingresando...' : 'Ingresar →'}
          </button>
        </div>
      </form>

      {/* Info cards */}
      <div className="w-full max-w-2xl">
        <p className="text-[#555] text-xs text-center uppercase tracking-widest mb-4">
          Tipos de acceso
        </p>
        <div className="grid grid-cols-3 gap-3">
          {INFO_CARDS.map(card => {
            const Icon     = card.icon
            const isActive = selectedCard === card.id
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => selectCard(card)}
                className={`p-4 rounded-2xl border bg-[#1a1a1a] text-left transition-all duration-150
                  hover:bg-[#222]
                  ${isActive ? `${card.borderActive} bg-[#222]` : card.border}`}
              >
                <div className={`w-9 h-9 rounded-xl ${card.iconBg} flex items-center justify-center mb-3`}>
                  <Icon size={18} className={card.iconColor} />
                </div>
                <div className="font-black text-white text-sm mb-1">{card.title}</div>
                <div className="text-[#888] text-xs leading-relaxed mb-3">{card.desc}</div>
                <div className={`text-[10px] font-mono font-semibold ${card.textHint}`}>
                  {card.hint}
                </div>
              </button>
            )
          })}
        </div>
      </div>

    </div>
  )
}
