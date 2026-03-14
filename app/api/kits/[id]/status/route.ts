import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSignedDownloadUrl, extractKeyFromUri } from '@/lib/services/storage'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const kit = await prisma.graphicKit.findUnique({
    where: { id: params.id },
    include: {
      restaurant: { select: { name: true } },
      incentive: true,
    },
  })

  if (!kit) {
    return NextResponse.json({ error: 'Kit not found' }, { status: 404 })
  }

  if (kit.status !== 'ready' || !kit.imageUrls) {
    return NextResponse.json({
      status: kit.status,
      productName: kit.productName,
      restaurantName: kit.restaurant.name,
      createdAt: kit.createdAt,
    })
  }

  // Generate signed URLs for ready kits
  const rawUrls = kit.imageUrls as Record<string, string>
  const signedUrls: Record<string, string> = {}

  for (const [variant, uri] of Object.entries(rawUrls)) {
    try {
      const key = extractKeyFromUri(uri)
      signedUrls[variant] = await getSignedDownloadUrl(key)
    } catch {
      // If signing fails (e.g., no S3 config in dev), return the raw URI
      signedUrls[variant] = uri
    }
  }

  return NextResponse.json({
    status: kit.status,
    productName: kit.productName,
    promotionText: kit.promotionText,
    deepLink: kit.deepLink,
    shortHash: kit.shortHash,
    imageUrls: signedUrls,
    restaurantName: kit.restaurant.name,
    createdAt: kit.createdAt,
    incentive: kit.incentive,
  })
}
