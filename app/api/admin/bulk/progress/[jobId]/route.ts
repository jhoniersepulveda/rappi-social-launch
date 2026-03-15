import { NextRequest } from 'next/server'
import { getJob } from '@/lib/bulkProgress'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        // Remove zipBuffer from SSE payload (too large)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { zipBuffer, ...safe } = data as Record<string, unknown>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(safe)}\n\n`))
      }

      const iv = setInterval(() => {
        const job = getJob(params.jobId)

        if (!job) {
          send({ status: 'error', total: 0, completed: 0, current: '', errors: ['Job not found'] })
          clearInterval(iv)
          controller.close()
          return
        }

        send(job)

        if (job.status === 'done' || job.status === 'error') {
          clearInterval(iv)
          controller.close()
        }
      }, 600)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
    },
  })
}
