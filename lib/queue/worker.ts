import 'dotenv/config'
import { Worker } from 'bullmq'
import { processGenerationJob } from './jobProcessor'

const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379')
const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || '6379', 10),
  password: redisUrl.password || undefined,
}

console.log('Starting image generation worker...')

const worker = new Worker('image-generation', processGenerationJob, {
  connection,
  concurrency: 3,
})

worker.on('completed', (job) => {
  console.log(`✓ Job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`✗ Job ${job?.id} failed:`, err.message)
})

worker.on('error', (err) => {
  console.error('Worker error:', err)
})

process.on('SIGTERM', async () => {
  await worker.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  await worker.close()
  process.exit(0)
})
