import type { Database } from '../../types/database'
import { supabase } from '../../lib/supabase'
import { type EventExecutionMode, type FundCategory } from './contributionRules'

export type CashTransaction = Database['public']['Views']['public_cash_transactions']['Row'] & {
  is_locked?: boolean | null
}

type ExpenseInput = {
  description: string
  amount: number
  category: string
  pin: string
}

export type FundBalance = {
  category: FundCategory | 'Lainnya'
  label: string
  amount: number
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
    .from('public_arisan_members')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  if (error && (error.code === '42P01' || error.code === 'PGRST205')) return 0
  if (error) throw error
  return count ?? 0
}

export async function createExpense(input: ExpenseInput) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('create_expense', {
    p_description: input.description,
    p_amount: input.amount,
    p_category: input.category,
    p_pin: input.pin,
  })

  if (error) throw error
  const result = data?.[0]
  if (!result) throw new Error('Respons pengeluaran tidak valid.')
  if (!result.success) throw new Error(result.message)

  const transaction = await client
    .from('public_cash_transactions')
    .select('*')
    .eq('id', result.transaction_id ?? '')
    .single()
  if (transaction.error) throw transaction.error
  return transaction.data
}

export async function updateManualCashTransaction(input: {
  id: string
  description: string
  amount: number
  category: string
  occurredOn: string
  pin: string
}) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('update_manual_cash_transaction', {
    p_id: input.id,
    p_description: input.description,
    p_amount: input.amount,
    p_category: input.category,
    p_occurred_on: input.occurredOn,
    p_pin: input.pin,
  })
  if (error) throw error
  const result = data?.[0]
  if (!result) throw new Error('Respons ubah kas tidak valid.')
  if (!result.success) throw new Error(result.message)
  return result
}

export async function deleteManualCashTransaction(input: { id: string; pin: string }) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('delete_manual_cash_transaction', {
    p_id: input.id,
    p_pin: input.pin,
  })
  if (error) throw error
  const result = data?.[0]
  if (!result) throw new Error('Respons hapus kas tidak valid.')
  if (!result.success) throw new Error(result.message)
  return result
}

export async function executeArisanEvent(input: { mode: EventExecutionMode; pin: string }) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('execute_arisan_event', {
    p_mode: input.mode,
    p_pin: input.pin,
  })

  if (error) throw error
  const result = data?.[0]
  if (!result) throw new Error('Respons eksekusi acara tidak valid.')
  if (!result.success) throw new Error(result.message)
  return result
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

const FUND_LABELS: Record<FundCategory | 'Lainnya', string> = {
  'Iuran Arisan': 'Uang Arisan Pemenang (Transit)',
  'Iuran Wajib': 'Iuran Wajib',
  'Dana Sosial': 'Dana Sosial',
  'Konsumsi': 'Konsumsi (Transit)',
  'Tabungan Kaos': 'Tabungan Kaos',
  'Koreksi/Pembatalan': 'Koreksi/Pembatalan',
  Lainnya: 'Lainnya',
}

export function summarizeFundBalances(transactions: CashTransaction[]): FundBalance[] {
  const totals = new Map<FundCategory | 'Lainnya', number>()
  for (const transaction of transactions) {
    const category = isFundCategory(transaction.category) ? transaction.category : 'Lainnya'
    const signed = transaction.type === 'income' ? Number(transaction.amount) : -Number(transaction.amount)
    totals.set(category, (totals.get(category) ?? 0) + signed)
  }

  const order: Array<FundCategory | 'Lainnya'> = [
    'Iuran Wajib',
    'Dana Sosial',
    'Tabungan Kaos',
    'Konsumsi',
    'Iuran Arisan',
    'Koreksi/Pembatalan',
    'Lainnya',
  ]

  return order
    .filter((category) => (category !== 'Koreksi/Pembatalan' && category !== 'Lainnya') || (totals.get(category) ?? 0) !== 0)
    .map((category) => ({
      category,
      label: FUND_LABELS[category],
      amount: totals.get(category) ?? 0,
    }))
}

function isFundCategory(value: string): value is FundCategory {
  return value === 'Iuran Arisan'
    || value === 'Iuran Wajib'
    || value === 'Dana Sosial'
    || value === 'Konsumsi'
    || value === 'Tabungan Kaos'
    || value === 'Koreksi/Pembatalan'
}

export function getFinanceErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''

  if (message.includes('pin bendahara') || message.includes('pengeluaran') || message.includes('eksekusi') || message.includes('acara') || message.includes('transaksi') || message.includes('terkunci')) {
    return error instanceof Error ? error.message : 'Pengeluaran belum dapat dicatat.'
  }

  if (message.includes('schema cache') || message.includes('could not find the function') || message.includes('pgrst202')) {
    return 'Migration CRUD pengurus belum dijalankan di database.'
  }

  if (message.includes('permission') || message.includes('row-level security')) {
    return 'Anda tidak memiliki izin untuk melakukan operasi keuangan ini.'
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'Koneksi ke Supabase bermasalah. Periksa internet lalu coba lagi.'
  }

  return 'Data keuangan belum dapat dimuat. Silakan coba lagi.'
}