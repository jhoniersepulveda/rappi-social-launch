import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { getJob, createJob, updateJob } from '@/lib/bulkProgress'
import { runBulkProcessing } from '@/lib/bulkRunner'

export const dynamic    = 'force-dynamic'
export const maxDuration = 300

export async function POST(
  _req: NextRequest,
  { params }: { params: { jobId: string } },
) {
  const pausedJob = getJob(params.jobId)

  if (!pausedJob) {
    return NextResponse.json({ error: 'Job no encontrado o expirado' }, { status: 404 })
  }

  if (pausedJob.status !== 'budget_paused') {
    return NextResponse.json({ error: 'El job no está pausado' }, { status: 400 })
  }

  const remainingRows = pausedJob.remainingRows ?? []
  if (!remainingRows.length) {
    return NextResponse.json({ error: 'No hay filas pendientes' }, { status: 400 })
  }

  const newJobId   = nanoid()
  const newBatchId = nanoid()
  createJob(newJobId, remainingRows.length)

  runBulkProcessing(newJobId, newBatchId, remainingRows).catch(err => {
    updateJob(newJobId, { status: 'error', errors: [(err as Error).message] })
  })

  return NextResponse.json({ jobId: newJobId, batchId: newBatchId })
}
