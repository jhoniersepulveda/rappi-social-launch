'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Image from 'next/image'
import {
  Sparkles, Download, ImageIcon, Loader2, CheckCircle,
  Camera, X, AlertTriangle, RefreshCw, UserX, ChefHat,
} from 'lucide-react'
import { useBudget } from '@/lib/hooks/useBudget'
import { BudgetModal } from '@/components/BudgetModal'

interface Product { name: string; imageUrl: string; price: number }
interface Kit {
  id: string; productName: string; promotionText: string
  status: string; imageUrls: Record<string, string> | null
  createdAt: string
}
interface Restaurant {
  id: string; name: string; slug: string; category: string
  logoUrl?: string | null
  topProducts: Product[]
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending:         { label: 'Pendiente',  cls: 'bg-[#2a2a2a] text-[#888]' },
  generating:      { label: 'Generando', cls: 'bg-blue-950 text-blue-400' },
  ready:           { label: 'Listo',      cls: 'bg-green-950 text-green-400' },
  failed:          { label: 'Error',      cls: 'bg-red-950 text-red-400' },
  budget_exceeded: { label: 'Sin saldo',  cls: 'bg-red-950 text-red-400' },
}

export default function RestaurantDashboard() {
  const { data: session, status: sessionStatus } = useSession()
  const restaurantId   = session?.user?.restaurantId
  const restaurantName = session?.user?.restaurantName ?? ''

  const [restaurant,    setRestaurant]    = useState<Restaurant | null>(null)
  const [kits,          setKits]          = useState<Kit[]>([])
  const [productChoice, setProductChoice] = useState('')
  const [customProduct, setCustomProduct] = useState('')
  const [promotionText, setPromotionText] = useState('')
  const [photoFile,     setPhotoFile]     = useState<File | null>(null)
  const [photoPreview,  setPhotoPreview]  = useState<string | null>(null)
  const [dragging,      setDragging]      = useState(false)
  const [generating,    setGenerating]    = useState(false)
  const [kitId,         setKitId]         = useState<string | null>(null)
  const [kitStatus,     setKitStatus]     = useState<string | null>(null)
  const [imageUrls,     setImageUrls]     = useState<Record<string, string> | null>(null)
  const [error,            setError]           = useState('')
  const [showBudgetModal,  setShowBudgetModal] = useState(false)

  const budget = useBudget()
  const { hasBudgetIssue } = budget
  const fileRef = useRef<HTMLInputElement>(null)

  // Fetch this restaurant's data
  useEffect(() => {
    if (!restaurantId) return
    fetch(`/api/restaurants/${restaurantId}`)
      .then(r => r.json())
      .then((data: Restaurant) => setRestaurant(data))
      .catch(console.error)
  }, [restaurantId])

  // Fetch kit history (re-runs when a kit finishes)
  useEffect(() => {
    if (!restaurantId) return
    fetch(`/api/restaurants/${restaurantId}/kits`)
      .then(r => r.json())
      .then((data: unknown) => Array.isArray(data) ? setKits(data as Kit[]) : null)
      .catch(console.error)
  }, [restaurantId, kitStatus])

  // Poll kit status
  useEffect(() => {
    if (!kitId || ['ready', 'failed', 'budget_exceeded'].includes(kitStatus ?? '')) return
    const iv = setInterval(async () => {
      const res  = await fetch(`/api/kits/${kitId}/status`)
      const data = await res.json() as { status: string; imageUrls?: Record<string, string> }
      setKitStatus(data.status)
      if (data.status === 'ready')           { setImageUrls(data.imageUrls ?? null); clearInterval(iv); budget.refresh() }
      if (data.status === 'failed')          clearInterval(iv)
      if (data.status === 'budget_exceeded') { setShowBudgetModal(true); clearInterval(iv) }
    }, 2500)
    return () => clearInterval(iv)
  }, [kitId, kitStatus])

  function handlePhotoFile(file: File) {
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function doGenerate(force = false) {
    if (!restaurantId) return
    if (!force && hasBudgetIssue) { setShowBudgetModal(true); return }
    setError('')
    setGenerating(true)
    setKitId(null)
    setKitStatus(null)
    setImageUrls(null)

    const productName = productChoice === '__custom__' ? customProduct : productChoice

    let productImage = 'https://placeholder.rappi.com/product.jpg'
    if (photoFile) {
      const fd = new FormData()
      fd.append('file', photoFile)
      try {
        const up   = await fetch('/api/upload', { method: 'POST', body: fd })
        const data = await up.json() as { url?: string }
        if (data.url) productImage = data.url
      } catch { /* fallback */ }
    }

    const res  = await fetch('/api/kits/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ restaurantId, productName, productImage, promotionText }),
    })
    const data = await res.json() as { kitId?: string; error?: string }

    if (!res.ok || !data.kitId) {
      setError(data.error ?? 'Error al generar. Intenta de nuevo.')
      setGenerating(false)
      return
    }

    setKitId(data.kitId)
    setKitStatus('pending')
    setGenerating(false)
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    await doGenerate()
  }

  const isWorking = generating || (!!kitStatus && !['ready', 'failed', 'budget_exceeded'].includes(kitStatus))
  const products  = restaurant?.topProducts ?? []

  // ── Loading ──────────────────────────────────────────────────────────────
  if (sessionStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#FF441B]" />
      </div>
    )
  }

  // ── No restaurant in session (email not linked to any restaurant) ─────────
  if (sessionStatus === 'authenticated' && !restaurantId) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col">
        <header className="h-14 bg-[#111] border-b border-white/6 flex items-center px-6 gap-3 flex-shrink-0">
          <Image src="/assets/rappi/rappi-logo.svg" alt="Rappi" width={72} height={30} />
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="ml-auto text-xs text-[#555] hover:text-[#888] transition-colors"
          >
            Salir
          </button>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] border border-[#333] flex items-center justify-center">
            <UserX size={28} className="text-[#555]" />
          </div>
          <div>
            <p className="text-white font-bold text-lg">Tu restaurante no está registrado aún.</p>
            <p className="text-[#888] text-sm mt-1">
              Contacta a tu Asesor Rappi para activar tu cuenta.
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-xs text-[#555] hover:text-[#888] transition-colors mt-4"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col">
      <BudgetModal
        open={showBudgetModal}
        onRetry={() => { setKitStatus(null); doGenerate(true) }}
        onClose={() => setShowBudgetModal(false)}
      />

      {/* Header */}
      <header className="h-14 bg-[#111] border-b border-white/6 flex items-center px-6 gap-3 flex-shrink-0">
        <Image src="/assets/rappi/rappi-logo.svg" alt="Rappi" width={72} height={30} />
        <span className="text-[#333] text-sm">|</span>
        <div className="relative w-8 h-8 rounded-full bg-[#222] overflow-hidden flex items-center justify-center flex-shrink-0">
          <ChefHat size={14} className="text-[#555] absolute" />
          {restaurant?.logoUrl && (
            <img src={restaurant.logoUrl} alt="" className="absolute inset-0 w-full h-full object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          )}
        </div>
        <span className="text-[#CCCCCC] text-sm font-semibold truncate">
          {restaurantName || restaurant?.name || 'Mi Restaurante'}
        </span>
        {restaurant?.category && (
          <span className="text-xs bg-[#FF441B]/20 text-[#FF441B] font-semibold px-2.5 py-1 rounded-full">
            {restaurant.category}
          </span>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="ml-auto text-xs text-[#555] hover:text-[#888] transition-colors"
        >
          Salir
        </button>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">

        {/* ── Left: Generate form ── */}
        <div>
          <p className="text-[#CCCCCC] font-bold text-sm uppercase tracking-widest mb-6">
            Crear nuevo pack
          </p>

          <form onSubmit={handleGenerate} className="space-y-5">

            {/* Product */}
            <div>
              <label className="block text-[#888] text-xs uppercase tracking-widest mb-2">
                Producto
              </label>
              <select
                value={productChoice}
                onChange={e => setProductChoice(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3
                  text-white text-sm focus:outline-none focus:border-[#FF441B]
                  transition-colors appearance-none cursor-pointer"
                required={productChoice !== '__custom__'}
              >
                <option value="" disabled>Selecciona un producto...</option>
                {products.map(p => (
                  <option key={p.name} value={p.name}>
                    {p.name}{p.price ? ` — $${p.price.toLocaleString('es-CO')}` : ''}
                  </option>
                ))}
                <option value="__custom__">Otro producto (escribe el nombre)</option>
              </select>

              {productChoice === '__custom__' && (
                <input
                  type="text"
                  value={customProduct}
                  onChange={e => setCustomProduct(e.target.value)}
                  placeholder="Nombre del producto..."
                  className="mt-2 w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3
                    text-white placeholder-[#555] text-sm focus:outline-none focus:border-[#FF441B]
                    transition-colors"
                  required
                />
              )}
            </div>

            {/* Promotion */}
            <div>
              <label className="block text-[#888] text-xs uppercase tracking-widest mb-2">
                Texto de promoción
              </label>
              <input
                type="text"
                value={promotionText}
                onChange={e => setPromotionText(e.target.value)}
                placeholder="ej: 30% OFF hoy"
                maxLength={80}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3
                  text-white placeholder-[#555] text-sm focus:outline-none focus:border-[#FF441B]
                  transition-colors"
                required
              />
              <p className="text-[#555] text-xs mt-1 text-right">{promotionText.length}/80</p>
            </div>

            {/* Photo upload */}
            <div>
              <label className="block text-[#888] text-xs uppercase tracking-widest mb-2">
                Foto del producto
              </label>
              {!photoPreview ? (
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) handlePhotoFile(f) }}
                  onClick={() => fileRef.current?.click()}
                  className={`cursor-pointer border-2 border-dashed rounded-2xl p-6 text-center transition-all
                    ${dragging
                      ? 'border-[#FF441B] bg-[#FF441B]/8'
                      : 'border-[#333] hover:border-[#FF441B]/60 bg-[#1a1a1a]'}`}
                >
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f) }} />
                  <Camera size={24} className="text-[#444] mx-auto mb-2" />
                  <p className="text-[#CCCCCC] text-sm font-medium">Sube la foto del producto</p>
                  <p className="text-[#555] text-xs mt-1">o déjalo vacío para que la IA la genere</p>
                </div>
              ) : (
                <div className="relative bg-[#1a1a1a] border border-[#333] rounded-2xl p-3 flex items-center gap-3">
                  <img src={photoPreview} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{photoFile?.name}</p>
                    <p className="text-[#888] text-xs mt-0.5">
                      {photoFile ? (photoFile.size / 1024).toFixed(0) : 0} KB
                    </p>
                  </div>
                  <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                    className="text-[#555] hover:text-[#888] transition-colors p-1">
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isWorking}
              className="w-full py-4 bg-[#FF441B] hover:bg-[#e03a16]
                disabled:bg-[#2a2a2a] disabled:text-[#555]
                font-black rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isWorking
                ? <><Loader2 size={16} className="animate-spin" /> Generando con IA...</>
                : <><Sparkles size={16} /> Generar mis piezas</>
              }
            </button>
          </form>

          {/* Generating feedback */}
          {isWorking && (
            <div className="mt-5 p-4 bg-[#1a1a1a] border border-white/6 rounded-xl text-center">
              <p className="text-[#FF441B] font-bold text-sm animate-pulse">
                Creando tus piezas...
              </p>
              <p className="text-[#555] text-xs mt-1">Aprox. 30–60 segundos</p>
            </div>
          )}

          {kitStatus === 'failed' && (
            <div className="mt-5 p-4 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-sm text-center">
              La generación falló. Intenta de nuevo.
            </div>
          )}

          {kitStatus === 'budget_exceeded' && (
            <div className="mt-5 p-5 bg-red-950/30 border border-red-800/50 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
                <p className="text-red-300 font-bold text-sm">Sin saldo disponible</p>
              </div>
              <p className="text-[#888] text-xs leading-relaxed">
                No hay saldo disponible para generar imágenes en este momento.
              </p>
              <button
                onClick={() => doGenerate(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-white
                  bg-[#FF441B] hover:bg-[#e03a16] rounded-lg px-3 py-2 transition-colors"
              >
                <RefreshCw size={11} />
                Reintentar
              </button>
            </div>
          )}

          {imageUrls && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-green-400" />
                <p className="text-green-400 font-bold text-sm">Pack listo</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['feed', 'stories', 'whatsapp'] as const).map(v =>
                  imageUrls[v] ? (
                    <div key={v}>
                      <img src={imageUrls[v]} alt={v}
                        className="w-full rounded-xl border border-[#333] object-cover" />
                      <p className="text-xs text-[#888] text-center mt-1 capitalize">{v}</p>
                    </div>
                  ) : null
                )}
              </div>
              {kitId && (
                <a href={`/api/kits/${kitId}/download`} download
                  className="flex items-center justify-center gap-2 text-sm text-[#FF441B]
                    border border-[#FF441B]/40 rounded-xl py-3 hover:bg-[#FF441B]/10
                    transition-colors font-semibold">
                  <Download size={15} />
                  Descargar ZIP
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Kit history ── */}
        <div>
          <p className="text-[#CCCCCC] font-bold text-sm uppercase tracking-widest mb-6">
            Mis packs anteriores
          </p>

          {kits.length === 0 ? (
            <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-10 text-center">
              <ImageIcon size={32} className="text-[#333] mx-auto mb-3" />
              <p className="text-[#555] text-sm">Aún no has generado ningún pack</p>
            </div>
          ) : (
            <div className="space-y-2">
              {kits.map(k => (
                <div key={k.id}
                  className="bg-[#1a1a1a] border border-[#333] rounded-xl p-4 flex items-center gap-3">
                  {k.imageUrls?.feed
                    ? <img src={k.imageUrls.feed} alt=""
                        className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-[#333]" />
                    : <div className="w-12 h-12 rounded-xl bg-[#222] border border-[#333] flex items-center justify-center flex-shrink-0">
                        <ImageIcon size={18} className="text-[#444]" />
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-white truncate">{k.productName}</p>
                    <p className="text-xs text-[#888] mt-0.5">
                      {new Date(k.createdAt).toLocaleDateString('es-CO', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium
                      ${(STATUS[k.status] ?? STATUS.pending).cls}`}>
                      {k.status === 'budget_exceeded' && <AlertTriangle size={10} />}
                      {(STATUS[k.status] ?? STATUS.pending).label}
                    </span>
                    {k.status === 'ready' && k.imageUrls && (
                      <a href={`/api/kits/${k.id}/download`} download
                        className="text-[#888] hover:text-[#FF441B] transition-colors p-1">
                        <Download size={15} />
                      </a>
                    )}
                    {(k.status === 'budget_exceeded' || k.status === 'failed') && (
                      <button
                        onClick={async () => {
                          const res  = await fetch(`/api/kits/${k.id}/retry`, { method: 'POST' })
                          const data = await res.json() as { kitId?: string }
                          if (res.ok && data.kitId) {
                            setKitId(data.kitId)
                            setKitStatus('pending')
                            setImageUrls(null)
                          }
                        }}
                        title="Reintentar generación"
                        className="text-[#555] hover:text-[#FF441B] transition-colors p-1"
                      >
                        <RefreshCw size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
