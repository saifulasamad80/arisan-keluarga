import type { Json } from '../../types/database'
import { supabase } from '../../lib/supabase'

export type AuditLogEntry = {
  id: string
  actor_id: string | null
  actor_name: string
  action: string
  success: boolean
  details: Json
  occurred_at: string
}

function requireSupabase() {
  if (!supabase) throw new Error('Konfigurasi Supabase belum lengkap.')
  return supabase
}

export async function listMasterAuditLog(limit = 200) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('master_audit_log')
    .select('id, actor_id, actor_name, action, success, details, occurred_at')
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as AuditLogEntry[]
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  SET_LUNAS: 'Set Lunas',
  BATAL_LUNAS: 'Batal Lunas',
  EKSEKUSI_ACARA: 'Eksekusi acara',
  PENGELUARAN_MANUAL: 'Pengeluaran manual',
  UPSERT_MEMBER: 'Simpan anggota',
  DELETE_MEMBER: 'Hapus anggota',
  UPDATE_KAS: 'Ubah kas',
  DELETE_KAS: 'Hapus kas',
}

export function getAuditActionLabel(action: string) {
  return AUDIT_ACTION_LABELS[action] ?? action
}

export function formatAuditTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value))
}

export function formatAuditDetails(details: Json) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return details == null ? '—' : String(details)
  }

  const entries = Object.entries(details).filter(([, value]) => value !== null && value !== undefined && value !== '')
  if (!entries.length) return '—'
  return entries
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join(' · ')
}

export function getAuditErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('permission') || message.includes('row-level security') || message.includes('42501')) {
    return 'Log audit hanya dapat dibaca oleh admin master.'
  }
  if (message.includes('schema cache') || message.includes('pgrst') || message.includes('does not exist')) {
    return 'Migration log audit belum dijalankan di database.'
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Koneksi ke Supabase bermasalah. Periksa internet lalu coba lagi.'
  }
  return 'Log audit belum dapat dimuat.'
}
