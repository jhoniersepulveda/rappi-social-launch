/* eslint-disable @next/next/no-img-element */
'use client'

import { useState, useEffect } from 'react'
import ImagePreview from './ImagePreview'
import VerificationUpload from './VerificationUpload'

type WizardStep = 'product' | 'preview' | 'download'
type KitStatus = 'idle' | 'generating' | 'ready' | 'failed'
type Variant = 'feed' | 'stories' | 'whatsapp'

interface Product {
  name: string
  imageUrl: string
  price: number
}

interface Restaurant {
  id: string
  name: string
  slug: string
  logoUrl: string
  category: string
  topProducts: Product[]
  isBoosted: boolean
}

interface KitWizardProps {
  restaurant: Restaurant | null
  restaurants: Restaurant[]
}

const VARIANT_TABS: { key: Variant; label: string }[] = [
  { key: 'feed', label: 'Feed' },
  { key: 'stories', label: 'Stories' },
  { key: 'whatsapp', label: 'WhatsApp' },
]

export default function KitWizard({ restaurant: initialRestaurant, restaurants }: KitWizardProps) {
  const [step, setStep] = useState<WizardStep>('product')
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(initialRestaurant)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [manualProduct, setManualProduct] = useState('')
  const [promotionText, setPromotionText] = useState('')
  const [kitId, setKitId] = useState<string | null>(null)
  const [kitStatus, setKitStatus] = useState<KitStatus>('idle')
  const [imageUrls, setImageUrls] = useState<Record<Variant, string> | null>(null)
  const [activeVariant, setActiveVariant] = useState<Variant>('feed')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Poll for kit status every 2 seconds
  useEffect(() => {
    if (!kitId || kitStatus !== 'generating') return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/kits/${kitId}/status`)
        const data = await res.json()

        if (data.status === 'ready') {
          setImageUrls(data.imageUrls)
          setKitStatus('ready')
          setStep('preview')
        } else if (data.status === 'failed') {
          setKitStatus('failed')
          setError('La generación falló. Inténtalo nuevamente.')
        }
      } catch {
        // Network error — keep polling
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [kitId, kitStatus])

  const productName = selectedProduct?.name || manualProduct
  const productImage = selectedProduct?.imageUrl || 'https://via.placeholder.com/400x400/FF441B/FFF?text=Producto'

  async function handleGenerate() {
    if (!selectedRestaurant || !productName || !promotionText) return
    setError(null)
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/kits/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: selectedRestaurant.id,
          productName,
          productImage,
          promotionText,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error?.message || 'Error al iniciar la generación')
        return
      }

      setKitId(data.kitId)
      if (data.imageUrls) {
        setImageUrls(data.imageUrls)
        setKitStatus('ready')
      } else {
        setKitStatus('generating')
      }
      setStep('preview')
    } catch {
      setError('Error de conexión. Inténtalo nuevamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRegenerate() {
    if (!selectedRestaurant || !productName || !promotionText) return
    setImageUrls(null)
    setKitStatus('generating')
    setError(null)

    const res = await fetch('/api/kits/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: selectedRestaurant.id,
        productName,
        productImage,
        promotionText,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setKitId(data.kitId)
      if (data.imageUrls) {
        setImageUrls(data.imageUrls)
        setKitStatus('ready')
      } else {
        setKitStatus('generating')
      }
    } else {
      setError('No se pudo regenerar el kit')
      setKitStatus('ready')
    }
  }

  // Step 1: Product selection
  if (step === 'product') {
    return (
      <div className="max-w-2xl mx-auto space-y-6 p-6">
        {/* Step indicator */}
        <StepIndicator current={1} />

        {/* Restaurant selector (if no restaurant pre-selected) */}
        {!selectedRestaurant && restaurants.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-bold text-lg mb-3 text-gray-800">Selecciona tu restaurante</h2>
            <div className="grid gap-3">
              {restaurants.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRestaurant(r)}
                  className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-rappi-orange hover:bg-orange-50 transition-all text-left"
                >
                  <img src={r.logoUrl} alt={r.name} className="w-12 h-12 rounded-full object-cover" />
                  <div>
                    <p className="font-semibold text-gray-800">{r.name}</p>
                    <p className="text-sm text-gray-500">{r.category}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedRestaurant && (
          <>
            {/* Restaurant info */}
            <div className="bg-rappi-orange text-white rounded-2xl p-5 flex items-center gap-4">
              <img src={selectedRestaurant.logoUrl} alt={selectedRestaurant.name} className="w-14 h-14 rounded-full bg-white p-1 object-cover" />
              <div>
                <p className="text-lg font-bold">{selectedRestaurant.name}</p>
                <p className="text-sm text-orange-100">{selectedRestaurant.category}</p>
              </div>
            </div>

            {/* Product selection */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-bold text-lg mb-4 text-gray-800">¿Qué producto quieres promocionar?</h2>
              <div className="grid gap-3 mb-4">
                {(selectedRestaurant.topProducts as Product[]).map((product) => (
                  <button
                    key={product.name}
                    onClick={() => { setSelectedProduct(product); setManualProduct('') }}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                      selectedProduct?.name === product.name
                        ? 'border-rappi-orange bg-orange-50'
                        : 'border-gray-200 hover:border-rappi-orange hover:bg-orange-50'
                    }`}
                  >
                    <img src={product.imageUrl} alt={product.name} className="w-14 h-14 rounded-lg object-cover bg-gray-100" />
                    <div>
                      <p className="font-semibold text-gray-800">{product.name}</p>
                      <p className="text-sm text-gray-500">
                        ${product.price.toLocaleString('es-CO')}
                      </p>
                    </div>
                    {selectedProduct?.name === product.name && (
                      <span className="ml-auto text-rappi-orange font-bold text-xl">✓</span>
                    )}
                  </button>
                ))}
              </div>

              <p className="text-sm text-gray-500 mb-2">O ingresa un producto manualmente:</p>
              <input
                type="text"
                placeholder="Ej: Hamburguesa especial de la casa"
                value={manualProduct}
                onChange={(e) => { setManualProduct(e.target.value); setSelectedProduct(null) }}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-rappi-orange outline-none transition-colors"
              />
            </div>

            {/* Promotion text */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-bold text-lg mb-2 text-gray-800">Texto de promoción</h2>
              <p className="text-sm text-gray-500 mb-3">Aparecerá en la franja inferior de tu pieza gráfica</p>
              <textarea
                value={promotionText}
                onChange={(e) => setPromotionText(e.target.value.slice(0, 80))}
                placeholder="Ej: 20% de descuento este fin de semana 🔥"
                rows={3}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-rappi-orange outline-none transition-colors resize-none"
              />
              <p className={`text-xs mt-1 text-right ${promotionText.length >= 75 ? 'text-rappi-orange' : 'text-gray-400'}`}>
                {promotionText.length}/80
              </p>
            </div>

            {error && <p className="text-red-600 bg-red-50 px-4 py-3 rounded-xl text-sm">{error}</p>}

            <button
              onClick={handleGenerate}
              disabled={!productName || !promotionText || isSubmitting}
              className="w-full bg-rappi-orange text-white font-bold py-4 rounded-2xl text-lg hover:bg-[#e03a16] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
            >
              {isSubmitting ? '🎨 Generando con IA (30-90s)...' : '✨ Generar kit con IA →'}
            </button>
          </>
        )}
      </div>
    )
  }

  // Step 2: Preview
  if (step === 'preview') {
    return (
      <div className="max-w-2xl mx-auto space-y-6 p-6">
        <StepIndicator current={2} />

        {kitStatus === 'generating' && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center space-y-4">
            <div className="text-5xl animate-spin inline-block">🎨</div>
            <div>
              <p className="font-bold text-lg text-gray-800">Generando tu kit con IA...</p>
              <p className="text-sm text-gray-500 mt-1">Esto puede tomar 30-60 segundos</p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-rappi-orange h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {kitStatus === 'failed' && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 text-center">
            <p className="text-red-700 font-bold mb-3">❌ {error}</p>
            <button
              onClick={() => { setKitStatus('idle'); setStep('product') }}
              className="bg-rappi-orange text-white px-6 py-3 rounded-xl font-semibold"
            >
              Volver a intentar
            </button>
          </div>
        )}

        {kitStatus === 'ready' && imageUrls && (
          <>
            {/* Variant tabs */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex border-b border-gray-100">
                {VARIANT_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveVariant(tab.key)}
                    className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                      activeVariant === tab.key
                        ? 'bg-rappi-orange text-white'
                        : 'text-gray-600 hover:bg-orange-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="p-6">
                {imageUrls[activeVariant] && (
                  <ImagePreview
                    url={imageUrls[activeVariant]}
                    variant={activeVariant}
                    productName={productName}
                  />
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRegenerate}
                className="flex-1 border-2 border-rappi-orange text-rappi-orange font-bold py-3 rounded-2xl hover:bg-orange-50 transition-colors"
              >
                🔄 Regenerar
              </button>
              <button
                onClick={() => setStep('download')}
                className="flex-2 bg-rappi-orange text-white font-bold py-3 px-8 rounded-2xl hover:bg-[#e03a16] transition-colors"
              >
                Continuar →
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // Step 3: Download
  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <StepIndicator current={3} />

      <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 text-center">
        <div className="text-5xl mb-3">🎉</div>
        <h2 className="text-xl font-bold text-green-800">¡Tu kit está listo!</h2>
        <p className="text-green-600 mt-1">3 piezas gráficas + guía de publicación</p>
      </div>

      <div className="grid gap-4">
        {kitId && (
          <>
            <a
              href={`/api/kits/${kitId}/download`}
              download
              className="flex items-center gap-4 bg-rappi-orange text-white p-5 rounded-2xl hover:bg-[#e03a16] transition-colors font-semibold"
            >
              <span className="text-2xl">📦</span>
              <div>
                <p className="font-bold">Descargar ZIP</p>
                <p className="text-sm text-orange-100">Feed + Stories + WhatsApp + Guía PDF</p>
              </div>
            </a>
          </>
        )}
      </div>

      {/* Verification section */}
      {kitId && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div>
            <h3 className="font-bold text-lg text-gray-800">¿Ya publicaste tu kit? 📱</h3>
            <p className="text-sm text-gray-500 mt-1">
              Sube una captura de pantalla para verificar tu publicación y activar tus incentivos en Rappi
            </p>
          </div>
          <VerificationUpload kitId={kitId} />
        </div>
      )}

      <a
        href="/dashboard"
        className="block text-center text-rappi-orange font-semibold py-3 hover:underline"
      >
        Ver historial de kits →
      </a>
    </div>
  )
}

function StepIndicator({ current }: { current: number }) {
  const steps = [
    { n: 1, label: 'Producto' },
    { n: 2, label: 'Preview' },
    { n: 3, label: 'Descargar' },
  ]

  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                s.n < current
                  ? 'bg-rappi-orange text-white'
                  : s.n === current
                  ? 'bg-rappi-orange text-white ring-4 ring-orange-100'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {s.n < current ? '✓' : s.n}
            </div>
            <span className={`text-xs font-medium ${s.n === current ? 'text-rappi-orange' : 'text-gray-400'}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-16 h-0.5 mx-2 mb-5 ${s.n < current ? 'bg-rappi-orange' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}
