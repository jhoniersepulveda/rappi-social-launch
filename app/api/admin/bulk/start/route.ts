import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import archiver from 'archiver'
import { createJob, updateJob } from '@/lib/bulkProgress'
import { generateImage } from '@/lib/ai/generateImage'
import { composeGraphicKit, DIMENSIONS, type Variant } from '@/lib/services/imageComposer'

export const maxDuration = 300

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------
function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let cur = '', inQ = false
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue }
    if (ch === ',' && !inQ) { result.push(cur); cur = ''; continue }
    cur += ch
  }
  result.push(cur)
  return result
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const headers = splitCSVLine(lines[0]).map(h => h.trim())
  return lines.slice(1).map(line => {
    const vals = splitCSVLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]))
  })
}

function slugify(str: string): string {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const VARIANTS: Variant[] = ['feed', 'stories', 'whatsapp']
const FORMAT_SUFFIX: Record<Variant, string> = {
  feed:     'Square format 1:1, 1080x1080 pixels.',
  stories:  'Vertical format 9:16, 1080x1920 pixels. Design optimized for vertical mobile screen, keep all important elements centered vertically.',
  whatsapp: 'Vertical format 4:5, 1080x1350 pixels.',
}

function buildPrompt(restaurantName: string, productName: string, description: string, hasRef: boolean, fmtSuffix: string): string {
  const heroLine = hasRef
    ? `Product: ${productName}. Use the reference image as the hero product.`
    : `Product: ${productName}. ${description ? `Description: ${description}.` : ''} Generate an appetizing food photo.`

  return (
    `You are an award-winning art director for a top Latin American advertising agency.\n` +
    `Create a stunning social media advertisement for ${restaurantName} on Rappi Colombia.\n` +
    `${heroLine}\n\n` +
    `Brand rules:\n` +
    `- Rappi orange #FF441B must be present\n- Rappi logo with mustache must be visible\n` +
    `- Restaurant name "${restaurantName}" must appear\n- Include "Pide ahora por Rappi"\n\n` +
    `Make it so good people stop scrolling and order immediately.\n${fmtSuffix} No watermarks.`
  )
}

// ---------------------------------------------------------------------------
// Background processor
// ---------------------------------------------------------------------------
async function processAll(jobId: string, rows: Record<string, string>[]) {
  const total = rows.length * VARIANTS.length

  const chunks: Buffer[] = []
  const archive = archiver('zip', { zlib: { level: 6 } })
  archive.on('data', (c: Buffer) => chunks.push(c))

  const zipDone = new Promise<void>((res, rej) => {
    archive.on('end', res)
    archive.on('error', rej)
  })

  const errors: string[] = []
  let completed = 0

  for (const row of rows) {
    const restaurantName = row.restaurante     || row.restaurant_name || ''
    const productName    = row.producto        || row.product_name    || ''
    const description    = row.descripcion_producto || row.product_description || ''
    const photoUrl       = row.foto_producto_url    || row.product_photo_url   || ''
    const restSlug       = slugify(restaurantName)
    const productSlug    = slugify(productName)

    for (const variant of VARIANTS) {
      completed++
      const label = `${restaurantName}/${productName}/${variant}`
      updateJob(jobId, { completed, current: label })

      try {
        const prompt = buildPrompt(restaurantName, productName, description, !!photoUrl, FORMAT_SUFFIX[variant])
        const dataUrl = await generateImage(prompt, productName, photoUrl || undefined)

        const base64 = dataUrl.split(',')[1]
        const buf    = Buffer.from(base64, 'base64')
        const { width, height } = DIMENSIONS[variant]
        const composed = await composeGraphicKit(buf, width, height)
        archive.append(composed, { name: `packs/${restSlug}/${productSlug}/${variant}.png` })
      } catch (err) {
        errors.push(`${label}: ${(err as Error).message}`)
        updateJob(jobId, { errors: [...errors] })
      }
    }
  }

  if (errors.length) {
    archive.append(errors.join('\n'), { name: 'errors.txt' })
  }

  archive.finalize()
  await zipDone

  const zipBuffer = Buffer.concat(chunks)
  updateJob(jobId, { status: 'done', completed: total, current: '', zipBuffer })
}

// ---------------------------------------------------------------------------
// POST /api/admin/bulk/start
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('csv') as File | null

  if (!file) return NextResponse.json({ error: 'Falta el archivo CSV' }, { status: 400 })

  const text = await file.text()
  const rows = parseCSV(text)

  if (!rows.length) return NextResponse.json({ error: 'CSV vacío o mal formateado' }, { status: 400 })

  const jobId = nanoid()
  createJob(jobId, rows.length * VARIANTS.length)

  // Fire and forget
  processAll(jobId, rows).catch(err => {
    updateJob(jobId, { status: 'error', errors: [(err as Error).message] })
  })

  return NextResponse.json({ jobId })
}
