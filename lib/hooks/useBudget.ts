'use client'

// Re-export from the shared context so all consumers get the same instance.
// Calling refresh() from any dashboard immediately updates BudgetBanner too.
export { useBudgetContext as useBudget } from '@/components/BudgetProvider'
export type { } from '@/components/BudgetProvider'
