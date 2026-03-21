export type JobStatus = 'running' | 'done' | 'error' | 'budget_paused'

export interface KitPreview {
  restaurant: string
  product:    string
  feedUrl:    string
}

export interface BulkJob {
  status:        JobStatus
  total:         number                       // total variants (rows × 3)
  totalRows:     number                       // total CSV rows
  completed:     number
  current:       string
  errors:        string[]
  zipBuffer?:    Buffer
  batchId?:      string
  remainingRows?: Record<string, string>[]    // rows not yet processed (for resume)
  kitPreviews?:  KitPreview[]
}

const jobs = new Map<string, BulkJob>()

export function createJob(id: string, totalRows: number): void {
  jobs.set(id, {
    status:    'running',
    total:     totalRows * 3,
    totalRows,
    completed: 0,
    current:   '',
    errors:    [],
  })
}

export function updateJob(id: string, patch: Partial<BulkJob>): void {
  const j = jobs.get(id)
  if (j) jobs.set(id, { ...j, ...patch })
}

export function getJob(id: string): BulkJob | undefined {
  return jobs.get(id)
}

export function deleteJob(id: string): void {
  jobs.delete(id)
}
