/**
 * Shared bulk processing logic — used by both /start and /resume endpoints.
 */
import archiver from 'archiver'
import { prisma } from '@/lib/prisma'
import { updateJob, type KitPreview } from '@/lib/bulkProgress'
import { generateImage } from '@/lib/ai/generateImage'
import { BudgetExceededError } from '@/lib/errors'
import { composeGraphicKit, DIMENSIONS, type Variant } from '@/lib/services/imageComposer'
import { uploadBuffer } from '@/lib/services/storage'

const VARIANTS: Variant[] = ['feed', 'stories', 'whatsapp']

export const FORMAT_SUFFIX: Record<Variant, string> = {
  feed:     'Square format 1:1, 1080x1080 pixels.',
  stories:  'Vertical format 9:16, 1080x1920 pixels. Design optimized for vertical mobile screen, keep all important elements centered vertically.',
  whatsapp: 'Vertical format 4:5, 1080x1350 pixels.',
}

export function slugify(str: string): string {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function buildPrompt(
  restaurantName: string,
  productName:    string,
  description:    string,
  hasRef:         boolean,
  hasLogo:        boolean,
  fmtSuffix:      string,
): string {
  const heroLine = hasRef
    ? `Product: ${productName}. Use the reference image as the hero product.`
    : `Product: ${productName}. ${description ? `Description: ${description}.` : ''} Generate an appetizing food photo.`

  const logoInstruction = hasLogo
    ? `The restaurant has its own brand logo. Include it subtly in the design, smaller than the Rappi logo, positioned in a corner or integrated naturally into the layout. Restaurant name: ${restaurantName}\n`
    : ''

  return (
    `You are an award-winning art director for a top Latin American advertising agency.\n` +
    `Create a stunning social media advertisement for ${restaurantName} on Rappi Colombia.\n` +
    `${heroLine}\n\n` +
    `Brand rules:\n` +
    `- Rappi orange #FF441B must be present\n- Rappi logo with mustache must be visible\n` +
    `- Restaurant name "${restaurantName}" must appear\n- Include "Pide ahora por Rappi"\n` +
    logoInstruction +
    `\nMake it so good people stop scrolling and order immediately.\n${fmtSuffix} No watermarks.`
  )
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function runBulkProcessing(
  jobId:   string,
  batchId: string,
  rows:    Record<string, string>[],
): Promise<void> {
  const totalRows = rows.length

  const chunks: Buffer[] = []
  const archive = archiver('zip', { zlib: { level: 6 } })
  archive.on('data', (c: Buffer) => chunks.push(c))

  const zipDone = new Promise<void>((res, rej) => {
    archive.on('end',   res)
    archive.on('error', rej)
  })

  const errors:      string[]     = []
  const kitPreviews: KitPreview[] = []
  let completed    = 0
  let successful   = 0
  let failed       = 0
  let budgetPaused = false
  let remainingRows: Record<string, string>[] = []

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row            = rows[rowIdx]
    const restaurantName = row.restaurante          || row.restaurant_name     || ''
    const productName    = row.producto             || row.product_name        || ''
    const description    = row.descripcion_producto || row.product_description || ''
    const logoUrl        = row.logo_url             || ''
    const photoUrl       = row.foto_producto_url    || row.product_photo_url   || ''
    const restSlug       = slugify(restaurantName)
    const productSlug    = slugify(productName)

    let rowHadError = false
    let feedUrl: string | null = null

    for (let vi = 0; vi < VARIANTS.length; vi++) {
      if (vi > 0) await sleep(2000) // ease rate limits between variants

      const variant = VARIANTS[vi]
      completed++
      const label = `${restaurantName} / ${productName} / ${variant}`
      updateJob(jobId, { completed, current: label })

      try {
        const prompt   = buildPrompt(restaurantName, productName, description, !!photoUrl, !!logoUrl, FORMAT_SUFFIX[variant])
        const dataUrl  = await generateImage(prompt, productName, photoUrl || undefined, description, logoUrl || undefined)

        const base64   = dataUrl.split(',')[1]
        const buf      = Buffer.from(base64, 'base64')
        const { width, height } = DIMENSIONS[variant]
        const composed = await composeGraphicKit(buf, width, height)

        archive.append(composed, { name: `packs/${restSlug}/${productSlug}/${variant}.png` })

        if (variant === 'feed') {
          try {
            feedUrl = await uploadBuffer(composed, `bulk/${batchId}/${restSlug}/${productSlug}/feed.png`, 'image/png')
          } catch { /* non-critical */ }
        }

      } catch (err) {
        if (err instanceof BudgetExceededError) {
          remainingRows = rows.slice(rowIdx)
          budgetPaused  = true
          errors.push(`Saldo agotado en: ${restaurantName} / ${productName}`)
          updateJob(jobId, { errors: [...errors] })
          break
        }
        rowHadError = true
        errors.push(`${label}: ${(err as Error).message}`)
        updateJob(jobId, { errors: [...errors] })
      }
    }

    if (budgetPaused) break

    if (rowHadError) {
      failed++
    } else {
      successful++
      if (feedUrl) kitPreviews.push({ restaurant: restaurantName, product: productName, feedUrl })
    }
  }

  if (errors.length) archive.append(errors.join('\n'), { name: 'errors.txt' })

  archive.finalize()
  await zipDone

  const zipBuffer = Buffer.concat(chunks)

  let zipUrl: string | undefined
  try {
    zipUrl = await uploadBuffer(zipBuffer, `bulk-zips/${batchId}.zip`, 'application/zip')
  } catch (e) {
    console.error('[BulkBatch] ZIP upload failed:', e)
  }

  try {
    await prisma.bulkBatch.create({
      data: {
        id:         batchId,
        status:     budgetPaused ? 'partial' : 'done',
        totalRows,
        successful,
        failed,
        zipUrl,
        previews:   kitPreviews as unknown as import('@prisma/client').Prisma.InputJsonValue,
        errors:     errors     as unknown as import('@prisma/client').Prisma.InputJsonValue,
      },
    })
  } catch (e) {
    console.error('[BulkBatch] DB save failed:', e)
  }

  updateJob(jobId, {
    status:        budgetPaused ? 'budget_paused' : 'done',
    completed:     budgetPaused ? completed : totalRows * 3,
    current:       '',
    zipBuffer,
    batchId,
    remainingRows: budgetPaused ? remainingRows : [],
    kitPreviews,
  })
}
