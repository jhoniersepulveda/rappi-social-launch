import { NextRequest, NextResponse } from 'next/server'
import { getJob } from '@/lib/bulkProgress'

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const job = getJob(params.jobId)

  if (!job || job.status !== 'done' || !job.zipBuffer) {
    return NextResponse.json({ error: 'ZIP no disponible aún' }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(job.zipBuffer), {
    headers: {
      'Content-Type':        'application/zip',
      'Content-Disposition': 'attachment; filename="rappi-social-packs.zip"',
      'Content-Length':      String(job.zipBuffer.length),
    },
  })
}
