import { NextRequest, NextResponse } from 'next/server'
import archiver from 'archiver'
import { generateImage } from '@/lib/ai/generateImage'

export const dynamic = 'force-dynamic'
import { composeGraphicKit, DIMENSIONS, type Variant } from '@/lib/services/imageComposer'

export const maxDuration = 300  // 5 min — generación puede ser lenta

// ---------------------------------------------------------------------------
// CSV parser simple — soporta campos con comillas
// ---------------------------------------------------------------------------
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []

  const headers = splitCSVLine(lines[0])
  return lines.slice(1).map(line => {
    const values = splitCSVLine(line)
    return Object.fromEntries(headers.map((h, i) => [h.trim(), (values[i] ?? '').trim()]))
  })
}

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; continue }
    if (char === ',' && !inQuotes) { result.push(current); current = ''; continue }
    current += char
  }
  result.push(current)
  return result
}

function slugify(str: string): string {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quitar tildes
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const VARIANTS: Variant[] = ['feed', 'stories', 'whatsapp']

const FORMAT_SUFFIX: Record<Variant, string> = {
  feed:     'Square format 1:1, 1080x1080 pixels.',
  stories:  'Vertical format 9:16, 1080x1920 pixels. Design optimized for vertical mobile screen, keep all important elements centered vertically.',
  whatsapp: 'Vertical format 4:5, 1080x1350 pixels.',
}

function buildPrompt(
  restaurantName: string,
  category: string,
  productName: string,
  productDescription: string,
  hasReferenceImage: boolean,
  formatSuffix: string
): string {
  const productLine = hasReferenceImage
    ? `Product: ${productName}. Use the reference image provided as the hero product photo.`
    : `Product: ${productName}. Description: ${productDescription}. Generate an appetizing food photo for this product.`

  return (
    `You are an award-winning art director for a top Latin American advertising agency.\n` +
    `Create a stunning social media advertisement for ${restaurantName} on Rappi Colombia.\n` +
    `Category: ${category}. ${productLine}\n\n` +
    `Brand rules (the ONLY constraints):\n` +
    `- Rappi orange #FF441B must be present\n` +
    `- Rappi logo with mustache must be visible\n` +
    `- Restaurant name "${restaurantName}" must appear in the design\n` +
    `- Include the text "Pide ahora por Rappi" somewhere in the design\n\n` +
    `Everything else is YOUR creative decision.\n` +
    `Make it so good people stop scrolling and order immediately.\n` +
    `${formatSuffix} No watermarks.`
  )
}

// ---------------------------------------------------------------------------
// POST /api/admin/bulk
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const form = await req.formData()

  const restaurantsFile = form.get('restaurants') as File | null
  const productsFile    = form.get('products')    as File | null

  if (!restaurantsFile || !productsFile) {
    return NextResponse.json({ error: 'Se requieren los dos archivos CSV (restaurants y products)' }, { status: 400 })
  }

  const restaurants = parseCSV(await restaurantsFile.text())
  const products    = parseCSV(await productsFile.text())

  if (!restaurants.length || !products.length) {
    return NextResponse.json({ error: 'Los archivos CSV están vacíos o mal formateados' }, { status: 400 })
  }

  // Índice por rappi_store_id
  const restaurantMap = new Map(restaurants.map(r => [r.rappi_store_id, r]))

  // Resolver pares restaurante+producto
  type Pair = { restaurant: Record<string, string>; product: Record<string, string> }
  const pairs: Pair[] = []
  for (const product of products) {
    const restaurant = restaurantMap.get(product.rappi_store_id)
    if (restaurant) pairs.push({ restaurant, product })
  }

  if (!pairs.length) {
    return NextResponse.json({ error: 'Ningún producto pudo cruzarse con un restaurante por rappi_store_id' }, { status: 400 })
  }

  // Construir ZIP en memoria
  const chunks: Buffer[] = []
  const archive = archiver('zip', { zlib: { level: 6 } })

  const zipDone = new Promise<void>((resolve, reject) => {
    archive.on('data',    (chunk: Buffer) => chunks.push(chunk))
    archive.on('end',     resolve)
    archive.on('error',   reject)
    archive.on('warning', (err: Error & { code?: string }) => {
      if (err.code !== 'ENOENT') reject(err)
    })
  })

  const errors: string[] = []

  for (const { restaurant, product } of pairs) {
    const restSlug    = slugify(restaurant.restaurant_name)
    const productSlug = slugify(product.product_name)
    const folderPath  = `packs/${restSlug}/${productSlug}`

    console.log(`[Bulk] Generando: ${restaurant.restaurant_name} / ${product.product_name}`)

    for (const variant of VARIANTS) {
      try {
        const prompt = buildPrompt(
          restaurant.restaurant_name,
          restaurant.category,
          product.product_name,
          product.product_description,
          !!product.product_photo_url,
          FORMAT_SUFFIX[variant]
        )

        const imageDataUrl = await generateImage(
          prompt,
          product.product_name,
          product.product_photo_url || undefined
        )

        const base64 = imageDataUrl.split(',')[1]
        const buf    = Buffer.from(base64, 'base64')

        const { width, height } = DIMENSIONS[variant]
        const composed = await composeGraphicKit(buf, width, height)

        archive.append(composed, { name: `${folderPath}/${variant}.png` })
        console.log(`[Bulk] ✓ ${folderPath}/${variant}.png`)
      } catch (err) {
        const msg = `${restaurant.restaurant_name}/${product.product_name}/${variant}: ${(err as Error).message}`
        console.error(`[Bulk] ✗ ${msg}`)
        errors.push(msg)
      }
    }
  }

  if (errors.length) {
    // Incluir log de errores en el ZIP
    archive.append(errors.join('\n'), { name: 'errors.txt' })
  }

  archive.finalize()
  await zipDone

  const zipBuffer = Buffer.concat(chunks)

  return new NextResponse(zipBuffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/zip',
      'Content-Disposition': 'attachment; filename="rappi-social-packs.zip"',
      'Content-Length':      String(zipBuffer.length),
    },
  })
}
