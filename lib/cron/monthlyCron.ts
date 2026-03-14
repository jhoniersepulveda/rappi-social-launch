import 'dotenv/config'
import cron from 'node-cron'
import { prisma } from '@/lib/prisma'
import { sendKitReminderEmail } from '@/lib/services/email'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

console.log('Starting monthly cron job (runs at 9am on 1st of each month)...')

// Run at 9am on the 1st of every month: 0 9 1 * *
cron.schedule('0 9 1 * *', async () => {
  console.log('[Cron] Running monthly reminder job...')

  try {
    const restaurants = await prisma.restaurant.findMany({
      include: {
        kits: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    })

    let emailsSent = 0

    for (const restaurant of restaurants) {
      const lastKit = restaurant.kits[0]
      const noRecentKit =
        !lastKit ||
        Date.now() - lastKit.createdAt.getTime() > THIRTY_DAYS_MS

      if (noRecentKit && restaurant.email) {
        try {
          await sendKitReminderEmail({
            id: restaurant.id,
            name: restaurant.name,
            email: restaurant.email,
          })
          emailsSent++
          console.log(`[Cron] Reminder sent to ${restaurant.name} (${restaurant.email})`)
        } catch (err) {
          console.error(`[Cron] Failed to send to ${restaurant.name}:`, err)
        }
      }
    }

    console.log(`[Cron] Monthly reminder job complete. Emails sent: ${emailsSent}/${restaurants.length}`)
  } catch (err) {
    console.error('[Cron] Job failed:', err)
  }
})

// Graceful shutdown
process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))
