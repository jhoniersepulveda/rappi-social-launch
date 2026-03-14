/* eslint-disable @next/next/no-img-element */
'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'

interface VerificationResult {
  status: string
  confidence: number
  detected: {
    rappiBrand: boolean
    restaurantName: boolean
    deepLink: boolean
  }
  notes: string
  needsConfirmation?: boolean
  flaggedForKAM?: boolean
  message: string
  incentiveExpiresAt?: string
}

interface VerificationUploadProps {
  kitId: string
  onVerified?: (result: VerificationResult) => void
}

export default function VerificationUpload({ kitId, onVerified }: VerificationUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) {
      setError('Solo se aceptan imágenes PNG, JPG o WEBP')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('El archivo es muy grande (máximo 10MB)')
      return
    }
    setError(null)
    setFile(f)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  async function handleUpload() {
    if (!file) return
    setIsUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('screenshot', file)

    try {
      const res = await fetch(`/api/kits/${kitId}/verify`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al verificar la publicación')
        return
      }

      setResult(data)
      onVerified?.(data)
    } catch {
      setError('Error de conexión. Inténtalo nuevamente.')
    } finally {
      setIsUploading(false)
    }
  }

  const statusColors: Record<string, string> = {
    approved: 'bg-green-100 border-green-400 text-green-800',
    pending: 'bg-yellow-100 border-yellow-400 text-yellow-800',
    rejected: 'bg-red-100 border-red-400 text-red-800',
  }

  if (result) {
    return (
      <div className={`border-2 rounded-xl p-6 ${statusColors[result.status] || 'bg-gray-100 border-gray-300'}`}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">
            {result.status === 'approved' ? '✅' : result.status === 'pending' ? '⏳' : '❌'}
          </span>
          <div>
            <p className="font-bold text-lg">{result.message}</p>
            <p className="text-sm opacity-75">Confianza: {Math.round(result.confidence * 100)}%</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          {Object.entries(result.detected).map(([key, detected]) => (
            <div key={key} className="flex items-center gap-2">
              <span>{detected ? '✓' : '✗'}</span>
              <span className="capitalize">{key === 'rappiBrand' ? 'Marca Rappi' : key === 'restaurantName' ? 'Nombre restaurante' : 'Deep link/QR'}</span>
            </div>
          ))}
        </div>

        {result.incentiveExpiresAt && (
          <p className="mt-4 text-sm font-medium">
            🚀 Boost de visibilidad activo hasta: {new Date(result.incentiveExpiresAt).toLocaleDateString('es-CO', { dateStyle: 'long' })}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors text-center ${
          isDragging ? 'border-rappi-orange bg-orange-50' : 'border-gray-300 hover:border-rappi-orange hover:bg-orange-50'
        }`}
      >
        {preview ? (
          <div className="space-y-3">
            <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded-lg object-contain" />
            <p className="text-sm text-gray-500">{file?.name}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-5xl">📸</div>
            <p className="font-medium text-gray-700">Arrastra tu captura de pantalla aquí</p>
            <p className="text-sm text-gray-400">o haz clic para seleccionar</p>
            <p className="text-xs text-gray-300">PNG, JPG, WEBP · Máximo 10MB</p>
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
      )}

      {file && !result && (
        <button
          onClick={handleUpload}
          disabled={isUploading}
          className="w-full bg-rappi-orange text-white font-bold py-3 rounded-xl hover:bg-[#e03a16] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isUploading ? '🔍 Verificando con IA...' : '✓ Verificar publicación'}
        </button>
      )}
    </div>
  )
}
