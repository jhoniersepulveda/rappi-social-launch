'use client'

import { SessionProvider } from 'next-auth/react'
import { BudgetProvider } from '@/components/BudgetProvider'
import { BudgetBanner }   from '@/components/BudgetBanner'

export function SessionProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BudgetProvider>
        <BudgetBanner />
        {children}
      </BudgetProvider>
    </SessionProvider>
  )
}
