'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

interface BudgetState {
  hasBudgetIssue:     boolean
  generatedThisMonth: number
  monthlyLimit:       number
  nearLimit:          boolean
  estimatedCostUSD:   number
  loading:            boolean
  refresh:            () => void
}

const BudgetContext = createContext<BudgetState>({
  hasBudgetIssue:     false,
  generatedThisMonth: 0,
  monthlyLimit:       500,
  nearLimit:          false,
  estimatedCostUSD:   0,
  loading:            true,
  refresh:            () => {},
})

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState({
    hasBudgetIssue:     false,
    generatedThisMonth: 0,
    monthlyLimit:       500,
    nearLimit:          false,
    estimatedCostUSD:   0,
    loading:            true,
  })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res  = await fetch('/api/status/budget')
      const data = await res.json() as Omit<BudgetState, 'loading' | 'refresh'>
      setState({ ...data, loading: false })
    } catch {
      setState(prev => ({ ...prev, loading: false }))
    }
  }, [])

  useEffect(() => {
    void refresh()
    timerRef.current = setInterval(() => void refresh(), 30_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [refresh])

  return (
    <BudgetContext.Provider value={{ ...state, refresh }}>
      {children}
    </BudgetContext.Provider>
  )
}

export function useBudgetContext(): BudgetState {
  return useContext(BudgetContext)
}
