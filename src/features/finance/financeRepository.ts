import type { Database } from '../../types/database'
import { supabase } from '../../lib/supabase'

export type CashTransaction = Database['public']['Views']['public_cash_transactions']['Row']

type ExpenseInput = {
  description: string
  amount: number
  category: string
  createdBy: string
}

export interface CashSummary {
  balance: number
  totalIncome: number
  totalExpense: number
  monthIncome: number
  monthExpense: number
  monthLabel: string
}

function requireSupabase() {
  if (!supabase) throw new Error('Konfigurasi Supabase belum lengkap.')
  return supabase
}

export async function listCashTransactions() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('public_cash_transactions')
    .select('*')
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function countActiveMembers() {
  const client = requireSupabase()
  const { count, error } = await client
    .from('public_members')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  if (error) throw error
  return count ?? 0
}

export async function createExpense(input: ExpenseInput) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('cash_transactions')
    .insert({
      type: 'expense',
      description: input.description,
      amount: input.amount,
      category: input.category,
      created_by: input.createdBy,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

function getCurrentMonthRange(today = new Date()) {
  const year = today.getFullYear()
  const month = today.getMonth()
  const monthNumber = String(month + 1).padStart(2, '0')
  const lastDay = new Date(year, month + 1, 0).getDate()

  return {
    start: `${year}-${monthNumber}-01`,
    end: `${year}-${monthNumber}-${String(lastDay).padStart(2, '0')}`,
    label: new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(today),
  }
}

export function summarizeCashTransactions(transactions: CashTransaction[], today = new Date()): CashSummary {
  const month = getCurrentMonthRange(today)
  const monthTransactions = transactions.filter(
    (transaction) => transaction.occurred_on >= month.start && transaction.occurred_on <= month.end,
  )
  const totalIncome = transactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((total, transaction) => total + Number(transaction.amount), 0)
  const totalExpense = transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((total, transaction) => total + Number(transaction.amount), 0)

  return {
    balance: totalIncome - totalExpense,
    totalIncome,
    totalExpense,
    monthIncome: monthTransactions
      .filter((transaction) => transaction.type === 'income')
      .reduce((total, transaction) => total + Number(transaction.amount), 0),
    monthExpense: monthTransactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce((total, transaction) => total + Number(transaction.amount), 0),
    monthLabel: month.label,
  }
}

export function getFinanceErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''

  if (message.includes('permission') || message.includes('row-level security')) {
    return 'Anda tidak memiliki izin untuk melakukan operasi keuangan ini.'
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'Koneksi ke Supabase bermasalah. Periksa internet lalu coba lagi.'
  }

  return 'Data keuangan belum dapat dimuat. Silakan coba lagi.'
}