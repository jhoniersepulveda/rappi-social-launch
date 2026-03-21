import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { createJob, updateJob } from '@/lib/bulkProgress'
import { runBulkProcessing } from '@/lib/bulkRunner'

export const dynamic    = 'force-dynamic'
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

  const jobId   = nanoid()
  const batchId = nanoid()
  createJob(jobId, rows.length)

  // Fire and forget
  runBulkProcessing(jobId, batchId, rows).catch(err => {
    updateJob(jobId, { status: 'error', errors: [(err as Error).message] })
  })

  return NextResponse.json({ jobId, batchId })
}
