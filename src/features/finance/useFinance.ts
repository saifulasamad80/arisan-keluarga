import { useCallback, useEffect, useState } from 'react'
import type { ExpenseFormValues } from './ExpenseForm'
import type { CashTransactionFormValues } from './CashTransactionForm'
import {
  countActiveMembers,
  createExpense,
  deleteManualCashTransaction,
  executeArisanEvent,
  getFinanceErrorMessage,
  listCashTransactions,
  updateManualCashTransaction,
  type CashTransaction,
} from './financeRepository'
import type { EventExecutionMode } from './contributionRules'
import { supabase } from '../../lib/supabase'

interface FinanceState {
  transactions: CashTransaction[]
  memberCount: number
  isLoading: boolean
  isSaving: boolean
  error: string | null
  createExpense: (values: ExpenseFormValues) => Promise<boolean>
  updateTransaction: (values: CashTransactionFormValues) => Promise<boolean>
  deleteTransaction: (values: { id: string; pin: string }) => Promise<boolean>
  executeEvent: (values: { mode: EventExecutionMode; pin: string }) => Promise<boolean>
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

    if (!userId) {
      setTransactions([])
      setMemberCount(0)
      setIsLoading(false)
      return
    }

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
        pin: values.pin,
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

  const runEvent = useCallback(async (values: { mode: EventExecutionMode; pin: string }) => {
    if (!userId) {
      setError('Sesi login tidak ditemukan. Silakan masuk kembali.')
      return false
    }

    setIsSaving(true)
    setError(null)

    try {
      await executeArisanEvent(values)
      await reload()
      return true
    } catch (saveError) {
      setError(getFinanceErrorMessage(saveError))
      return false
    } finally {
      setIsSaving(false)
    }
  }, [reload, userId])

  const saveTransaction = useCallback(async (values: CashTransactionFormValues) => {
    if (!userId) {
      setError('Sesi login tidak ditemukan. Silakan masuk kembali.')
      return false
    }
    setIsSaving(true)
    setError(null)
    try {
      await updateManualCashTransaction({
        id: values.id,
        description: values.description,
        amount: values.amount,
        category: values.category,
        occurredOn: values.occurredOn,
        pin: values.pin,
      })
      await reload()
      return true
    } catch (saveError) {
      setError(getFinanceErrorMessage(saveError))
      return false
    } finally {
      setIsSaving(false)
    }
  }, [reload, userId])

  const removeTransaction = useCallback(async (values: { id: string; pin: string }) => {
    if (!userId) {
      setError('Sesi login tidak ditemukan. Silakan masuk kembali.')
      return false
    }
    setIsSaving(true)
    setError(null)
    try {
      await deleteManualCashTransaction(values)
      await reload()
      return true
    } catch (saveError) {
      setError(getFinanceErrorMessage(saveError))
      return false
    } finally {
      setIsSaving(false)
    }
  }, [reload, userId])

  return {
    transactions,
    memberCount,
    isLoading,
    isSaving,
    error,
    createExpense: saveExpense,
    updateTransaction: saveTransaction,
    deleteTransaction: removeTransaction,
    executeEvent: runEvent,
    reload,
    clearError: () => setError(null),
  }
}