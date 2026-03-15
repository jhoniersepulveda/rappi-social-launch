'use client'

import { useState, useRef } from 'react'

type Status = 'idle' | 'loading' | 'done' | 'error'

export default function BulkGeneratePage() {
  const [restaurantsFile, setRestaurantsFile] = useState<File | null>(null)
  const [productsFile,    setProductsFile]    = useState<File | null>(null)
  const [status,  setStatus]  = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const restaurantsRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>
  const productsRef    = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>

  async function handleGenerate() {
    if (!restaurantsFile || !productsFile) {
      setMessage('Sube los dos archivos CSV antes de continuar.')
      return
    }

    setStatus('loading')
    setMessage('Generando packs... esto puede tomar varios minutos.')

    try {
      const form = new FormData()
      form.append('restaurants', restaurantsFile)
      form.append('products',    productsFile)

      const res = await fetch('/api/admin/bulk', { method: 'POST', body: form })

      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? `Error ${res.status}`)
      }

      const blob     = await res.blob()
      const url      = URL.createObjectURL(blob)
      const a        = document.createElement('a')
      a.href         = url
      a.download     = 'rappi-social-packs.zip'
      a.click()
      URL.revokeObjectURL(url)

      setStatus('done')
      setMessage('¡ZIP descargado exitosamente!')
    } catch (err) {
      setStatus('error')
      setMessage((err as Error).message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900">Generación masiva</h1>
          <p className="text-gray-500 mt-1">Sube los dos CSVs y genera packs para todos los productos</p>
        </div>

        {/* Templates */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex gap-4">
          <span className="text-orange-700 font-semibold text-sm">Plantillas:</span>
          <a href="/assets/restaurants-template.csv" download
            className="text-sm text-orange-600 underline hover:text-orange-800">
            restaurants-template.csv
          </a>
          <a href="/assets/products-template.csv" download
            className="text-sm text-orange-600 underline hover:text-orange-800">
            products-template.csv
          </a>
        </div>

        {/* Upload cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <UploadCard
            label="restaurants.csv"
            description="country, rappi_store_id, restaurant_name, category, logo_url, city"
            file={restaurantsFile}
            inputRef={restaurantsRef}
            accept=".csv"
            onChange={setRestaurantsFile}
          />
          <UploadCard
            label="products.csv"
            description="rappi_store_id, product_name, product_description, product_photo_url, price"
            file={productsFile}
            inputRef={productsRef}
            accept=".csv"
            onChange={setProductsFile}
          />
        </div>

        {/* ZIP structure preview */}
        <div className="bg-gray-100 rounded-xl p-4 mb-6 font-mono text-xs text-gray-600">
          <p className="font-bold text-gray-700 mb-2">Estructura del ZIP generado:</p>
          <pre>{`packs/
  el-corral-premium/
    hamburguesa-clasica/
      feed.png        (1080×1080)
      stories.png     (1080×1920)
      whatsapp.png    (1080×1350)
  freshii-colombia/
    wrap-mediterraneo/
      feed.png
      stories.png
      whatsapp.png`}</pre>
        </div>

        {/* Info boxes */}
        <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="font-semibold text-blue-800 mb-1">Con product_photo_url</p>
            <p className="text-blue-700">Gemini usa la foto como referencia para crear el anuncio</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="font-semibold text-purple-800 mb-1">Sin product_photo_url</p>
            <p className="text-purple-700">Gemini genera la foto desde product_description</p>
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={status === 'loading' || !restaurantsFile || !productsFile}
          className="w-full py-4 bg-[#FF441B] hover:bg-orange-600 disabled:bg-gray-300
            text-white font-black text-lg rounded-xl transition-colors"
        >
          {status === 'loading' ? '⏳ Generando packs...' : '⚡ Generar y descargar ZIP'}
        </button>

        {/* Status message */}
        {message && (
          <div className={`mt-4 p-4 rounded-xl text-sm font-medium ${
            status === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
            status === 'done'  ? 'bg-green-50 text-green-700 border border-green-200' :
                                 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {message}
          </div>
        )}

        {status === 'loading' && (
          <p className="text-center text-xs text-gray-400 mt-3">
            3 imágenes × producto × formato — puede tomar 2-5 min por restaurante
          </p>
        )}

      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Upload card component
// ---------------------------------------------------------------------------
function UploadCard({
  label, description, file, inputRef, accept, onChange,
}: {
  label: string
  description: string
  file: File | null
  inputRef: React.RefObject<HTMLInputElement>
  accept: string
  onChange: (f: File) => void
}) {
  return (
    <div
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer border-2 border-dashed rounded-xl p-5 transition-colors
        ${file ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-white hover:border-orange-400'}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => { if (e.target.files?.[0]) onChange(e.target.files[0]) }}
      />
      <p className="font-bold text-sm text-gray-800 mb-1">{label}</p>
      {file ? (
        <p className="text-xs text-green-600 font-medium">✓ {file.name}</p>
      ) : (
        <p className="text-xs text-gray-400">Haz clic para subir</p>
      )}
      <p className="text-xs text-gray-400 mt-2 font-mono leading-relaxed">{description}</p>
    </div>
  )
}
