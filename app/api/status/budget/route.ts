import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Approximate cost per Gemini image generation call (USD).
// 3 variants per kit → cost per kit ≈ COST_PER_IMAGE * 3
const COST_PER_IMAGE = parseFloat(process.env.GEMINI_COST_PER_IMAGE ?? '0.039')

export async function GET() {
  try {
    const since24h     = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

    const [budgetRows, countRows, successRows] = await Promise.all([
      // budget_exceeded kits in last 24 h → real billing issue
      query(
        'SELECT COUNT(*) AS count FROM "GraphicKit" WHERE status = $1 AND "createdAt" > $2',
        ['budget_exceeded', since24h]
      ),
      // ready kits this month → for monthly counter
      query(
        'SELECT COUNT(*) AS count FROM "GraphicKit" WHERE status = $1 AND "createdAt" > $2',
        ['ready', startOfMonth]
      ),
      // most recent successful kit — if it's newer than the last budget_exceeded,
      // budget was likely restored → suppress the banner
      query(
        'SELECT "createdAt" FROM "GraphicKit" WHERE status = $1 ORDER BY "createdAt" DESC LIMIT 1',
        ['ready']
      ),
    ])

    const budgetExceededCount = parseInt(String(budgetRows.rows[0]?.count  ?? '0'))
    const generatedThisMonth  = parseInt(String(countRows.rows[0]?.count   ?? '0'))
    const monthlyLimit        = parseInt(process.env.MONTHLY_GENERATION_LIMIT ?? '500')

    // Suppress budget issue if the most recent kit succeeded AFTER the last budget error
    let hasBudgetIssue = budgetExceededCount > 0
    if (hasBudgetIssue && successRows.rows.length > 0) {
      const lastSuccess = new Date(successRows.rows[0].createdAt as string)
      if (lastSuccess > since24h) {
        // A kit succeeded recently — budget was restored
        hasBudgetIssue = false
      }
    }

    // Estimated spend: 3 Gemini calls per kit
    const estimatedCostUSD = parseFloat((generatedThisMonth * 3 * COST_PER_IMAGE).toFixed(2))

    const nearLimit = monthlyLimit > 0 && (monthlyLimit - generatedThisMonth) < 10

    return NextResponse.json({
      hasBudgetIssue,
      generatedThisMonth,
      monthlyLimit,
      nearLimit,
      estimatedCostUSD,
    })
  } catch {
    return NextResponse.json({
      hasBudgetIssue:     false,
      generatedThisMonth: 0,
      monthlyLimit:       500,
      nearLimit:          false,
      estimatedCostUSD:   0,
    })
  }
}
