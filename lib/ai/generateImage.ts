import Replicate from 'replicate'
import OpenAI from 'openai'

const replicate = new Replicate({ auth: process.env.REPLICATE_API_KEY })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const CATEGORY_MODIFIERS: Record<string, string> = {
  'Fast food': 'warm tones, golden hour lighting',
  Saludable: 'fresh greens, natural light, wooden surface',
  Cafetería: 'moody dark background, steam rising, cozy atmosphere',
  Postres: 'pastel background, soft lighting, elegant plating',
  Bebidas: 'condensation drops, ice cubes, refreshing colors',
}

const BASE_SUFFIX =
  'food photography, professional lighting, vibrant colors, appetizing presentation, clean background gradient from white to light gray, no text, no logos, photorealistic'

export function buildPrompt(productName: string, category: string): string {
  const modifier = CATEGORY_MODIFIERS[category] || ''
  return `${productName}, ${modifier}, ${BASE_SUFFIX}`
}

export async function withExponentialRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delays = [1000, 2000, 4000]
): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delays[i]))
      }
    }
  }
  throw lastError
}

async function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

export async function generateWithReplicate(prompt: string): Promise<string> {
  const output = await replicate.run('black-forest-labs/flux-schnell', {
    input: {
      prompt,
      num_outputs: 1,
      output_format: 'webp',
      output_quality: 90,
      aspect_ratio: '1:1',
    },
  })

  // Handle both string[] and ReadableStream[] formats
  const result = Array.isArray(output) ? output[0] : output
  if (typeof result === 'string') {
    return result
  }
  // ReadableStream — save to temp buffer and return data URL
  if (result && typeof (result as ReadableStream).getReader === 'function') {
    const buf = await streamToBuffer(result as ReadableStream)
    return `data:image/webp;base64,${buf.toString('base64')}`
  }
  throw new Error('Unexpected Replicate output format')
}

export async function generateWithDallE(prompt: string): Promise<string> {
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
    response_format: 'url',
  })
  const url = response.data?.[0]?.url
  if (!url) throw new Error('DALL-E returned no image URL')
  return url
}

export async function generateProductImage(
  productName: string,
  category: string
): Promise<string> {
  const prompt = buildPrompt(productName, category)

  // Try Replicate first, fall back to DALL-E
  try {
    return await withExponentialRetry(() => generateWithReplicate(prompt))
  } catch (err) {
    console.warn('Replicate failed, falling back to DALL-E:', err)
    return await withExponentialRetry(() => generateWithDallE(prompt))
  }
}
