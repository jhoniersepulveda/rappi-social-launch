'use client'

import { useState, useRef } from 'react'
import { signOut } from 'next-auth/react'
import Image from 'next/image'
import {
  Upload, Zap, Download, CheckCircle, Loader2, X, FileText, AlertCircle, AlertTriangle, TrendingUp,
} from 'lucide-react'
import { useBudget } from '@/lib/hooks/useBudget'

interface Progress {
  status:    'running' | 'done' | 'error'
  total:     number
  completed: number
  current:   string
  errors:    string[]
}

interface CsvRow {
  restaurante: string
  logo_url: string
  producto: string
  foto_producto_url: string
  descripcion_producto: string
  texto_promocion: string
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
  const [csvFile,  setCsvFile]  = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [preview,  setPreview]  = useState<CsvRow[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [jobId,    setJobId]    = useState<string | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [starting, setStarting] = useState(false)
  const [error,    setError]    = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const esRef   = useRef<EventSource | null>(null)

  const { hasBudgetIssue, generatedThisMonth, monthlyLimit, nearLimit } = useBudget()

  function loadFile(f: File) {
    setCsvFile(f)
    setError('')
    setPreview([])
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const rows = parseCSVPreview(text)
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

    const es = new EventSource(`/api/admin/bulk/progress/${data.jobId}`)
    esRef.current = es
    es.onmessage = (e) => {
      const p = JSON.parse(e.data as string) as Progress
      setProgress(p)
      if (p.status === 'done' || p.status === 'error') es.close()
    }
    es.onerror = () => es.close()
  }

  const pct = progress && progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0

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

          {/* Counter card */}
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
                    className={`h-full rounded-full transition-all
                      ${nearLimit ? 'bg-red-500' : 'bg-[#FF441B]'}`}
                    style={{ width: `${Math.min(100, (generatedThisMonth / monthlyLimit) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Budget status card */}
          {hasBudgetIssue ? (
            <div className="bg-red-950/40 border border-red-800/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <AlertTriangle size={20} className="text-red-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-red-300 font-semibold text-sm">Sin saldo disponible</p>
                  <p className="text-red-600 text-xs mt-0.5">
                    Recarga el saldo en Google AI Studio para continuar.
                  </p>
                </div>
              </div>
              <a
                href="https://aistudio.google.com/billing"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full text-xs font-bold
                  text-white bg-[#FF441B] hover:bg-[#e03a16] rounded-lg px-3 py-2.5
                  transition-colors"
              >
                Recargar en Google AI Studio
              </a>
            </div>
          ) : nearLimit ? (
            <div className="bg-yellow-950/40 border border-yellow-800/60 rounded-2xl p-4 flex items-center gap-3">
              <AlertCircle size={20} className="text-yellow-400 flex-shrink-0" />
              <div>
                <p className="text-yellow-300 font-semibold text-sm">Saldo bajo</p>
                <p className="text-yellow-700 text-xs mt-0.5">
                  Quedan menos de 10 generaciones del límite mensual
                </p>
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
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={handleFileChange}
              />

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
                    <span className="text-[#555] font-normal ml-2">
                      ({preview.length} de {totalRows} filas)
                    </span>
                  </p>
                  {totalRows > 10 && (
                    <p className="text-[#555] text-xs">+{totalRows - 10} más no mostradas</p>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#333]">
                        {['Restaurante', 'Producto', 'Promoción', 'Foto'].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-[#888] font-semibold uppercase tracking-wider">
                            {h}
                          </th>
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
              </div>
              <p className="text-[#FF441B] font-mono font-black text-2xl">{pct}%</p>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-[#222] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500
                  ${progress.status === 'done' ? 'bg-green-500' : 'bg-[#FF441B]'}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#888]">
                <span className="text-white font-semibold">{progress.completed}</span>
                {' '}de{' '}
                <span className="text-white font-semibold">{progress.total}</span>
                {' '}packs
              </span>
              {progress.current && (
                <span className="text-[#555] text-xs truncate max-w-xs text-right">
                  {progress.current}
                </span>
              )}
            </div>

            {/* Per-row progress (visual pills) */}
            {progress.total > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: progress.total }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-6 rounded-full transition-colors duration-300
                      ${i < progress.completed ? 'bg-[#FF441B]' : 'bg-[#2a2a2a]'}`}
                  />
                ))}
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

      </div>
    </div>
  )
}
