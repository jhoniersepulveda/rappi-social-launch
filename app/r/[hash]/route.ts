import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildRappiUrl } from '@/lib/services/deeplink'

export async function GET(
  _req: NextRequest,
  { params }: { params: { hash: string } }
) {
  const kit = await prisma.graphicKit.findFirst({
    where: { shortHash: params.hash },
    include: { restaurant: { select: { slug: true } } },
  })

  if (!kit) {
    return new NextResponse('Not found', { status: 404 })
  }

  const rappiUrl = buildRappiUrl(kit.restaurant.slug, kit.id)

  return NextResponse.redirect(rappiUrl, { status: 302 })
}
