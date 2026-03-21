import { BudgetExceededError, GenerationFailedError } from '@/lib/errors'

const GEMINI_MODEL = 'gemini-3.1-flash-image-preview'

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/**
 * Returns true ONLY for genuine account-level billing exhaustion.
 * Plain 429 rate limits are never budget errors — they should be retried.
 */
function isBudgetError(status: number, message: string): boolean {
  const lower = message.toLowerCase()

  // RESOURCE_EXHAUSTED (gRPC code 8) AND a billing/quota phrase
  if (message.includes('RESOURCE_EXHAUSTED') && lower.includes('quota')) return true

  // Explicit billing phrases regardless of status code
  if (lower.includes('spending cap'))             return true
  if (lower.includes('insufficient funds'))       return true
  if (lower.includes('payment required'))         return true
  if (lower.includes('billing account disabled')) return true

  return false
}

// Delay in ms per HTTP status code before retrying
const RETRY_DELAY_MS: Record<number, number> = {
  429: 10000, // rate limit — wait 10 s
  503: 5000,  // overload  — wait 5 s
  500: 3000,  // server err — wait 3 s
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// Gemini con retry robusto — sin fallback naranja
// Lanza BudgetExceededError si detecta error de cuota/billing.
// Lanza GenerationFailedError si los 3 intentos fallan por cualquier razón.
// ---------------------------------------------------------------------------
export async function generateImage(
  prompt: string,
  productName: string,
  referenceImageUrl?: string,
  productDescription?: string,
  logoImageUrl?: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new GenerationFailedError('No GEMINI_API_KEY configured')
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

  if (logoImageUrl) {
    try {
      console.log(`[Gemini] Cargando logo del restaurante: ${logoImageUrl}`)
      const logoRes = await fetch(logoImageUrl, { signal: AbortSignal.timeout(10000) })
      if (logoRes.ok) {
        const logoBuf = Buffer.from(await logoRes.arrayBuffer())
        const mime    = logoRes.headers.get('content-type') || 'image/png'
        parts.push({ inline_data: { mime_type: mime, data: logoBuf.toString('base64') } })
        console.log('[Gemini] Logo del restaurante adjuntado')
      }
    } catch {
      console.warn('[Gemini] No se pudo cargar el logo del restaurante, continuando sin él')
    }
  }

  const url  = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`
  const body = {
    contents: [{ parts }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
  }

  console.log(`[Gemini] Modelo: ${GEMINI_MODEL}`)
  console.log(`[Gemini] Prompt: ${prompt.substring(0, 120)}...`)

  let lastError: Error = new Error('unknown')

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

        console.log(`[Gemini] Error detalle: status=${res.status} message="${errMsg}"`)

        // Real budget exhaustion — fail immediately, no retry
        if (isBudgetError(res.status, errMsg)) {
          console.error(`[Gemini] SALDO INSUFICIENTE (${res.status}): ${errMsg}`)
          throw new BudgetExceededError()
        }

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
      // Budget errors propagate immediately — no retry
      if (error instanceof BudgetExceededError) throw error

      lastError = error as Error
      const msg = lastError.message

      const statusMatch = msg.match(/Gemini error (\d+):/)
      const httpStatus  = statusMatch ? parseInt(statusMatch[1]) : 0

      if (attempt < 3) {
        const delay = RETRY_DELAY_MS[httpStatus] ?? 3000
        console.log(`[Gemini] Intento ${attempt} fallido — status=${httpStatus} razón="${msg}" — reintentando en ${delay / 1000}s...`)
        await sleep(delay)
      }
    }
  }

  // All 3 attempts failed — NO orange fallback, fail the job
  console.log('[Gemini] FALLBACK ACTIVADO - razón:', lastError.message, 'status:', (lastError as NodeJS.ErrnoException).code ?? 'n/a')
  console.error(`[Gemini] 3 intentos fallidos. Última razón: ${lastError.message}`)
  throw new GenerationFailedError(lastError.message)
}
