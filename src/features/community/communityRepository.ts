import type { Database } from '../../types/database'
import { supabase } from '../../lib/supabase'
import type { ContributionFormValues } from './ContributionForm'

export type CommunityEvent = Database['public']['Views']['public_events']['Row']
export type PrayerNote = Database['public']['Views']['public_prayer_notes']['Row']
export type CommunityMember = Database['public']['Views']['public_members']['Row']
export type PublicContribution = Database['public']['Views']['public_contributions']['Row']
export type GalleryPhoto = Database['public']['Views']['public_gallery_photos']['Row']
export type LegacyContributionStatus = Database['public']['Views']['public_legacy_contribution_status']['Row']
export type LegacyDeceasedPerson = Database['public']['Views']['public_legacy_deceased_people']['Row']

function requireSupabase() {
  if (!supabase) throw new Error('Konfigurasi Supabase belum lengkap.')
  return supabase
}

export async function listUpcomingEvents() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('public_events')
    .select('*')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function listPrayerNotes() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('public_prayer_notes')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function listMembers() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('public_members')
    .select('*')
    .order('full_name', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function listPublicContributions() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('public_contributions')
    .select('*')
    .order('period_start', { ascending: false })
    .order('member_name', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function listLegacyContributionStatus() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('public_legacy_contribution_status')
    .select('*')
    .order('member_name', { ascending: true })

  // Frontend dapat ter-deploy lebih dulu daripada migration database. Dalam
  // kondisi itu, jangan matikan seluruh halaman komunitas hanya karena view
  // opsional belum tersedia; setelah migration aktif query akan langsung hidup.
  if (error && (error.code === '42P01' || error.code === 'PGRST205')) return []
  if (error) throw error
  return data ?? []
}

export async function listLegacyDeceasedPeople() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('public_legacy_deceased_people')
    .select('*')
    .order('full_name', { ascending: true })

  // Keep older frontend deployments usable if the optional legacy migration
  // has not reached the database yet.
  if (error && (error.code === '42P01' || error.code === 'PGRST205')) return []
  if (error) throw error
  return data ?? []
}

export async function listGalleryPhotos() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('public_gallery_photos')
    .select('*')
    .order('taken_on', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function listMembersForReminder() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('manager_members')
    .select('id, full_name, phone, avatar_url, role, member_type, is_active, joined_at, created_at, updated_at')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  if (error) throw error
  return data ?? []
}

export function getWhatsAppNumber(value: string | null) {
  let number = (value ?? '').replace(/[^0-9]/g, '')
  if (!number) return ''
  if (number.startsWith('0')) number = `62${number.slice(1)}`
  if (!number.startsWith('62')) number = `62${number}`
  return number
}

export async function createGalleryPhoto(input: {
  title: string
  caption?: string
  imageUrl: string
  takenOn?: string
  createdBy: string
}) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('gallery_photos')
    .insert({
      title: input.title,
      caption: input.caption || null,
      image_url: input.imageUrl,
      taken_on: input.takenOn || null,
      created_by: input.createdBy,
      is_published: true,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function uploadGalleryPhoto(input: {
  title: string
  caption?: string
  takenOn?: string
  file: File
  createdBy: string
}) {
  const client = requireSupabase()
  const safeName = input.file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')
  const path = `${input.createdBy}/${crypto.randomUUID()}-${safeName}`
  const { error: uploadError } = await client.storage.from('ikt-gallery').upload(path, input.file, { upsert: false })
  if (uploadError) throw uploadError

  const { data } = client.storage.from('ikt-gallery').getPublicUrl(path)
  return createGalleryPhoto({ ...input, imageUrl: data.publicUrl })
}

export interface ContributionSettlementResult {
  success: boolean
  message: string
  settlement_id: string | null
  total_amount: number | null
}

export async function settleContribution(input: ContributionFormValues): Promise<ContributionSettlementResult> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('settle_contribution', {
    p_member_id: input.memberId,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_period_count: input.periodCount,
    p_pin: input.pin,
  })

  if (error) throw error
  const result = data?.[0]
  if (!result) throw new Error('Respons pelunasan tidak valid.')
  return result
}

export function getCommunityErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''

  if (message.includes('pin bendahara') || message.includes('pelunasan') || message.includes('periode')) {
    return error instanceof Error ? error.message : 'Pelunasan belum dapat dicatat.'
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'Koneksi ke Supabase bermasalah. Periksa internet lalu coba lagi.'
  }

  return 'Data komunitas belum dapat dimuat. Silakan coba lagi.'
}