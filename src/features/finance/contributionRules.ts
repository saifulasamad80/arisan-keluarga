export type ContributionMemberType = 'arisan' | 'non-arisan'
export type EventExecutionMode = 'all' | 'arisan' | 'konsumsi'
export type FundCategory =
  | 'Iuran Arisan'
  | 'Iuran Wajib'
  | 'Dana Sosial'
  | 'Konsumsi'
  | 'Tabungan Kaos'
  | 'Koreksi/Pembatalan'

export const FUND_CATEGORIES: readonly FundCategory[] = [
  'Iuran Arisan',
  'Iuran Wajib',
  'Dana Sosial',
  'Konsumsi',
  'Tabungan Kaos',
  'Koreksi/Pembatalan',
]

export const MANUAL_EXPENSE_CATEGORIES: readonly FundCategory[] = [
  'Iuran Arisan',
  'Iuran Wajib',
  'Dana Sosial',
  'Konsumsi',
  'Tabungan Kaos',
]

export const EVENT_ARISAN_PAYOUT = 3_220_000
export const EVENT_CONSUMPTION_PAYOUT = 900_000

export interface ContributionSplit {
  arisan: number
  wajib: number
  sosial: number
  konsumsi: number
  kaos: number
  total: number
}

const NON_ARISAN_SPLIT: Omit<ContributionSplit, 'total'> = {
  arisan: 0,
  wajib: 20_000,
  sosial: 20_000,
  konsumsi: 30_000,
  kaos: 30_000,
}

const ARISAN_SPLIT: Omit<ContributionSplit, 'total'> = {
  arisan: 140_000,
  wajib: 20_000,
  sosial: 20_000,
  konsumsi: 30_000,
  kaos: 30_000,
}

export function getContributionMemberType(value: string | null | undefined): ContributionMemberType {
  const normalized = (value ?? '').trim().toLocaleLowerCase('id-ID')
  return normalized.includes('arisan') && !normalized.includes('non') ? 'arisan' : 'non-arisan'
}

export function getContributionSplit(memberType: ContributionMemberType): ContributionSplit {
  const split = memberType === 'arisan' ? ARISAN_SPLIT : NON_ARISAN_SPLIT
  const total = Object.values(split).reduce((sum, amount) => sum + amount, 0)
  return { ...split, total }
}

export function calculateContributionTotal(memberType: ContributionMemberType, periodCount: number) {
  if (!Number.isInteger(periodCount) || periodCount < 1) throw new Error('Jumlah periode harus berupa bilangan bulat positif.')
  return getContributionSplit(memberType).total * periodCount
}

export function reduceArrears(previousArrears: number, settledPeriods: number) {
  if (!Number.isFinite(previousArrears) || previousArrears < 0) throw new Error('Tunggakan lama tidak valid.')
  if (!Number.isInteger(settledPeriods) || settledPeriods < 1) throw new Error('Jumlah periode harus berupa bilangan bulat positif.')
  return Math.max(0, previousArrears - settledPeriods)
}