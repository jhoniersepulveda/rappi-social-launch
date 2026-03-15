import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPublication } from '@/lib/ai/verifyPublication'

export const dynamic = 'force-dynamic'
import { uploadBuffer } from '@/lib/services/storage'
import { activateIncentive, checkMonthlyVerificationLimit } from '@/lib/services/incentive'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const kit = await prisma.graphicKit.findUnique({
    where: { id: params.id },
    include: { restaurant: true },
  })

  if (!kit) {
    return NextResponse.json({ error: 'Kit not found' }, { status: 404 })
  }

  if (kit.status !== 'ready') {
    return NextResponse.json({ error: 'Kit is not ready yet' }, { status: 400 })
  }

  // Check monthly verification limit
  const { limitReached, count } = await checkMonthlyVerificationLimit(kit.restaurantId)
  if (limitReached) {
    return NextResponse.json(
      {
        error: 'Monthly verification limit reached (3 per month)',
        count,
      },
      { status: 429 }
    )
  }

  let screenshotUrl: string

  const contentType = req.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    // File upload
    const formData = await req.formData()
    const file = formData.get('screenshot') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No screenshot file provided' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const key = `verifications/${kit.id}/${Date.now()}.${file.name.split('.').pop() || 'jpg'}`
    screenshotUrl = await uploadBuffer(buffer, key, file.type || 'image/jpeg')
    // For verification, use a publicly accessible URL if possible
    // If S3 is not configured, we'll use the S3 URI — Claude Vision needs a real URL
    // In production, use getSignedDownloadUrl to get a temporary URL
  } else {
    // JSON with URL
    const body = await req.json()
    if (!body.screenshotUrl) {
      return NextResponse.json({ error: 'screenshotUrl is required' }, { status: 400 })
    }
    screenshotUrl = body.screenshotUrl
  }

  // Get accessible URL for Claude Vision
  const accessibleUrl = screenshotUrl.startsWith('s3://')
    ? `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${screenshotUrl.replace(`s3://${process.env.S3_BUCKET}/`, '')}`
    : screenshotUrl

  // Run AI verification
  const result = await verifyPublication(
    accessibleUrl,
    kit.restaurant.name,
    kit.deepLink || ''
  )

  // Determine status based on confidence
  let verificationStatus: string
  const responsePayload: Record<string, unknown> = {
    confidence: result.confidence,
    detected: result.detected,
    notes: result.notes,
  }

  const now = new Date()

  if (result.confidence > 0.8) {
    verificationStatus = 'approved'
    // Auto-activate incentive
    const incentive = await activateIncentive(
      kit.restaurantId,
      kit.id,
      'boost_visibility'
    )
    responsePayload.status = 'approved'
    responsePayload.incentiveExpiresAt = incentive.expiresAt
    responsePayload.message = '¡Publicación verificada! Tu visibilidad en Rappi ha sido activada.'
  } else if (result.confidence >= 0.5) {
    verificationStatus = 'pending'
    responsePayload.status = 'pending'
    responsePayload.needsConfirmation = true
    responsePayload.message = 'No pudimos verificar automáticamente. Un agente revisará tu publicación.'
  } else {
    verificationStatus = 'rejected'
    responsePayload.status = 'rejected'
    responsePayload.flaggedForKAM = true
    responsePayload.message = 'No detectamos los elementos requeridos de Rappi en la publicación.'
  }

  // Save verification record
  await prisma.verification.upsert({
    where: { kitId: kit.id },
    create: {
      kitId: kit.id,
      screenshotUrl: accessibleUrl,
      confidence: result.confidence,
      status: verificationStatus,
      reviewedAt: result.confidence > 0.8 ? now : null,
      notes: result.notes,
    },
    update: {
      screenshotUrl: accessibleUrl,
      confidence: result.confidence,
      status: verificationStatus,
      reviewedAt: result.confidence > 0.8 ? now : null,
      notes: result.notes,
    },
  })

  return NextResponse.json(responsePayload)
}
