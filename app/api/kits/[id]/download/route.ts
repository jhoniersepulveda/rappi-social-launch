import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractKeyFromUri, getSignedDownloadUrl } from '@/lib/services/storage'
import archiver from 'archiver'
import PDFDocument from 'pdfkit'
import axios from 'axios'

async function generateGuidePDF(kit: {
  productName: string
  promotionText: string
  deepLink: string | null
  restaurant: { name: string }
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Header
    doc.rect(0, 0, doc.page.width, 80).fill('#FF441B')
    doc.fillColor('white').fontSize(28).font('Helvetica-Bold').text('rappi', 50, 25)
    doc.fontSize(14).font('Helvetica').text('Social Launch — Guía de publicación', 50, 55)

    // Reset color
    doc.fillColor('#1A1A1A')

    // Kit info
    doc.moveDown(3)
    doc.fontSize(20).font('Helvetica-Bold').text(`Kit para: ${kit.productName}`, 50)
    doc.fontSize(12).font('Helvetica').fillColor('#555')
      .text(`Restaurante: ${kit.restaurant.name}`)
      .text(`Texto de promoción: "${kit.promotionText}"`)
    if (kit.deepLink) {
      doc.text(`Deep link: ${kit.deepLink}`)
    }

    // Separator
    doc.moveDown()
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke('#FF441B')
    doc.moveDown()

    // Schedule
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#1A1A1A').text('Calendario recomendado de publicación')
    doc.moveDown(0.5)
    doc.fontSize(11).font('Helvetica').fillColor('#333')
    const schedule = [
      { day: 'Día 1 (Hoy)', action: 'Publica en Instagram Feed (1080x1080)', tip: 'Mejor hora: 12pm-2pm o 6pm-8pm' },
      { day: 'Día 2', action: 'Publica en Instagram Stories (1080x1920)', tip: 'Agrega stickers de "Pedir ahora" y el link de Rappi' },
      { day: 'Día 3', action: 'Comparte en WhatsApp Business (1080x1350)', tip: 'Envía a tu lista de difusión de clientes frecuentes' },
      { day: 'Día 4', action: 'Publica en Facebook', tip: 'Incluye el deep link en la descripción del post' },
    ]

    for (const item of schedule) {
      doc.font('Helvetica-Bold').text(`${item.day}: `, { continued: true })
      doc.font('Helvetica').text(item.action)
      doc.fillColor('#FF441B').text(`  💡 ${item.tip}`)
      doc.fillColor('#333').moveDown(0.3)
    }

    // Caption templates
    doc.moveDown()
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke('#FF441B')
    doc.moveDown()
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#1A1A1A').text('Plantillas de copy')
    doc.moveDown(0.5)
    doc.fontSize(11).font('Helvetica').fillColor('#333')

    const captions = [
      `🍽️ ¡${kit.promotionText}! Pide nuestro ${kit.productName} directo en Rappi y recíbelo en tu puerta. 🚀\n#${kit.restaurant.name.replace(/\s/g, '')} #Rappi #PideYa`,
      `✨ Hoy tenemos algo especial para ti: ${kit.promotionText} 🎉\nOrden aquí 👉 ${kit.deepLink || 'rappi.com'}\n.\n.\n#delivery #comida #Rappi`,
      `😍 ¿Antojo de ${kit.productName}? ¡Nosotros lo resolvemos!\n${kit.promotionText} — solo por Rappi 🧡\nLink en bio 📱`,
    ]

    captions.forEach((caption, i) => {
      doc.font('Helvetica-Bold').fillColor('#1A1A1A').text(`Plantilla ${i + 1}:`)
      doc.font('Helvetica').fillColor('#333').text(caption, { indent: 20 })
      doc.moveDown(0.5)
    })

    // Tips
    doc.moveDown()
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke('#FF441B')
    doc.moveDown()
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#1A1A1A').text('Consejos adicionales')
    doc.fontSize(11).font('Helvetica').fillColor('#333').moveDown(0.5)
    const tips = [
      'Agrega el QR de Rappi en tus Stories para facilitar el pedido',
      'Responde comentarios rápidamente para aumentar el engagement',
      'Usa hashtags locales de tu ciudad + #Rappi #delivery',
      'Recuerda subir la captura de pantalla de tu publicación en el dashboard para activar tus incentivos',
    ]
    tips.forEach((tip) => {
      doc.text(`• ${tip}`)
    })

    // Footer
    const pageBottom = doc.page.height - 50
    doc.fontSize(10).fillColor('#aaa')
      .text('© Rappi Social Launch · rappi.com', 50, pageBottom, { align: 'center' })

    doc.end()
  })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const kit = await prisma.graphicKit.findUnique({
    where: { id: params.id },
    include: { restaurant: true },
  })

  if (!kit) {
    return NextResponse.json({ error: 'Kit not found' }, { status: 404 })
  }

  if (kit.status !== 'ready' || !kit.imageUrls) {
    return NextResponse.json({ error: 'Kit is not ready yet' }, { status: 400 })
  }

  const rawUrls = kit.imageUrls as Record<string, string>

  // Generate PDF guide
  const pdfBuffer = await generateGuidePDF({
    productName: kit.productName,
    promotionText: kit.promotionText,
    deepLink: kit.deepLink,
    restaurant: kit.restaurant,
  })

  // Collect image buffers
  const imageBuffers: Record<string, Buffer> = {}
  for (const [variant, uri] of Object.entries(rawUrls)) {
    try {
      let downloadUrl: string
      if (uri.startsWith('s3://')) {
        const key = extractKeyFromUri(uri)
        downloadUrl = await getSignedDownloadUrl(key)
      } else {
        downloadUrl = uri
      }
      const response = await axios.get<Buffer>(downloadUrl, { responseType: 'arraybuffer' })
      imageBuffers[variant] = Buffer.from(response.data)
    } catch (err) {
      console.warn(`Failed to fetch image for ${variant}:`, err)
    }
  }

  // Build ZIP stream
  const archive = archiver('zip', { zlib: { level: 6 } })
  const chunks: Buffer[] = []

  archive.on('data', (chunk: Buffer) => chunks.push(chunk))

  // Add images
  for (const [variant, buf] of Object.entries(imageBuffers)) {
    archive.append(buf, { name: `${variant}.png` })
  }

  // Add PDF guide
  archive.append(pdfBuffer, { name: 'guia-publicacion.pdf' })

  await archive.finalize()
  const zipBuffer = Buffer.concat(chunks)

  return new NextResponse(zipBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="kit-${kit.productName.replace(/\s/g, '-').toLowerCase()}.zip"`,
      'Content-Length': zipBuffer.length.toString(),
    },
  })
}
