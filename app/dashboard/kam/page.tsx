'use client'

import { useState, useEffect, useRef } from 'react'
import { signOut } from 'next-auth/react'
import Image from 'next/image'
import {
  Search, ChefHat, Sparkles, Download, BarChart2,
  Camera, ImageIcon, Loader2, CheckCircle, X, AlertTriangle,
  RefreshCw, Menu, ArrowLeft, Zap,
} from 'lucide-react'
import { useBudget } from '@/lib/hooks/useBudget'
import { BudgetModal } from '@/components/BudgetModal'

interface Product   { name: string; imageUrl: string; price: number }
interface Restaurant {
  id: string; name: string; slug: string; category: string
  logoUrl: string; email?: string; city?: string
  topProducts: Product[]
  _count: { kits: number }
}
interface Kit {
  id: string; productName: string; promotionText: string
  status: string; imageUrls: Record<string, string> | null
  createdAt: string; restaurant: { name: string }
}

const STATUS: Record<string, { label: string; dot: string }> = {
  pending:         { label: 'Pendiente',  dot: 'bg-zinc-500' },
  generating:      { label: 'Generando', dot: 'bg-blue-400 animate-pulse' },
  ready:           { label: 'Listo',      dot: 'bg-emerald-400' },
  failed:          { label: 'Error',      dot: 'bg-red-400' },
  budget_exceeded: { label: 'Sin saldo',  dot: 'bg-red-400' },
}

const CATEGORY_COLOR: Record<string, string> = {
  'Fast food':  'text-orange-400  bg-orange-400/10',
  'Saludable':  'text-emerald-400 bg-emerald-400/10',
  'Cafetería':  'text-amber-400   bg-amber-400/10',
  'Postres':    'text-pink-400    bg-pink-400/10',
  'Bebidas':    'text-sky-400     bg-sky-400/10',
}

export default function KAMDashboard() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [search,      setSearch]      = useState('')
  const [selected,    setSelected]    = useState<Restaurant | null>(null)
  const [recentKits,  setRecentKits]  = useState<Kit[]>([])
  const [tab,         setTab]         = useState<'generate' | 'history'>('generate')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Form
  const [productChoice, setProductChoice] = useState<string>('')
  const [customProduct, setCustomProduct] = useState('')
  const [promotionText, setPromotionText] = useState('')
  const [photoFile,     setPhotoFile]     = useState<File | null>(null)
  const [photoPreview,  setPhotoPreview]  = useState<string | null>(null)
  const [draggingPhoto, setDraggingPhoto] = useState(false)

  // Generation state
  const [generating,      setGenerating]      = useState(false)
  const [kitId,           setKitId]           = useState<string | null>(null)
  const [kitStatus,       setKitStatus]       = useState<string | null>(null)
  const [imageUrls,       setImageUrls]       = useState<Record<string, string> | null>(null)
  const [genError,        setGenError]        = useState('')
  const [showBudgetModal, setShowBudgetModal] = useState(false)

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

  // Search by name, category, slug (store ID), city
  const q = search.toLowerCase()
  const filtered = restaurants.filter(r =>
    r.name.toLowerCase().includes(q) ||
    r.category.toLowerCase().includes(q) ||
    r.slug.toLowerCase().includes(q) ||
    (r.city ?? '').toLowerCase().includes(q)
  )

  function selectRestaurant(r: Restaurant) {
    setSelected(r)
    setTab('generate')
    setSidebarOpen(false)
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

  async function retryKit(id: string) {
    const res  = await fetch(`/api/kits/${id}/retry`, { method: 'POST' })
    const data = await res.json() as { kitId?: string }
    if (res.ok && data.kitId) {
      setKitId(data.kitId); setKitStatus('pending')
      setImageUrls(null); setGenError(''); setTab('generate')
    }
  }

  const isWorking = generating || (!!kitStatus && !['ready', 'failed', 'budget_exceeded'].includes(kitStatus))

  // ─── Sidebar content (shared desktop + mobile) ───────────────────────────
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Nombre o ID del restaurante…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-zinc-900 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white
              placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FF441B]/60
              transition-all border border-transparent focus:border-[#FF441B]/30"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Count */}
      <div className="px-4 pb-2">
        <p className="text-zinc-600 text-xs">
          {filtered.length} restaurante{filtered.length !== 1 ? 's' : ''}
          {search && <span className="text-[#FF441B]/70"> · buscando "{search}"</span>}
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
        {filtered.map(r => {
          const isSelected = selected?.id === r.id
          const catCls = CATEGORY_COLOR[r.category] ?? 'text-zinc-400 bg-zinc-400/10'
          return (
            <button
              key={r.id}
              onClick={() => selectRestaurant(r)}
              className={`w-full text-left rounded-xl px-3 py-2.5 transition-all group
                ${isSelected
                  ? 'bg-[#FF441B]/12 ring-1 ring-[#FF441B]/25'
                  : 'hover:bg-white/4'}`}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className={`relative w-9 h-9 rounded-lg flex-shrink-0 overflow-hidden
                  ${isSelected ? 'ring-1.5 ring-[#FF441B]/50' : ''}`}>
                  <div className="absolute inset-0 bg-zinc-800 flex items-center justify-center">
                    <ChefHat size={15} className="text-zinc-600" />
                  </div>
                  {r.logoUrl && (
                    <img src={r.logoUrl} alt="" className="absolute inset-0 w-full h-full object-cover"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-semibold truncate leading-tight transition-colors
                    ${isSelected ? 'text-white' : 'text-zinc-300 group-hover:text-white'}`}>
                    {r.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${catCls}`}>
                      {r.category}
                    </span>
                    <span className="text-[10px] text-zinc-600 font-mono">{r.slug}</span>
                  </div>
                </div>

                {/* Kit count */}
                {r._count.kits > 0 && (
                  <span className={`text-[10px] font-bold flex-shrink-0 tabular-nums
                    ${isSelected ? 'text-[#FF441B]' : 'text-zinc-600 group-hover:text-zinc-500'}`}>
                    {r._count.kits}
                  </span>
                )}
              </div>
            </button>
          )
        })}

        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <Search size={24} className="text-zinc-700 mx-auto mb-2" />
            <p className="text-zinc-600 text-sm">Sin resultados</p>
            <button onClick={() => setSearch('')} className="text-[#FF441B] text-xs mt-1 hover:underline">
              Limpiar búsqueda
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col">
      <BudgetModal
        open={showBudgetModal}
        onRetry={() => { setKitStatus(null); doGenerate(true) }}
        onClose={() => setShowBudgetModal(false)}
      />

      {/* ── HEADER ── */}
      <header className="h-14 bg-[#0f1014] border-b border-white/5 flex items-center px-4 md:px-6 gap-3 flex-shrink-0 z-30">
        {/* Mobile hamburger */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg
            text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
        >
          <Menu size={18} />
        </button>

        <Image src="/assets/rappi/rappi-logo.svg" alt="Rappi" width={64} height={26} className="flex-shrink-0" />

        <div className="hidden md:block w-px h-4 bg-zinc-800 mx-1" />
        <span className="hidden md:block text-zinc-500 text-xs font-medium tracking-wide uppercase">
          Asesor
        </span>

        {/* Selected restaurant pill — mobile */}
        {selected && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden ml-1 flex items-center gap-2 bg-zinc-900 rounded-lg px-2.5 py-1.5 min-w-0 flex-1 max-w-[200px]"
          >
            <div className="w-5 h-5 rounded-md bg-zinc-800 overflow-hidden flex-shrink-0">
              {selected.logoUrl && (
                <img src={selected.logoUrl} alt="" className="w-full h-full object-cover"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              )}
            </div>
            <span className="text-xs text-zinc-300 font-medium truncate">{selected.name}</span>
          </button>
        )}

        {/* Nav tabs */}
        <div className="ml-auto flex items-center gap-1">
          <div className="flex items-center bg-zinc-900/80 rounded-xl p-1 gap-0.5">
            <button
              onClick={() => setTab('generate')}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-semibold transition-all
                ${tab === 'generate'
                  ? 'bg-[#FF441B] text-white shadow-lg shadow-[#FF441B]/20'
                  : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Sparkles size={12} />
              <span className="hidden sm:inline">Generar</span>
            </button>
            <button
              onClick={() => setTab('history')}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-semibold transition-all
                ${tab === 'history'
                  ? 'bg-[#FF441B] text-white shadow-lg shadow-[#FF441B]/20'
                  : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <BarChart2 size={12} />
              <span className="hidden sm:inline">Historial</span>
            </button>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="ml-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors px-2 py-2"
          >
            Salir
          </button>
        </div>
      </header>

      {/* ── LAYOUT ── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── SIDEBAR ── */}
        <aside className={`
          fixed md:static inset-y-0 left-0 z-50 md:z-auto
          w-72 md:w-72 lg:w-80
          bg-[#0f1014] md:bg-[#0c0d10]
          border-r border-white/5
          flex flex-col flex-shrink-0
          transition-transform duration-300 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          {/* Mobile sidebar header */}
          <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="text-sm font-semibold text-zinc-300">Restaurantes</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-zinc-600 hover:text-white transition-colors p-1"
            >
              <X size={18} />
            </button>
          </div>

          <SidebarContent />
        </aside>

        {/* ── MAIN ── */}
        <main className="flex-1 overflow-y-auto bg-[#0a0a0b]">

          {/* GENERATE TAB */}
          {tab === 'generate' && (
            !selected ? (
              // Empty state
              <div className="flex flex-col items-center justify-center h-full text-center gap-6 p-8">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center">
                    <ChefHat size={32} className="text-zinc-700" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-[#FF441B] flex items-center justify-center shadow-lg shadow-[#FF441B]/40">
                    <Sparkles size={13} className="text-white" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-white font-semibold text-base">Selecciona un restaurante</p>
                  <p className="text-zinc-600 text-sm max-w-xs leading-relaxed">
                    Elige un restaurante del panel izquierdo para generar su pack de piezas gráficas
                  </p>
                </div>
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden flex items-center gap-2 bg-[#FF441B] text-white text-sm font-bold
                    px-5 py-3 rounded-xl hover:bg-[#e03a16] transition-colors"
                >
                  <Menu size={16} />
                  Ver restaurantes
                </button>
              </div>
            ) : (
              <div className="p-4 md:p-8 max-w-2xl">

                {/* Restaurant header card */}
                <div className="mb-8 bg-zinc-900/50 border border-white/5 rounded-2xl p-5">
                  <div className="flex items-center gap-4">
                    {/* Logo */}
                    <div className="relative w-14 h-14 rounded-xl bg-zinc-800 overflow-hidden flex-shrink-0 ring-1 ring-white/10">
                      <ChefHat size={22} className="text-zinc-600 absolute inset-0 m-auto" />
                      {selected.logoUrl && (
                        <img src={selected.logoUrl} alt="" className="absolute inset-0 w-full h-full object-cover"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-lg font-black text-white leading-tight">{selected.name}</h1>
                      </div>
                      <div className="flex items-center flex-wrap gap-2 mt-1.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg
                          ${CATEGORY_COLOR[selected.category] ?? 'text-zinc-400 bg-zinc-400/10'}`}>
                          {selected.category}
                        </span>
                        <span className="text-xs text-zinc-600 font-mono bg-zinc-800/80 px-2 py-0.5 rounded-md">
                          {selected.slug}
                        </span>
                        {selected.city && (
                          <span className="text-xs text-zinc-600">{selected.city}</span>
                        )}
                      </div>
                    </div>
                    {/* Mobile: back button */}
                    <button
                      onClick={() => setSidebarOpen(true)}
                      className="md:hidden text-zinc-600 hover:text-zinc-400 transition-colors p-1.5 flex-shrink-0"
                    >
                      <ArrowLeft size={18} />
                    </button>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={async e => { e.preventDefault(); await doGenerate() }} className="space-y-4">

                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-1 h-4 rounded-full bg-[#FF441B]" />
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Configurar pack</p>
                  </div>

                  {/* Product */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                      Producto
                    </label>
                    <select
                      value={productChoice}
                      onChange={e => setProductChoice(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5
                        text-white text-sm focus:outline-none focus:border-[#FF441B]/50 focus:ring-1 focus:ring-[#FF441B]/20
                        transition-all appearance-none cursor-pointer min-h-[44px]"
                      required={productChoice !== '__custom__'}
                    >
                      <option value="" disabled>Selecciona un producto…</option>
                      {(selected.topProducts ?? []).map(p => (
                        <option key={p.name} value={p.name}>
                          {p.name}{p.price ? ` — $${p.price.toLocaleString('es-CO')}` : ''}
                        </option>
                      ))}
                      <option value="__custom__">✏ Otro producto (escribe el nombre)</option>
                    </select>

                    {productChoice === '__custom__' && (
                      <input
                        type="text"
                        value={customProduct}
                        onChange={e => setCustomProduct(e.target.value)}
                        placeholder="Nombre del producto…"
                        autoFocus
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5
                          text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-[#FF441B]/50
                          focus:ring-1 focus:ring-[#FF441B]/20 transition-all min-h-[44px]"
                        required
                      />
                    )}
                  </div>

                  {/* Promotion */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                      Texto de promoción
                    </label>
                    <input
                      type="text"
                      value={promotionText}
                      onChange={e => setPromotionText(e.target.value)}
                      placeholder="ej: 30% OFF hoy, 2×1 este fin de semana…"
                      maxLength={80}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5
                        text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-[#FF441B]/50
                        focus:ring-1 focus:ring-[#FF441B]/20 transition-all min-h-[44px]"
                      required
                    />
                    <p className={`text-xs text-right tabular-nums transition-colors
                      ${promotionText.length > 70 ? 'text-amber-500' : 'text-zinc-700'}`}>
                      {promotionText.length}/80
                    </p>
                  </div>

                  {/* Photo upload */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                      Foto del producto <span className="text-zinc-700 normal-case font-normal">(opcional)</span>
                    </label>
                    {!photoPreview ? (
                      <div
                        onDragOver={e => { e.preventDefault(); setDraggingPhoto(true) }}
                        onDragLeave={() => setDraggingPhoto(false)}
                        onDrop={handlePhotoDrop}
                        onClick={() => photoRef.current?.click()}
                        className={`cursor-pointer border border-dashed rounded-xl p-5 text-center transition-all
                          ${draggingPhoto
                            ? 'border-[#FF441B]/60 bg-[#FF441B]/5'
                            : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900/50'}`}
                      >
                        <input ref={photoRef} type="file" accept="image/*" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f) }} />
                        <Camera size={20} className="text-zinc-600 mx-auto mb-2" />
                        <p className="text-zinc-400 text-sm font-medium">Arrastra o haz clic para subir</p>
                        <p className="text-zinc-700 text-xs mt-0.5">o déjalo vacío — la IA la genera</p>
                      </div>
                    ) : (
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
                        <img src={photoPreview} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 ring-1 ring-white/10" />
                        <div className="flex-1 min-w-0">
                          <p className="text-zinc-200 text-sm font-medium truncate">{photoFile?.name}</p>
                          <p className="text-zinc-600 text-xs mt-0.5">
                            {photoFile ? (photoFile.size / 1024).toFixed(0) : 0} KB
                          </p>
                        </div>
                        <button type="button"
                          onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                          className="text-zinc-600 hover:text-zinc-400 transition-colors p-1.5">
                          <X size={15} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Error */}
                  {genError && (
                    <div className="flex items-start gap-2.5 p-3.5 bg-red-950/30 border border-red-900/40 rounded-xl">
                      <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-red-400 text-xs leading-relaxed">{genError}</p>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isWorking}
                    className="w-full py-4 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2
                      bg-[#FF441B] hover:bg-[#ff5533] active:bg-[#e03a16] text-white
                      shadow-lg shadow-[#FF441B]/20 hover:shadow-[#FF441B]/30
                      disabled:bg-zinc-800 disabled:text-zinc-600 disabled:shadow-none"
                  >
                    {isWorking
                      ? <><Loader2 size={16} className="animate-spin" />Generando con IA…</>
                      : <><Zap size={16} />Generar pack</>
                    }
                  </button>
                </form>

                {/* Generating status */}
                {isWorking && (
                  <div className="mt-4 p-4 bg-zinc-900/60 border border-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="relative w-8 h-8 flex-shrink-0">
                        <div className="absolute inset-0 rounded-full bg-[#FF441B]/20 animate-ping" />
                        <div className="relative w-8 h-8 rounded-full bg-[#FF441B]/15 flex items-center justify-center">
                          <Sparkles size={14} className="text-[#FF441B]" />
                        </div>
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">La IA está creando las piezas…</p>
                        <p className="text-zinc-600 text-xs mt-0.5">Aprox. 30–90 segundos</p>
                      </div>
                    </div>
                    <div className="mt-3 h-0.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#FF441B]/60 to-[#FF441B] rounded-full animate-pulse w-2/3" />
                    </div>
                  </div>
                )}

                {/* Failed */}
                {kitStatus === 'failed' && (
                  <div className="mt-4 p-4 bg-red-950/20 border border-red-900/30 rounded-xl space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
                      <p className="text-red-300 font-semibold text-sm">No se pudo generar</p>
                    </div>
                    <p className="text-zinc-500 text-xs leading-relaxed">
                      Una imagen no pudo generarse. Haz click en Regenerar para intentar de nuevo.
                    </p>
                    <button
                      onClick={() => doGenerate()}
                      className="flex items-center gap-1.5 text-xs font-bold text-white
                        bg-[#FF441B] hover:bg-[#e03a16] rounded-lg px-3.5 py-2.5 transition-colors min-h-[44px]"
                    >
                      <RefreshCw size={12} />
                      Regenerar
                    </button>
                  </div>
                )}

                {/* Budget exceeded */}
                {kitStatus === 'budget_exceeded' && (
                  <div className="mt-4 p-4 bg-amber-950/20 border border-amber-900/30 rounded-xl space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
                      <p className="text-amber-300 font-semibold text-sm">Sin saldo disponible</p>
                    </div>
                    <p className="text-zinc-500 text-xs leading-relaxed">
                      En este momento no tiene saldo disponible para generar nuevas imágenes.
                    </p>
                    <button
                      onClick={() => doGenerate(true)}
                      className="flex items-center gap-1.5 text-xs font-bold text-white
                        bg-[#FF441B] hover:bg-[#e03a16] rounded-lg px-3.5 py-2.5 transition-colors min-h-[44px]"
                    >
                      <RefreshCw size={12} />
                      Reintentar
                    </button>
                  </div>
                )}

                {/* Result */}
                {imageUrls && (
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-emerald-400" />
                      <p className="text-emerald-400 font-bold text-sm">Pack generado</p>
                    </div>

                    {/* Images grid — 3 col desktop, 2 col mobile, 1 col very small */}
                    <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3">
                      {(['feed', 'stories', 'whatsapp'] as const).map(v =>
                        imageUrls[v] ? (
                          <div key={v} className="group relative">
                            <div className="overflow-hidden rounded-xl ring-1 ring-white/8">
                              <img src={imageUrls[v]} alt={v}
                                className="w-full object-cover transition-transform duration-300 group-hover:scale-102" />
                            </div>
                            <p className="text-xs text-zinc-500 text-center mt-1.5 capitalize font-medium">{v}</p>
                          </div>
                        ) : null
                      )}
                    </div>

                    {kitId && (
                      <a href={`/api/kits/${kitId}/download`} download
                        className="flex items-center justify-center gap-2 text-sm text-white font-bold
                          bg-[#FF441B] hover:bg-[#e03a16] rounded-xl py-3.5 transition-colors
                          shadow-lg shadow-[#FF441B]/20 min-h-[44px]">
                        <Download size={15} />
                        Descargar ZIP
                      </a>
                    )}
                  </div>
                )}
              </div>
            )
          )}

          {/* HISTORY TAB */}
          {tab === 'history' && (
            <div className="p-4 md:p-8 max-w-3xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-5 rounded-full bg-[#FF441B]" />
                <h2 className="text-base font-black text-white">
                  {selected ? `Historial · ${selected.name}` : 'Últimos kits generados'}
                </h2>
              </div>

              {recentKits.length === 0 ? (
                <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-12 text-center">
                  <ImageIcon size={28} className="text-zinc-700 mx-auto mb-3" />
                  <p className="text-zinc-600 text-sm">Aún no hay kits generados</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentKits.map(k => (
                    <div key={k.id}
                      className="bg-zinc-900/50 border border-white/5 rounded-xl p-3.5 flex items-center gap-3.5
                        hover:border-white/8 transition-colors">
                      {/* Thumbnail */}
                      {k.imageUrls?.feed
                        ? <img src={k.imageUrls.feed} alt=""
                            className="w-12 h-12 md:w-14 md:h-14 rounded-lg object-cover flex-shrink-0 ring-1 ring-white/8" />
                        : <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                            <ImageIcon size={18} className="text-zinc-600" />
                          </div>
                      }

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-white truncate">{k.productName}</p>
                        <p className="text-xs text-zinc-500 truncate mt-0.5">{k.restaurant?.name}</p>
                        <p className="text-xs text-zinc-700 mt-0.5">
                          {new Date(k.createdAt).toLocaleDateString('es-CO', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </p>
                      </div>

                      {/* Status + actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0
                            ${(STATUS[k.status] ?? STATUS.pending).dot}`} />
                          <span className="text-xs text-zinc-500 hidden sm:block">
                            {(STATUS[k.status] ?? STATUS.pending).label}
                          </span>
                        </div>

                        {k.status === 'ready' && k.imageUrls && (
                          <a href={`/api/kits/${k.id}/download`} download
                            className="text-zinc-600 hover:text-[#FF441B] transition-colors p-1.5
                              hover:bg-[#FF441B]/10 rounded-lg min-h-[44px] flex items-center justify-center">
                            <Download size={15} />
                          </a>
                        )}
                        {(k.status === 'budget_exceeded' || k.status === 'failed') && (
                          <button
                            onClick={() => retryKit(k.id)}
                            className="text-zinc-600 hover:text-[#FF441B] transition-colors p-1.5
                              hover:bg-[#FF441B]/10 rounded-lg min-h-[44px] flex items-center justify-center"
                          >
                            <RefreshCw size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
