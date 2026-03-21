'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import Image from 'next/image'
import {
  Upload, Zap, Download, CheckCircle, Loader2, X, FileText,
  AlertCircle, AlertTriangle, TrendingUp, ChevronDown, ChevronRight,
  RefreshCw, Clock, ImageIcon,
} from 'lucide-react'
import { useBudget } from '@/lib/hooks/useBudget'

interface Progress {
  status:    'running' | 'done' | 'error' | 'budget_paused'
  total:     number
  totalRows: number
  completed: number
  current:   string
  errors:    string[]
  batchId?:  string
}

interface CsvRow {
  restaurante:          string
  logo_url:             string
  producto:             string
  foto_producto_url:    string
  descripcion_producto: string
  texto_promocion:      string
}

interface KitPreview {
  restaurant: string
  product:    string
  feedUrl:    string
}

interface BatchRecord {
  id:         string
  createdAt:  string
  status:     string
  totalRows:  number
  successful: number
  failed:     number
  zipUrl:     string | null
  previews:   KitPreview[] | null
  errors:     string[] | null
}

function parseCSVPreview(text: string): CsvRow[] {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const rows: CsvRow[] = []
  for (let i = 1; i < Math.min(lines.length, 11); i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    if (cols[0]) rows.push({
      restaurante:          cols[0] ?? '',
      logo_url:             cols[1] ?? '',
      producto:             cols[2] ?? '',
      foto_producto_url:    cols[3] ?? '',
      descripcion_producto: cols[4] ?? '',
      texto_promocion:      cols[5] ?? '',
    })
  }
  return rows
}

export default function AdminDashboard() {
  const [csvFile,   setCsvFile]   = useState<File | null>(null)
  const [dragging,  setDragging]  = useState(false)
  const [preview,   setPreview]   = useState<CsvRow[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [jobId,     setJobId]     = useState<string | null>(null)
  const [progress,  setProgress]  = useState<Progress | null>(null)
  const [starting,  setStarting]  = useState(false)
  const [resuming,  setResuming]  = useState(false)
  const [error,     setError]     = useState('')

  // History
  const [batches,      setBatches]      = useState<BatchRecord[]>([])
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const esRef   = useRef<EventSource | null>(null)

  const { hasBudgetIssue, generatedThisMonth, monthlyLimit, nearLimit } = useBudget()

  // Load history on mount
  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    setLoadingHistory(true)
    try {
      const res  = await fetch('/api/admin/bulk/batches')
      const data = await res.json() as BatchRecord[]
      setBatches(Array.isArray(data) ? data : [])
    } catch { /* non-critical */ }
    finally { setLoadingHistory(false) }
  }

  function loadFile(f: File) {
    setCsvFile(f)
    setError('')
    setPreview([])
    const reader = new FileReader()
    reader.onload = ev => {
      const text  = ev.target?.result as string
      const rows  = parseCSVPreview(text)
      const total = text.trim().split('\n').filter(Boolean).length - 1
      setPreview(rows)
      setTotalRows(Math.max(total, 0))
    }
    reader.readAsText(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.xlsx'))) loadFile(f)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) loadFile(f)
  }

  function resetAll() {
    setCsvFile(null)
    setPreview([])
    setTotalRows(0)
    setJobId(null)
    setProgress(null)
    setError('')
    esRef.current?.close()
  }

  function subscribeToJob(jId: string) {
    esRef.current?.close()
    const es = new EventSource(`/api/admin/bulk/progress/${jId}`)
    esRef.current = es
    es.onmessage = (e) => {
      const p = JSON.parse(e.data as string) as Progress
      setProgress(p)
      if (p.status === 'done' || p.status === 'error' || p.status === 'budget_paused') {
        es.close()
        if (p.status === 'done') loadHistory() // refresh history after completion
      }
    }
    es.onerror = () => es.close()
  }

  async function handleStart() {
    if (!csvFile) return
    setStarting(true)
    setError('')

    const form = new FormData()
    form.append('csv', csvFile)

    const res  = await fetch('/api/admin/bulk/start', { method: 'POST', body: form })
    const data = await res.json() as { jobId?: string; error?: string }

    if (!res.ok || !data.jobId) {
      setError(data.error ?? 'Error al iniciar el proceso')
      setStarting(false)
      return
    }

    setJobId(data.jobId)
    setStarting(false)
    subscribeToJob(data.jobId)
  }

  async function handleResume() {
    if (!jobId) return
    setResuming(true)
    const res  = await fetch(`/api/admin/bulk/resume/${jobId}`, { method: 'POST' })
    const data = await res.json() as { jobId?: string; error?: string }

    if (!res.ok || !data.jobId) {
      setError(data.error ?? 'Error al continuar')
      setResuming(false)
      return
    }

    setJobId(data.jobId)
    setProgress(null)
    setResuming(false)
    subscribeToJob(data.jobId)
  }

  const completedRows = progress ? Math.floor(progress.completed / 3) : 0
  const pct = progress && progress.totalRows > 0
    ? Math.round((completedRows / progress.totalRows) * 100)
    : 0

  const showPills = (progress?.totalRows ?? 0) <= 80

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col">
      {/* Header */}
      <header className="h-14 bg-[#111] border-b border-white/6 flex items-center px-6 gap-3 flex-shrink-0">
        <Image src="/assets/rappi/rappi-logo.svg" alt="Rappi" width={72} height={30} />
        <span className="text-[#333] text-sm">|</span>
        <span className="text-[#CCCCCC] text-sm font-semibold">Admin — Generación masiva</span>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="ml-auto text-xs text-[#555] hover:text-[#888] transition-colors"
        >
          Salir
        </button>
      </header>

      <div className="max-w-3xl mx-auto w-full p-8 space-y-6">

        {/* Title */}
        <div>
          <h1 className="text-2xl font-black text-white">Generación masiva por CSV</h1>
          <p className="text-[#888] text-sm mt-1">
            Sube un CSV y genera packs para todos los productos en batch
          </p>
        </div>

        {/* Generation counter + budget alerts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#FF441B]/15 flex items-center justify-center flex-shrink-0">
              <TrendingUp size={18} className="text-[#FF441B]" />
            </div>
            <div>
              <p className="text-[#888] text-xs uppercase tracking-widest">Generadas este mes</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-white">{generatedThisMonth}</span>
                {monthlyLimit > 0 && (
                  <span className="text-[#555] text-sm">/ {monthlyLimit}</span>
                )}
              </div>
              {monthlyLimit > 0 && (
                <div className="mt-1.5 h-1 bg-[#222] rounded-full w-32 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${nearLimit ? 'bg-red-500' : 'bg-[#FF441B]'}`}
                    style={{ width: `${Math.min(100, (generatedThisMonth / monthlyLimit) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {hasBudgetIssue ? (
            <div className="bg-red-950/40 border border-red-800/60 rounded-2xl p-4 flex items-center gap-3">
              <AlertTriangle size={20} className="text-red-400 flex-shrink-0" />
              <div>
                <p className="text-red-300 font-semibold text-sm">Sin saldo disponible</p>
                <p className="text-red-600 text-xs mt-0.5">Recarga el saldo para continuar.</p>
              </div>
            </div>
          ) : nearLimit ? (
            <div className="bg-yellow-950/40 border border-yellow-800/60 rounded-2xl p-4 flex items-center gap-3">
              <AlertCircle size={20} className="text-yellow-400 flex-shrink-0" />
              <div>
                <p className="text-yellow-300 font-semibold text-sm">Saldo bajo</p>
                <p className="text-yellow-700 text-xs mt-0.5">Quedan menos de 10 generaciones del límite mensual</p>
              </div>
            </div>
          ) : (
            <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle size={20} className="text-green-400 flex-shrink-0" />
              <div>
                <p className="text-green-400 font-semibold text-sm">IA disponible</p>
                <p className="text-[#555] text-xs mt-0.5">Gemini listo para generar</p>
              </div>
            </div>
          )}
        </div>

        {/* Template card */}
        <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#222] flex items-center justify-center flex-shrink-0">
            <FileText size={18} className="text-[#888]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold">Formato requerido</p>
            <p className="text-[#555] text-xs font-mono mt-0.5 truncate">
              restaurante, logo_url, producto, foto_producto_url, descripcion_producto, texto_promocion
            </p>
          </div>
          <a
            href="/assets/admin-bulk-template.csv"
            download
            className="flex items-center gap-1.5 text-xs text-[#FF441B] border border-[#FF441B]/40
              px-3 py-2 rounded-lg hover:bg-[#FF441B]/10 transition-colors flex-shrink-0 font-semibold"
          >
            <Download size={13} />
            Plantilla
          </a>
        </div>

        {/* Drop zone — only when no progress yet */}
        {!progress && (
          <>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`cursor-pointer border-2 border-dashed rounded-2xl p-10 text-center transition-all
                ${dragging
                  ? 'border-[#FF441B] bg-[#FF441B]/8'
                  : csvFile
                    ? 'border-[#00C853]/40 bg-[#00C853]/5'
                    : 'border-[#333] hover:border-[#555] bg-[#1a1a1a]'}`}
            >
              <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleFileChange} />

              {csvFile ? (
                <div>
                  <CheckCircle size={36} className="text-[#00C853] mx-auto mb-3" />
                  <p className="font-bold text-white text-base">{csvFile.name}</p>
                  <p className="text-[#888] text-sm mt-1">
                    {(csvFile.size / 1024).toFixed(1)} KB · {totalRows} filas
                  </p>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); resetAll() }}
                    className="mt-3 text-xs text-[#555] hover:text-[#888] transition-colors"
                  >
                    Cambiar archivo
                  </button>
                </div>
              ) : (
                <div>
                  <Upload size={36} className="text-[#444] mx-auto mb-3" />
                  <p className="text-white font-semibold">Arrastra tu CSV aquí</p>
                  <p className="text-[#555] text-sm mt-1">o haz clic para seleccionar</p>
                  <p className="text-[#444] text-xs mt-3">CSV o Excel · Sin límite de filas</p>
                </div>
              )}
            </div>

            {/* CSV preview table */}
            {preview.length > 0 && (
              <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#333] flex items-center justify-between">
                  <p className="text-[#CCCCCC] text-sm font-semibold">
                    Vista previa
                    <span className="text-[#555] font-normal ml-2">({preview.length} de {totalRows} filas)</span>
                  </p>
                  {totalRows > 10 && <p className="text-[#555] text-xs">+{totalRows - 10} más no mostradas</p>}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#333]">
                        {['Restaurante', 'Producto', 'Promoción', 'Foto'].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-[#888] font-semibold uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-b border-[#222] hover:bg-[#222] transition-colors">
                          <td className="px-4 py-2.5 text-white font-medium">{row.restaurante}</td>
                          <td className="px-4 py-2.5 text-[#CCCCCC]">{row.producto || <span className="text-[#444]">—</span>}</td>
                          <td className="px-4 py-2.5 text-[#CCCCCC]">{row.texto_promocion || <span className="text-[#444]">—</span>}</td>
                          <td className="px-4 py-2.5">
                            {row.foto_producto_url
                              ? <span className="text-[#00C853]">Sí</span>
                              : <span className="text-[#888]">IA genera</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-4 bg-red-950/40 border border-red-800/40 rounded-xl">
                <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleStart}
              disabled={!csvFile || starting}
              className="w-full py-4 bg-[#FF441B] hover:bg-[#e03a16]
                disabled:bg-[#2a2a2a] disabled:text-[#555]
                font-black text-base rounded-2xl transition-colors
                flex items-center justify-center gap-2"
            >
              {starting
                ? <><Loader2 size={18} className="animate-spin" /> Iniciando...</>
                : <><Zap size={18} /> Generar {totalRows > 0 ? `${totalRows} packs` : 'packs'}</>
              }
            </button>
          </>
        )}

        {/* Progress */}
        {progress && (
          <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-6 space-y-5">

            {/* Status header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {progress.status === 'running' && (
                  <><Loader2 size={16} className="animate-spin text-[#FF441B]" />
                    <p className="font-bold text-white">Procesando...</p></>
                )}
                {progress.status === 'done' && (
                  <><CheckCircle size={16} className="text-green-400" />
                    <p className="font-bold text-green-400">Completado</p></>
                )}
                {progress.status === 'error' && (
                  <><AlertCircle size={16} className="text-red-400" />
                    <p className="font-bold text-red-400">Error</p></>
                )}
                {progress.status === 'budget_paused' && (
                  <><AlertTriangle size={16} className="text-yellow-400" />
                    <p className="font-bold text-yellow-400">Pausado — saldo agotado</p></>
                )}
              </div>
              <p className="text-[#FF441B] font-mono font-black text-2xl">{pct}%</p>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-[#222] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500
                  ${progress.status === 'done'
                    ? 'bg-green-500'
                    : progress.status === 'budget_paused'
                      ? 'bg-yellow-500'
                      : 'bg-[#FF441B]'}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#888]">
                <span className="text-white font-semibold">{completedRows}</span>
                {' '}de{' '}
                <span className="text-white font-semibold">{progress.totalRows}</span>
                {' '}restaurantes
              </span>
              {progress.current && (
                <span className="text-[#555] text-xs truncate max-w-xs text-right">{progress.current}</span>
              )}
            </div>

            {/* Per-row progress pills (only for small batches) */}
            {showPills && progress.totalRows > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: progress.totalRows }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-6 rounded-full transition-colors duration-300
                      ${i < completedRows ? 'bg-[#FF441B]' : 'bg-[#2a2a2a]'}`}
                  />
                ))}
              </div>
            )}

            {/* Budget paused message */}
            {progress.status === 'budget_paused' && (
              <div className="bg-yellow-950/30 border border-yellow-800/40 rounded-xl p-4 space-y-3">
                <p className="text-yellow-300 text-sm leading-relaxed">
                  Se agotó el saldo disponible. Se generaron{' '}
                  <span className="font-bold">{completedRows}</span> de{' '}
                  <span className="font-bold">{progress.totalRows}</span> kits.
                  Recarga el saldo y continúa desde donde quedó.
                </p>
                <button
                  onClick={handleResume}
                  disabled={resuming}
                  className="flex items-center gap-1.5 text-xs font-bold text-white
                    bg-[#FF441B] hover:bg-[#e03a16] disabled:bg-[#444]
                    rounded-lg px-4 py-2.5 transition-colors"
                >
                  {resuming
                    ? <><Loader2 size={12} className="animate-spin" /> Continuando...</>
                    : <><RefreshCw size={12} /> Continuar desde el kit {completedRows + 1}</>
                  }
                </button>
              </div>
            )}

            {/* Errors */}
            {progress.errors.length > 0 && (
              <div className="bg-red-950/30 border border-red-800/30 rounded-xl p-3">
                <p className="text-red-400 text-xs font-semibold mb-1.5">
                  {progress.errors.length} error(es):
                </p>
                <ul className="text-red-500/80 text-xs space-y-1">
                  {progress.errors.slice(0, 5).map((e, i) => (
                    <li key={i} className="truncate">· {e}</li>
                  ))}
                  {progress.errors.length > 5 && (
                    <li className="text-red-700">+{progress.errors.length - 5} más</li>
                  )}
                </ul>
              </div>
            )}

            {progress.status === 'done' && (
              <button
                onClick={() => window.open(`/api/admin/bulk/download/${jobId}`, '_blank')}
                className="w-full py-4 bg-[#FF441B] hover:bg-[#e03a16]
                  font-black rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Descargar ZIP con todos los packs
              </button>
            )}

            {progress.status !== 'running' && (
              <button
                onClick={resetAll}
                className="w-full py-2.5 text-[#555] hover:text-[#888] text-sm
                  border border-[#222] rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <X size={14} />
                Nueva generación
              </button>
            )}
          </div>
        )}

        {/* ── HISTORIAL DE GENERACIONES MASIVAS ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-white">Historial de generaciones masivas</h2>
            <button
              onClick={loadHistory}
              disabled={loadingHistory}
              className="text-xs text-[#555] hover:text-[#888] transition-colors flex items-center gap-1"
            >
              <RefreshCw size={12} className={loadingHistory ? 'animate-spin' : ''} />
              Actualizar
            </button>
          </div>

          {loadingHistory && batches.length === 0 && (
            <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-8 text-center">
              <Loader2 size={20} className="animate-spin text-[#555] mx-auto" />
            </div>
          )}

          {!loadingHistory && batches.length === 0 && (
            <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-8 text-center">
              <Clock size={28} className="text-[#333] mx-auto mb-2" />
              <p className="text-[#555] text-sm">Aún no hay generaciones masivas</p>
            </div>
          )}

          {batches.map(batch => {
            const isExpanded = expandedBatch === batch.id
            const date = new Date(batch.createdAt).toLocaleString('es-CO', {
              day:    '2-digit',
              month:  'short',
              year:   'numeric',
              hour:   '2-digit',
              minute: '2-digit',
            })
            const previews = (batch.previews ?? []) as KitPreview[]

            return (
              <div key={batch.id} className="bg-[#1a1a1a] border border-[#333] rounded-2xl overflow-hidden">
                {/* Batch header row */}
                <button
                  onClick={() => setExpandedBatch(isExpanded ? null : batch.id)}
                  className="w-full px-5 py-4 flex items-center gap-4 hover:bg-[#222] transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-semibold text-sm">{date}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${batch.status === 'done'    ? 'bg-green-950 text-green-400'
                        : batch.status === 'partial' ? 'bg-yellow-950 text-yellow-400'
                        :                              'bg-red-950 text-red-400'}`}>
                        {batch.status === 'done' ? 'Completo' : batch.status === 'partial' ? 'Parcial' : 'Error'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-[#888]">
                      <span>{batch.totalRows} restaurantes</span>
                      <span className="text-green-400">{batch.successful} exitosos</span>
                      {batch.failed > 0 && <span className="text-red-400">{batch.failed} fallidos</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {batch.zipUrl && (
                      <a
                        href={batch.zipUrl}
                        download
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs text-[#FF441B] border border-[#FF441B]/40
                          px-2.5 py-1.5 rounded-lg hover:bg-[#FF441B]/10 transition-colors font-semibold"
                      >
                        <Download size={12} />
                        ZIP
                      </a>
                    )}
                    {isExpanded
                      ? <ChevronDown size={16} className="text-[#555]" />
                      : <ChevronRight size={16} className="text-[#555]" />}
                  </div>
                </button>

                {/* Expanded: kit previews */}
                {isExpanded && (
                  <div className="border-t border-[#333] p-5">
                    {previews.length === 0 ? (
                      <p className="text-[#555] text-sm text-center py-4">Sin imágenes guardadas para este batch</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {previews.map((kit, i) => (
                          <div key={i} className="space-y-1.5">
                            <div className="relative aspect-square rounded-xl overflow-hidden bg-[#222] border border-[#333]">
                              {kit.feedUrl ? (
                                <img
                                  src={kit.feedUrl}
                                  alt={kit.product}
                                  className="w-full h-full object-cover"
                                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full">
                                  <ImageIcon size={20} className="text-[#444]" />
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-white font-medium truncate leading-tight">{kit.product}</p>
                            <p className="text-xs text-[#888] truncate">{kit.restaurant}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Error list if any */}
                    {batch.errors && (batch.errors as string[]).length > 0 && (
                      <div className="mt-4 bg-red-950/20 border border-red-800/20 rounded-xl p-3">
                        <p className="text-red-400 text-xs font-semibold mb-1.5">
                          {(batch.errors as string[]).length} error(es) en este batch:
                        </p>
                        <ul className="text-red-500/70 text-xs space-y-0.5">
                          {(batch.errors as string[]).slice(0, 5).map((e, i) => (
                            <li key={i} className="truncate">· {e}</li>
                          ))}
                          {(batch.errors as string[]).length > 5 && (
                            <li className="text-red-700">+{(batch.errors as string[]).length - 5} más</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
