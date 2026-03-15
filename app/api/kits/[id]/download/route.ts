import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractKeyFromUri, getSignedDownloadUrl } from '@/lib/services/storage'
import archiver from 'archiver'
import PDFDocument from 'pdfkit'
import axios from 'axios'
import fs from 'fs'
import path from 'path'

// ---------------------------------------------------------------------------
// Image buffer resolver — handles data URIs, S3 URIs, local paths, and HTTPS
// ---------------------------------------------------------------------------
async function resolveImageBuffer(uri: string): Promise<Buffer> {
  console.log('[Download] resolveImageBuffer uri:', uri.substring(0, 80))

  // data:image/png;base64,<data>  (Gemini output stored directly in DB)
  if (uri.startsWith('data:')) {
    const base64 = uri.split(',')[1]
    if (!base64) throw new Error('Empty data URI')
    return Buffer.from(base64, 'base64')
  }

  // /uploads/...  →  local filesystem (dev mode, no S3 configured)
  if (uri.startsWith('/uploads/')) {
    const filePath = path.join(process.cwd(), 'public', uri)
    console.log('[Download] buscando archivo en:', filePath)
    return fs.promises.readFile(filePath)
  }

  // s3://bucket/key  →  signed HTTPS URL then download
  if (uri.startsWith('s3://')) {
    const key = extractKeyFromUri(uri)
    const signedUrl = await getSignedDownloadUrl(key)
    const res = await axios.get<Buffer>(signedUrl, { responseType: 'arraybuffer', timeout: 15000 })
    return Buffer.from(res.data)
  }

  // Plain HTTPS URL
  const res = await axios.get<Buffer>(uri, { responseType: 'arraybuffer', timeout: 15000 })
  return Buffer.from(res.data)
}

// ---------------------------------------------------------------------------
// PDF guide
// ---------------------------------------------------------------------------
async function generateGuidePDF(kit: {
  productName:   string
  promotionText: string
  deepLink:      string | null
  shortHash:     string | null
  restaurant:    { name: string; slug: string; rappiUrl?: string | null }
  createdAt:     Date
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 0, size: 'A4' })
    const chunks: Buffer[] = []
    const W = doc.page.width    // 595
    const H = doc.page.height   // 842
    const M = 50                // margin

    doc.on('data',  (c: Buffer) => chunks.push(c))
    doc.on('end',   () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const orange = '#FF441B'
    const black  = '#1A1A1A'
    const gray   = '#888888'
    const light  = '#F5F5F5'

    // ── PORTADA ──────────────────────────────────────────────────────────────
    // Orange header band
    doc.rect(0, 0, W, 160).fill(orange)

    // "rappi" wordmark
    doc.fillColor('white').fontSize(52).font('Helvetica-Bold').text('rappi', M, 32)

    // "Social Launch" tag
    doc.fontSize(11).font('Helvetica')
      .text('Social Launch', M, 90)

    // Title
    doc.fontSize(17).font('Helvetica-Bold')
      .text(`Guía de publicación — ${kit.restaurant.name}`, M, 115, { width: W - M * 2 })

    // Subtitle strip
    doc.rect(0, 160, W, 44).fill('#1A1A1A')
    doc.fillColor('white').fontSize(13).font('Helvetica')
      .text('Tu pack de redes sociales está listo', M, 172)

    // Product pill
    doc.rect(M, 224, W - M * 2, 48).fill(light).stroke(light)
    doc.fillColor(gray).fontSize(9).font('Helvetica').text('PRODUCTO', M + 16, 232)
    doc.fillColor(black).fontSize(14).font('Helvetica-Bold').text(kit.productName, M + 16, 243)

    // Promo pill
    doc.rect(M, 280, W - M * 2, 48).fill(light).stroke(light)
    doc.fillColor(gray).fontSize(9).font('Helvetica').text('PROMOCIÓN', M + 16, 288)
    doc.fillColor(orange).fontSize(14).font('Helvetica-Bold').text(kit.promotionText, M + 16, 299)

    // ── SECCIÓN 1: Tu link directo ────────────────────────────────────────
    let y = 352

    doc.fillColor(orange).fontSize(13).font('Helvetica-Bold')
      .text('Tu link directo a Rappi', M, y)
    y += 22

    doc.moveTo(M, y).lineTo(W - M, y).lineWidth(1).stroke(orange)
    y += 12

    doc.fillColor('#444').fontSize(10).font('Helvetica')
      .text(
        'Comparte este link para que tus clientes lleguen directo a tu tienda en Rappi:',
        M, y, { width: W - M * 2 }
      )
    y += 32

    // Deep link box
    const link = kit.restaurant.rappiUrl ?? kit.deepLink ?? `https://www.rappi.com.co/restaurantes/${kit.restaurant.slug}`
    doc.rect(M, y, W - M * 2, 40).fill('#FFF3F0').stroke(orange)
    doc.fillColor(orange).fontSize(11).font('Helvetica-Bold')
      .text(link, M + 12, y + 13, { width: W - M * 2 - 24 })
    y += 56

    // Instructions
    const instructions = [
      'Bio de Instagram',
      'Descripción de Facebook',
      'Mensaje de WhatsApp',
    ]
    doc.fillColor(black).fontSize(10).font('Helvetica-Bold').text('Copia este link y pégalo en:', M, y)
    y += 16
    instructions.forEach(item => {
      doc.fillColor(orange).fontSize(10).text('✓  ', M, y, { continued: true })
      doc.fillColor('#333').font('Helvetica').text(item)
      y += 16
    })

    // ── SECCIÓN 2: Cómo publicar ──────────────────────────────────────────
    y += 16
    doc.fillColor(orange).fontSize(13).font('Helvetica-Bold').text('Cómo publicar cada pieza', M, y)
    y += 22
    doc.moveTo(M, y).lineTo(W - M, y).lineWidth(1).stroke(orange)
    y += 14

    const formats = [
      {
        file:  'feed.png',
        label: 'Feed  (1080 × 1080)',
        where: 'Publica en tu feed de Instagram y Facebook',
        color: '#FF6B35',
      },
      {
        file:  'stories.png',
        label: 'Stories  (1080 × 1920)',
        where: 'Usa en Instagram Stories y Facebook Stories',
        color: '#E91E63',
      },
      {
        file:  'whatsapp.png',
        label: 'WhatsApp  (1080 × 1350)',
        where: 'Comparte en tus estados de WhatsApp y grupos de clientes',
        color: '#25D366',
      },
    ]

    formats.forEach(fmt => {
      doc.rect(M, y, 8, 36).fill(fmt.color)
      doc.fillColor(black).fontSize(11).font('Helvetica-Bold')
        .text(fmt.label, M + 18, y + 2)
      doc.fillColor('#555').fontSize(9).font('Helvetica')
        .text(fmt.where, M + 18, y + 17, { width: W - M * 2 - 18 })
      y += 48
    })

    // ── SECCIÓN 3: Tips ───────────────────────────────────────────────────
    y += 4
    doc.fillColor(orange).fontSize(13).font('Helvetica-Bold').text('Tips para más ventas', M, y)
    y += 22
    doc.moveTo(M, y).lineTo(W - M, y).lineWidth(1).stroke(orange)
    y += 14

    const tips = [
      'Publica en horarios de mayor hambre: 11am–1pm y 6pm–8pm',
      'Agrega el link a tu bio ANTES de publicar el contenido',
      'Responde rápido los comentarios con el link directo',
      'Publica las 3 piezas el mismo día para mayor impacto',
    ]
    tips.forEach(tip => {
      doc.rect(M, y, W - M * 2, 28).fill(light)
      doc.fillColor(orange).fontSize(10).font('Helvetica-Bold').text('→', M + 10, y + 9, { continued: true })
      doc.fillColor(black).font('Helvetica').text(`  ${tip}`, { width: W - M * 2 - 30 })
      y += 36
    })

    // ── FOOTER ────────────────────────────────────────────────────────────
    const footerY = H - 44
    doc.rect(0, footerY, W, 44).fill(black)
    doc.fillColor('white').fontSize(9).font('Helvetica')
      .text('Generado con Rappi Social Launch', M, footerY + 10)
    doc.fillColor(gray).fontSize(8)
      .text(
        kit.createdAt.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }),
        M, footerY + 24
      )
    doc.fillColor(orange).fontSize(9).font('Helvetica-Bold')
      .text('rappi.com', 0, footerY + 15, { align: 'right', width: W - M })

    doc.end()
  })
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const kit = await prisma.graphicKit.findUnique({
    where:   { id: params.id },
    include: { restaurant: true },
  })

  if (!kit) {
    return NextResponse.json({ error: 'Kit not found' }, { status: 404 })
  }

  if (kit.status !== 'ready' || !kit.imageUrls) {
    return NextResponse.json({ error: 'Kit is not ready yet' }, { status: 400 })
  }

  const rawUrls = kit.imageUrls as Record<string, string>
  console.log('[Download] imageUrls del kit:', rawUrls)

  // Resolve image buffers (data URIs, local path, S3, or HTTPS)
  const imageBuffers: Record<string, Buffer> = {}
  await Promise.all(
    Object.entries(rawUrls).map(async ([variant, uri]) => {
      try {
        imageBuffers[variant] = await resolveImageBuffer(uri)
        console.log(`[Download] ✓ ${variant}: ${imageBuffers[variant].length} bytes`)
      } catch (err) {
        console.error(`[Download] ✗ ${variant} failed:`, (err as Error).message)
      }
    })
  )
  console.log('[Download] variantes resueltas:', Object.keys(imageBuffers))

  // Generate PDF
  const pdfBuffer = await generateGuidePDF({
    productName:   kit.productName,
    promotionText: kit.promotionText,
    deepLink:      kit.deepLink,
    shortHash:     kit.shortHash,
    restaurant:    kit.restaurant,
    createdAt:     kit.createdAt,
  })

  // Build ZIP — properly awaited via 'end' event
  const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 6 } })
    const chunks: Buffer[] = []

    archive.on('data',  (chunk: Buffer) => chunks.push(chunk))
    archive.on('end',   () => resolve(Buffer.concat(chunks)))
    archive.on('error', reject)

    // Images first
    const ORDER: Array<'feed' | 'stories' | 'whatsapp'> = ['feed', 'stories', 'whatsapp']
    for (const variant of ORDER) {
      if (imageBuffers[variant]) {
        archive.append(imageBuffers[variant], { name: `${variant}.png` })
      }
    }

    // PDF guide last
    archive.append(pdfBuffer, { name: 'guia-publicacion.pdf' })

    archive.finalize()
  })

  const filename = `rappi-pack-${kit.restaurant.slug}-${kit.productName.replace(/\s+/g, '-').toLowerCase()}.zip`

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      zipBuffer.length.toString(),
    },
  })
}
