'use client'

import { useState, useEffect, useRef } from 'react'
import { signOut } from 'next-auth/react'
import Image from 'next/image'
import {
  Search, ChefHat, Sparkles, Download, BarChart2,
  Camera, ImageIcon, Loader2, CheckCircle, X, AlertTriangle, RefreshCw,
} from 'lucide-react'
import { useBudget } from '@/lib/hooks/useBudget'
import { BudgetModal } from '@/components/BudgetModal'

interface Product   { name: string; imageUrl: string; price: number }
interface Restaurant {
  id: string; name: string; slug: string; category: string
  logoUrl: string; email?: string
  topProducts: Product[]
  _count: { kits: number }
}
interface Kit {
  id: string; productName: string; promotionText: string
  status: string; imageUrls: Record<string, string> | null
  createdAt: string; restaurant: { name: string }
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending:         { label: 'Pendiente',  cls: 'bg-[#2a2a2a] text-[#888]' },
  generating:      { label: 'Generando', cls: 'bg-blue-950 text-blue-400' },
  ready:           { label: 'Listo',      cls: 'bg-green-950 text-green-400' },
  failed:          { label: 'Error',      cls: 'bg-red-950 text-red-400' },
  budget_exceeded: { label: 'Sin saldo',  cls: 'bg-red-950 text-red-400' },
}

export default function KAMDashboard() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [search,      setSearch]      = useState('')
  const [selected,    setSelected]    = useState<Restaurant | null>(null)
  const [recentKits,  setRecentKits]  = useState<Kit[]>([])
  const [tab,         setTab]         = useState<'generate' | 'history'>('generate')

  // Form
  const [productChoice, setProductChoice] = useState<string>('') // product name or '__custom__'
  const [customProduct, setCustomProduct] = useState('')
  const [promotionText, setPromotionText] = useState('')
  const [photoFile,     setPhotoFile]     = useState<File | null>(null)
  const [photoPreview,  setPhotoPreview]  = useState<string | null>(null)
  const [draggingPhoto, setDraggingPhoto] = useState(false)

  // Generation state
  const [generating,       setGenerating]       = useState(false)
  const [kitId,            setKitId]            = useState<string | null>(null)
  const [kitStatus,        setKitStatus]        = useState<string | null>(null)
  const [imageUrls,        setImageUrls]        = useState<Record<string, string> | null>(null)
  const [genError,         setGenError]         = useState('')
  const [showBudgetModal,  setShowBudgetModal]  = useState(false)

  const budget = useBudget()
  const { hasBudgetIssue } = budget

  const photoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/restaurants')
      .then(r => r.json())
      .then(setRestaurants)
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (tab !== 'history') return
    const url = selected
      ? `/api/kits/recent?restaurantId=${selected.id}`
      : '/api/kits/recent'
    fetch(url)
      .then(r => r.json())
      .then((d: unknown) => Array.isArray(d) ? setRecentKits(d as Kit[]) : null)
      .catch(console.error)
  }, [tab, selected])

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

  const filtered = restaurants.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.category.toLowerCase().includes(search.toLowerCase())
  )

  function selectRestaurant(r: Restaurant) {
    setSelected(r)
    setTab('generate')
    setProductChoice('')
    setCustomProduct('')
    setPromotionText('')
    setPhotoFile(null)
    setPhotoPreview(null)
    setKitId(null)
    setKitStatus(null)
    setImageUrls(null)
    setGenError('')
  }

  function handlePhotoFile(file: File) {
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function handlePhotoDrop(e: React.DragEvent) {
    e.preventDefault()
    setDraggingPhoto(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) handlePhotoFile(file)
  }

  async function doGenerate(force = false) {
    if (!selected) return
    if (!force && hasBudgetIssue) { setShowBudgetModal(true); return }
    setGenerating(true)
    setGenError('')
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
      body:    JSON.stringify({ restaurantId: selected.id, productName, productImage, promotionText }),
    })
    const data = await res.json() as { kitId?: string; error?: string }

    if (!res.ok || !data.kitId) {
      setGenError(data.error ?? 'Error al generar. Intenta de nuevo.')
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

  async function retryKit(kitId: string) {
    const res  = await fetch(`/api/kits/${kitId}/retry`, { method: 'POST' })
    const data = await res.json() as { kitId?: string }
    if (res.ok && data.kitId) {
      setKitId(data.kitId)
      setKitStatus('pending')
      setImageUrls(null)
      setGenError('')
      setTab('generate')
    }
  }

  const isWorking = generating || (!!kitStatus && !['ready', 'failed', 'budget_exceeded'].includes(kitStatus))

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col">
      <BudgetModal
        open={showBudgetModal}
        onRetry={() => { setKitStatus(null); doGenerate(true) }}
        onClose={() => setShowBudgetModal(false)}
      />

      {/* Top bar */}
      <header className="h-14 bg-[#111] border-b border-white/6 flex items-center px-6 gap-4 flex-shrink-0">
        <Image src="/assets/rappi/rappi-logo.svg" alt="Rappi" width={72} height={30} />
        <span className="text-[#333] text-sm">|</span>
        <span className="text-[#CCCCCC] text-sm font-semibold">Asesor Rappi</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setTab('generate')}
            className={`text-sm px-3 py-1.5 rounded-lg font-semibold transition-colors
              ${tab === 'generate' ? 'bg-[#FF441B] text-white' : 'text-[#888] hover:text-[#CCC]'}`}
          >
            Generar pack
          </button>
          <button
            onClick={() => setTab('history')}
            className={`text-sm px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5
              ${tab === 'history' ? 'bg-[#FF441B] text-white' : 'text-[#888] hover:text-[#CCC]'}`}
          >
            <BarChart2 size={14} />
            Historial
          </button>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="ml-3 text-xs text-[#555] hover:text-[#888] transition-colors"
          >
            Salir
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className="w-80 bg-[#111] border-r border-white/6 flex flex-col flex-shrink-0">

          {/* Search */}
          <div className="p-4 border-b border-white/6">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
              <input
                type="text"
                placeholder="Buscar restaurante..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#222] border border-[#333] rounded-xl pl-9 pr-3 py-2.5
                  text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#FF441B]
                  transition-colors"
              />
            </div>
          </div>

          {/* Restaurant list */}
          <div className="flex-1 overflow-y-auto py-2">
            {filtered.map(r => (
              <button
                key={r.id}
                onClick={() => selectRestaurant(r)}
                className={`w-full text-left px-4 py-3.5 transition-all
                  ${selected?.id === r.id
                    ? 'bg-[#FF441B]/15 border-l-2 border-l-[#FF441B]'
                    : 'border-l-2 border-l-transparent hover:bg-[#FF441B]/8'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-9 h-9 rounded-full bg-[#222] overflow-hidden flex items-center justify-center flex-shrink-0">
                    <ChefHat size={16} className="text-[#555] absolute" />
                    {r.logoUrl && (
                      <img src={r.logoUrl} alt="" className="absolute inset-0 w-full h-full object-cover"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-white truncate leading-tight">{r.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[#FF441B] font-medium">{r.category}</span>
                      <span className="text-xs text-[#AAAAAA]">{r._count.kits} kits</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="p-6 text-[#555] text-sm text-center">Sin resultados</p>
            )}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">

          {/* ── GENERATE TAB ── */}
          {tab === 'generate' && (
            !selected ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] flex items-center justify-center">
                  <ChefHat size={28} className="text-[#444]" />
                </div>
                <p className="text-[#555] text-sm">Selecciona un restaurante para generar su pack</p>
              </div>
            ) : (
              <div className="p-8 max-w-2xl">

                {/* Restaurant header */}
                <div className="mb-8">
                  <div className="flex items-start gap-4">
                    <div className="relative w-14 h-14 rounded-full bg-[#1a1a1a] border border-[#333] overflow-hidden flex items-center justify-center flex-shrink-0">
                      <ChefHat size={24} className="text-[#FF441B] absolute" />
                      {selected.logoUrl && (
                        <img src={selected.logoUrl} alt="" className="absolute inset-0 w-full h-full object-cover"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                      )}
                    </div>
                    <div>
                      <h1 className="text-2xl font-black text-white leading-tight">{selected.name}</h1>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs bg-[#FF441B]/20 text-[#FF441B] font-semibold px-2.5 py-1 rounded-full">
                          {selected.category}
                        </span>
                        <span className="text-xs text-[#888]">ID: {selected.slug}</span>
                        {selected.email && (
                          <span className="text-xs text-[#888]">{selected.email}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Generate form */}
                <form onSubmit={handleGenerate} className="space-y-5">
                  <p className="text-[#CCCCCC] font-bold text-sm uppercase tracking-widest">
                    Generar pack
                  </p>

                  {/* Product — dropdown + custom */}
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
                      {(selected.topProducts ?? []).map(p => (
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

                  {/* Promotion text */}
                  <div>
                    <label className="block text-[#888] text-xs uppercase tracking-widest mb-2">
                      Texto de promoción
                    </label>
                    <input
                      type="text"
                      value={promotionText}
                      onChange={e => setPromotionText(e.target.value)}
                      placeholder="ej: 30% OFF hoy, 2x1 este fin de semana..."
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
                        onDragOver={e => { e.preventDefault(); setDraggingPhoto(true) }}
                        onDragLeave={() => setDraggingPhoto(false)}
                        onDrop={handlePhotoDrop}
                        onClick={() => photoRef.current?.click()}
                        className={`cursor-pointer border-2 border-dashed rounded-2xl p-6 text-center transition-all
                          ${draggingPhoto
                            ? 'border-[#FF441B] bg-[#FF441B]/8'
                            : 'border-[#333] hover:border-[#FF441B]/60 bg-[#1a1a1a]'}`}
                      >
                        <input ref={photoRef} type="file" accept="image/*" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f) }} />
                        <Camera size={24} className="text-[#444] mx-auto mb-2" />
                        <p className="text-[#CCCCCC] text-sm font-medium">
                          Sube la foto del producto
                        </p>
                        <p className="text-[#555] text-xs mt-1">
                          o déjalo vacío para que la IA la genere
                        </p>
                        <p className="text-[#444] text-xs mt-2">JPG, PNG, WebP hasta 10 MB</p>
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

                  {genError && (
                    <div className="p-3 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-xs">
                      {genError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isWorking}
                    className="w-full py-4 bg-[#FF441B] hover:bg-[#e03a16]
                      disabled:bg-[#2a2a2a] disabled:text-[#555]
                      font-black rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    {isWorking
                      ? <><Loader2 size={16} className="animate-spin" /> Generando con IA...</>
                      : <><Sparkles size={16} /> Generar pack</>
                    }
                  </button>
                </form>

                {/* Generating */}
                {isWorking && (
                  <div className="mt-5 p-4 bg-[#1a1a1a] border border-white/6 rounded-xl text-center">
                    <p className="text-[#FF441B] font-bold text-sm animate-pulse">
                      La IA está creando las piezas...
                    </p>
                    <p className="text-[#555] text-xs mt-1">Aprox. 30–60 segundos</p>
                  </div>
                )}

                {/* Failed */}
                {kitStatus === 'failed' && (
                  <div className="mt-5 p-5 bg-red-950/30 border border-red-800/50 rounded-xl space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
                      <p className="text-red-300 font-bold text-sm">No se pudo generar</p>
                    </div>
                    <p className="text-[#888] text-xs leading-relaxed">
                      Una imagen no pudo generarse. Haz click en Regenerar para intentar de nuevo.
                    </p>
                    <button
                      onClick={() => doGenerate()}
                      className="flex items-center gap-1.5 text-xs font-bold text-white
                        bg-[#FF441B] hover:bg-[#e03a16] rounded-lg px-3 py-2 transition-colors"
                    >
                      <RefreshCw size={11} />
                      Regenerar
                    </button>
                  </div>
                )}

                {/* Budget exceeded */}
                {kitStatus === 'budget_exceeded' && (
                  <div className="mt-5 p-5 bg-red-950/30 border border-red-800/50 rounded-xl space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
                      <p className="text-red-300 font-bold text-sm">Sin saldo disponible</p>
                    </div>
                    <p className="text-[#888] text-xs leading-relaxed">
                      En este momento no tiene saldo disponible para generar nuevas imágenes.
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

                {/* Result */}
                {imageUrls && (
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={16} className="text-green-400" />
                      <p className="text-green-400 font-bold text-sm">Pack generado</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {(['feed', 'stories', 'whatsapp'] as const).map(v =>
                        imageUrls[v] ? (
                          <div key={v} className="space-y-1.5">
                            <img src={imageUrls[v]} alt={v}
                              className="w-full rounded-xl object-cover border border-[#333]" />
                            <p className="text-xs text-[#888] text-center capitalize">{v}</p>
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
            )
          )}

          {/* ── HISTORY TAB ── */}
          {tab === 'history' && (
            <div className="p-8">
              <h2 className="text-lg font-black text-white mb-6">
                {selected ? `Historial — ${selected.name}` : 'Últimos 50 kits generados'}
              </h2>
              <div className="space-y-2">
                {recentKits.length === 0 && (
                  <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-10 text-center">
                    <ImageIcon size={32} className="text-[#333] mx-auto mb-3" />
                    <p className="text-[#555] text-sm">Aún no hay kits generados</p>
                  </div>
                )}
                {recentKits.map(k => (
                  <div key={k.id}
                    className="bg-[#1a1a1a] border border-[#333] rounded-xl p-4 flex items-center gap-4">
                    {k.imageUrls?.feed
                      ? <img src={k.imageUrls.feed} alt=""
                          className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-[#333]" />
                      : <div className="w-14 h-14 rounded-xl bg-[#222] border border-[#333] flex items-center justify-center flex-shrink-0">
                          <ImageIcon size={20} className="text-[#444]" />
                        </div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-white truncate">{k.productName}</p>
                      <p className="text-xs text-[#888] truncate mt-0.5">{k.restaurant?.name}</p>
                      <p className="text-xs text-[#555] mt-0.5">
                        {new Date(k.createdAt).toLocaleDateString('es-CO', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium
                        ${(STATUS[k.status] ?? STATUS.pending).cls}`}>
                        {k.status === 'budget_exceeded' && <AlertTriangle size={10} />}
                        {(STATUS[k.status] ?? STATUS.pending).label}
                      </span>
                      {k.status === 'ready' && k.imageUrls && (
                        <a href={`/api/kits/${k.id}/download`} download
                          className="text-[#888] hover:text-[#FF441B] transition-colors p-1">
                          <Download size={16} />
                        </a>
                      )}
                      {(k.status === 'budget_exceeded' || k.status === 'failed') && (
                        <button
                          onClick={() => retryKit(k.id)}
                          title="Reintentar generación"
                          className="text-[#555] hover:text-[#FF441B] transition-colors p-1"
                        >
                          <RefreshCw size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
