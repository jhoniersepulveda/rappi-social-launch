import { Queue } from 'bullmq'

// Use connection URL string — BullMQ handles its own ioredis instance internally
const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379')

export const redisConnection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || '6379', 10),
  password: redisUrl.password || undefined,
}

export const generationQueue = new Queue('image-generation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
})

export interface GenerationJobData {
  kitId: string
  restaurantId: string
  productName: string
  productImage: string
  promotionText: string
}
