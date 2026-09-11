import { useCallback, useEffect, useState } from 'react'
import type { ExpenseFormValues } from './ExpenseForm'
import {
  countActiveMembers,
  createExpense,
  getFinanceErrorMessage,
  listCashTransactions,
  type CashTransaction,
} from './financeRepository'
import { supabase } from '../../lib/supabase'

interface FinanceState {
  transactions: CashTransaction[]
  memberCount: number
  isLoading: boolean
  isSaving: boolean
  error: string | null
  createExpense: (values: ExpenseFormValues) => Promise<boolean>
  reload: () => Promise<void>
  clearError: () => void
}

export function useFinance(userId: string | null): FinanceState {
  const [transactions, setTransactions] = useState<CashTransaction[]>([])
  const [memberCount, setMemberCount] = useState(0)
  const [isLoading, setIsLoading] = useState(Boolean(supabase))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!supabase) {
      setTransactions([])
      setMemberCount(0)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [nextTransactions, nextMemberCount] = await Promise.all([
        listCashTransactions(),
        countActiveMembers(),
      ])
      setTransactions(nextTransactions)
      setMemberCount(nextMemberCount)
    } catch (loadError) {
      setError(getFinanceErrorMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void reload()
  }, [reload])

  const saveExpense = useCallback(async (values: ExpenseFormValues) => {
    if (!userId) {
      setError('Sesi login tidak ditemukan. Silakan masuk kembali.')
      return false
    }

    setIsSaving(true)
    setError(null)

    try {
      const transaction = await createExpense({
        description: values.description,
        amount: values.amount,
        category: values.category,
        createdBy: userId,
      })
      setTransactions((current) => [transaction, ...current])
      return true
    } catch (saveError) {
      setError(getFinanceErrorMessage(saveError))
      return false
    } finally {
      setIsSaving(false)
    }
  }, [userId])

  return {
    transactions,
    memberCount,
    isLoading,
    isSaving,
    error,
    createExpense: saveExpense,
    reload,
    clearError: () => setError(null),
  }
}