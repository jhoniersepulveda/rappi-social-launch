export type JobStatus = 'running' | 'done' | 'error'

export interface BulkJob {
  status:    JobStatus
  total:     number
  completed: number
  current:   string
  errors:    string[]
  zipBuffer?: Buffer
}

const jobs = new Map<string, BulkJob>()

export function createJob(id: string, total: number): void {
  jobs.set(id, { status: 'running', total, completed: 0, current: '', errors: [] })
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
