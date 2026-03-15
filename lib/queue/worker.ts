import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { Worker } from 'bullmq'
import { processGenerationJob } from './jobProcessor'

const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379')
const isTLS = redisUrl.protocol === 'rediss:'
const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || '6379', 10),
  password: redisUrl.password ? decodeURIComponent(redisUrl.password) : undefined,
  tls: isTLS ? {} : undefined,
}

const redisHost = redisUrl.hostname
console.log(`Starting image generation worker... (Redis: ${redisHost})`)
console.log(`DATABASE_URL loaded: ${process.env.DATABASE_URL ? 'YES → ' + process.env.DATABASE_URL.split('@')[1] : 'NO ❌'}`)

const worker = new Worker('image-generation', processGenerationJob, {
  connection,
  concurrency: 3,
})

worker.on('completed', (job) => {
  console.log(`✓ Job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`✗ Job ${job?.id} failed:`, err.message || '(sin mensaje)')
  console.error('  stack:', err.stack)
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
