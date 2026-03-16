import Replicate from 'replicate'
import sharp from 'sharp'
import { BudgetExceededError } from '@/lib/errors'

const GEMINI_MODEL   = 'gemini-3.1-flash-image-preview'
const IDEOGRAM_MODEL = 'ideogram-ai/ideogram-v2'

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/**
 * True only when Gemini signals the account has genuinely run out of credit.
 * A plain 429 with "Too Many Requests" / "rate limit" is NOT a budget error —
 * it is a temporary throttle that should be retried.
 */
/**
 * Returns true ONLY for genuine account-level billing exhaustion.
 * Plain 429 rate limits are never budget errors — they should be retried.
 */
function isBudgetError(status: number, message: string): boolean {
  const lower = message.toLowerCase()

  // RESOURCE_EXHAUSTED (gRPC code 8) AND a billing/quota phrase
  if (message.includes('RESOURCE_EXHAUSTED') && lower.includes('quota')) return true

  // Explicit billing phrases regardless of status code
  if (lower.includes('spending cap'))              return true   // "exceeded its spending cap"
  if (lower.includes('insufficient funds'))        return true
  if (lower.includes('payment required'))          return true
  if (lower.includes('billing account disabled'))  return true

  // Everything else — including bare 429, "too many requests", "rate limit" — is NOT a budget error
  return false
}

/**
 * Returns true for temporary rate-limit throttling — safe to retry with backoff.
 * Any 429 that is not a confirmed budget error counts as rate limit.
 */
function isRateLimitError(status: number, message: string): boolean {
  if (status !== 429) return false
  return !isBudgetError(status, message)
}

// ---------------------------------------------------------------------------
// Fallback: naranja sólido con nombre del producto
// ---------------------------------------------------------------------------
async function orangeFallback(productName: string): Promise<string> {
  const display  = productName.length > 24 ? productName.substring(0, 23) + '…' : productName
  const fontSize = display.length > 16 ? 52 : 64
  const svg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" fill="#FF441B"/>
    <text x="512" y="512" font-family="Arial Black,Arial,sans-serif" font-size="${fontSize}"
      font-weight="900" fill="white" text-anchor="middle" dominant-baseline="central">${display}</text>
  </svg>`
  const buf = await sharp(Buffer.from(svg)).png().toBuffer()
  return `data:image/png;base64,${buf.toString('base64')}`
}

// ---------------------------------------------------------------------------
// Ideogram (Replicate) — fallback cuando Gemini falla por razones técnicas
// (NO se usa como fallback de errores de presupuesto)
// ---------------------------------------------------------------------------
async function generateWithIdeogram(prompt: string, productName: string): Promise<string> {
  const apiKey = process.env.REPLICATE_API_KEY
  if (!apiKey || apiKey === 'r8_xxx') {
    console.warn('[Ideogram] No REPLICATE_API_KEY, usando fallback naranja')
    return orangeFallback(productName)
  }

  console.log('[Ideogram] Usando Replicate como fallback técnico...')
  const replicate = new Replicate({ auth: apiKey })

  const output = await replicate.run(IDEOGRAM_MODEL, {
    input: {
      prompt,
      aspect_ratio:        '1:1',
      style_type:          'Design',
      magic_prompt_option: 'Off',
    },
  })

  const first = Array.isArray(output) ? output[0] : output
  if (!first) throw new Error('Ideogram returned no output')

  if (typeof first === 'object' && 'readable' in (first as object)) {
    const reader = (first as ReadableStream).getReader()
    const chunks: Uint8Array[] = []
    let done = false
    while (!done) {
      const { value, done: d } = await reader.read()
      if (value) chunks.push(value)
      done = d
    }
    const buf = Buffer.concat(chunks.map(c => Buffer.from(c)))
    return `data:image/png;base64,${buf.toString('base64')}`
  }

  const url = String(first)
  const res  = await fetch(url)
  if (!res.ok) throw new Error(`Ideogram download failed: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return `data:image/png;base64,${buf.toString('base64')}`
}

// ---------------------------------------------------------------------------
// Gemini con retry — soporta imagen de referencia opcional
// Lanza BudgetExceededError si detecta error de cuota/billing (sin fallback)
// ---------------------------------------------------------------------------
export async function generateImage(
  prompt: string,
  productName: string,
  referenceImageUrl?: string,
  productDescription?: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn('[Gemini] No GEMINI_API_KEY, usando Ideogram')
    return generateWithIdeogram(prompt, productName)
  }

  const productEmphasis =
    `The MAIN SUBJECT and HERO of this advertisement is: ${productName}\n` +
    `This is the most important element - ${productName} must be clearly visible and recognizable as the central focus of the image.\n` +
    `Product description: ${productDescription ?? productName}\n` +
    `DO NOT replace ${productName} with any other food item.\n\n`

  type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } }
  const parts: GeminiPart[] = [{ text: productEmphasis + prompt }]

  if (referenceImageUrl) {
    try {
      console.log(`[Gemini] Cargando imagen de referencia: ${referenceImageUrl}`)
      const imgRes = await fetch(referenceImageUrl, { signal: AbortSignal.timeout(10000) })
      if (imgRes.ok) {
        const imgBuf = Buffer.from(await imgRes.arrayBuffer())
        const mime   = imgRes.headers.get('content-type') || 'image/jpeg'
        parts.push({ inline_data: { mime_type: mime, data: imgBuf.toString('base64') } })
        console.log('[Gemini] Imagen de referencia adjuntada')
      }
    } catch {
      console.warn('[Gemini] No se pudo cargar la imagen de referencia, continuando sin ella')
    }
  }

  const url  = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`
  const body = {
    contents: [{ parts }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
  }

  console.log(`[Gemini] Modelo: ${GEMINI_MODEL}`)
  console.log(`[Gemini] Prompt: ${prompt.substring(0, 120)}...`)

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })

      if (!res.ok) {
        const payload = await res.json() as { error?: { message?: string; code?: number } }
        const errMsg  = payload.error?.message ?? res.statusText

        // Always log the exact Gemini error for diagnosis
        console.log(`[Gemini] Error detalle: status=${res.status} message="${errMsg}"`)

        // ── Real budget exhaustion — no fallback, fail the job ──
        if (isBudgetError(res.status, errMsg)) {
          console.error(`[Gemini] SALDO INSUFICIENTE (${res.status}): ${errMsg}`)
          throw new BudgetExceededError()
        }

        // ── Temporary rate limit — handled in catch below for retry ──
        throw new Error(`Gemini error ${res.status}: ${errMsg}`)
      }

      type Part      = { inlineData?: { mimeType: string; data: string } }
      type Candidate = { content: { parts: Part[] } }
      const data     = await res.json() as { candidates?: Candidate[] }

      const imagePart = data.candidates?.[0]?.content?.parts?.find(
        p => p.inlineData?.mimeType?.startsWith('image/')
      )
      if (!imagePart?.inlineData) throw new Error('Gemini returned no image in response')

      console.log(`[Gemini] ✓ Imagen recibida (intento ${attempt}): ${imagePart.inlineData.mimeType}`)
      return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`

    } catch (error) {
      // Budget errors propagate immediately — no retry, no Ideogram fallback
      if (error instanceof BudgetExceededError) throw error

      const msg = (error as Error).message

      // Extract HTTP status from the error message for classification
      const statusMatch = msg.match(/Gemini error (\d+):/)
      const httpStatus  = statusMatch ? parseInt(statusMatch[1]) : 0

      const retryable =
        msg.includes('503') ||
        isRateLimitError(httpStatus, msg)

      if (retryable && attempt < 3) {
        console.log(`[Gemini] Intento ${attempt} fallido (rate limit / 503), reintentando en 15s...`)
        await new Promise(r => setTimeout(r, 15000))
      } else if (retryable) {
        console.warn('[Gemini] 3 intentos fallidos por throttling, cambiando a Ideogram...')
        return generateWithIdeogram(prompt, productName)
      } else {
        console.warn(`[Gemini] Error no recuperable, cambiando a Ideogram: ${msg}`)
        return generateWithIdeogram(prompt, productName)
      }
    }
  }

  return generateWithIdeogram(prompt, productName)
}
