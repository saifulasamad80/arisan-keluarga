import type { Database } from '../../types/database'
import { supabase } from '../../lib/supabase'
import type { ContributionFormValues } from './ContributionForm'
import type { MemberFormValues } from './MemberForm'
import type { EventFormValues } from './EventForm'
import type { DeceasedFormValues } from './DeceasedForm'
import type { WinnerFormValues } from './WinnerForm'
import type { PrayerNoteFormValues } from './PrayerNoteForm'
import type { GalleryFormValues } from './GalleryForm'

export type CommunityEvent = Database['public']['Views']['public_events']['Row']
export type PrayerNote = Database['public']['Views']['public_prayer_notes']['Row']
export type CommunityMember = Database['public']['Views']['public_arisan_members']['Row']
export type ManagerMember = Database['public']['Views']['manager_arisan_members']['Row']
export type PublicContribution = Database['public']['Views']['public_contributions']['Row']
export type GalleryPhoto = Database['public']['Views']['public_gallery_photos']['Row']
export type LegacyContributionStatus = Database['public']['Views']['public_legacy_contribution_status']['Row']
export type LegacyDeceasedPerson = Database['public']['Views']['public_legacy_deceased_people']['Row']
export type ArisanWinner = Database['public']['Views']['public_legacy_arisan_winners']['Row']

function requireSupabase() {
  if (!supabase) throw new Error('Konfigurasi Supabase belum lengkap.')
  return supabase
}

function unwrapFlag<T extends { success: boolean; message: string }>(data: T[] | null, error: { message: string } | null, fallback: string) {
  if (error) throw error
  const result = data?.[0]
  if (!result) throw new Error(fallback)
  if (!result.success) throw new Error(result.message)
  return result
}

export async function listEvents() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('public_events')
    .select('*')
    .order('starts_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function listUpcomingEvents() {
  const now = new Date().toISOString()
  return (await listEvents()).filter((event) => event.starts_at >= now)
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
    .from('public_arisan_members')
    .select('*')
    .order('full_name', { ascending: true })

  if (error && (error.code === '42P01' || error.code === 'PGRST205')) return []
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

  if (error && (error.code === '42P01' || error.code === 'PGRST205')) return []
  if (error) throw error
  return data ?? []
}

export async function listArisanWinners() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('public_legacy_arisan_winners')
    .select('*')
    .order('period_label', { ascending: false })

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
    .from('manager_arisan_members')
    .select('id, full_name, member_type, period_status, arrears_periods, phone, is_active, profile_id, updated_at')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  if (error && (error.code === '42P01' || error.code === 'PGRST205')) return []
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

function galleryStoragePath(imageUrl: string) {
  const marker = '/object/public/ikt-gallery/'
  const index = imageUrl.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(imageUrl.slice(index + marker.length))
}

export async function saveGalleryPhotoRecord(input: GalleryFormValues & { createdBy: string; previousImageUrl?: string | null }) {
  const client = requireSupabase()
  if (!input.id) {
    if (!input.file) throw new Error('Pilih satu foto terlebih dahulu.')
    return uploadGalleryPhoto({
      title: input.title,
      caption: input.caption,
      takenOn: input.takenOn,
      file: input.file,
      createdBy: input.createdBy,
    })
  }

  let imageUrl: string | undefined
  if (input.file) {
    const safeName = input.file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')
    const path = `${input.createdBy}/${crypto.randomUUID()}-${safeName}`
    const { error: uploadError } = await client.storage.from('ikt-gallery').upload(path, input.file, { upsert: false })
    if (uploadError) throw uploadError
    imageUrl = client.storage.from('ikt-gallery').getPublicUrl(path).data.publicUrl
  }

  const { error } = await client
    .from('gallery_photos')
    .update({
      title: input.title,
      caption: input.caption || null,
      taken_on: input.takenOn || null,
      ...(imageUrl ? { image_url: imageUrl } : {}),
    })
    .eq('id', input.id)

  if (error) throw error

  if (imageUrl && input.previousImageUrl) {
    const oldPath = galleryStoragePath(input.previousImageUrl)
    if (oldPath) await client.storage.from('ikt-gallery').remove([oldPath])
  }
}

export async function deleteGalleryPhotoRecord(photo: GalleryPhoto) {
  const client = requireSupabase()
  const { error } = await client.from('gallery_photos').delete().eq('id', photo.id)
  if (error) throw error
  const path = galleryStoragePath(photo.image_url)
  if (path) await client.storage.from('ikt-gallery').remove([path])
}

export async function upsertMember(values: MemberFormValues) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('upsert_arisan_member', {
    p_id: values.id ?? null,
    p_full_name: values.fullName,
    p_member_type: values.memberType,
    p_period_status: values.periodStatus,
    p_arrears_periods: values.arrearsPeriods,
    p_phone: values.phone,
  })
  return unwrapFlag(data, error, 'Respons simpan anggota tidak valid.')
}

export async function deleteMember(memberId: string) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('delete_arisan_member', { p_id: memberId })
  return unwrapFlag(data, error, 'Respons hapus anggota tidak valid.')
}

export async function saveEvent(values: EventFormValues, createdBy: string) {
  const client = requireSupabase()
  const payload = {
    title: `Arisan di ${values.hostName}`,
    description: values.prayerOfficer ? `Petugas doa: ${values.prayerOfficer}` : null,
    host_name: values.hostName,
    prayer_officer: values.prayerOfficer || null,
    starts_at: values.startsAt,
    location: values.location || null,
    map_url: values.mapUrl || null,
  }

  if (values.id) {
    const { error } = await client.from('events').update(payload).eq('id', values.id)
    if (error) throw error
    return
  }

  const { error } = await client.from('events').insert({ ...payload, created_by: createdBy })
  if (error) throw error
}

export async function deleteEvent(eventId: string) {
  const client = requireSupabase()
  const { error } = await client.from('events').delete().eq('id', eventId)
  if (error) throw error
}

export async function saveDeceasedPerson(values: DeceasedFormValues) {
  const client = requireSupabase()
  const payload = {
    full_name: values.fullName,
    lineage_label: values.lineageLabel || null,
    father_name: values.fatherName || null,
  }
  if (values.id) {
    const { error } = await client.from('legacy_deceased_people').update(payload).eq('id', values.id)
    if (error) throw error
    return
  }
  const { error } = await client.from('legacy_deceased_people').insert({
    ...payload,
    legacy_source_key: `app:${crypto.randomUUID()}`,
  })
  if (error) throw error
}

export async function deleteDeceasedPerson(personId: string) {
  const client = requireSupabase()
  const { error } = await client.from('legacy_deceased_people').delete().eq('id', personId)
  if (error) throw error
}

export async function saveWinner(values: WinnerFormValues) {
  const client = requireSupabase()
  const payload = {
    period_label: values.periodLabel,
    winner_name: values.winnerName,
    description: values.description || null,
  }
  if (values.id) {
    const { error } = await client.from('legacy_arisan_winners').update(payload).eq('id', values.id)
    if (error) throw error
    return
  }
  const { error } = await client.from('legacy_arisan_winners').insert({
    ...payload,
    legacy_source_key: `app:${crypto.randomUUID()}`,
  })
  if (error) throw error
}

export async function deleteWinner(winnerId: string) {
  const client = requireSupabase()
  const { error } = await client.from('legacy_arisan_winners').delete().eq('id', winnerId)
  if (error) throw error
}

export async function savePrayerNote(values: PrayerNoteFormValues, createdBy: string) {
  const client = requireSupabase()
  const payload = { title: values.title, body: values.body, is_pinned: values.isPinned }
  if (values.id) {
    const { error } = await client.from('prayer_notes').update(payload).eq('id', values.id)
    if (error) throw error
    return
  }
  const { error } = await client.from('prayer_notes').insert({ ...payload, created_by: createdBy })
  if (error) throw error
}

export async function deletePrayerNote(noteId: string) {
  const client = requireSupabase()
  const { error } = await client.from('prayer_notes').delete().eq('id', noteId)
  if (error) throw error
}

export interface ContributionSettlementResult {
  success: boolean
  message: string
  settlement_id: string | null
  total_amount: number | null
}

export async function settleContribution(input: ContributionFormValues): Promise<ContributionSettlementResult> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('settle_member_iuran', {
    p_member_id: input.memberId,
    p_period_count: input.periodCount,
    p_pin: input.pin,
  })

  if (error) throw error
  const result = data?.[0]
  if (!result) throw new Error('Respons pelunasan tidak valid.')
  return result
}

export async function reverseContribution(input: { memberId: string; pin: string }) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('reverse_member_iuran', {
    p_member_id: input.memberId,
    p_pin: input.pin,
  })

  if (error) throw error
  const result = data?.[0]
  if (!result) throw new Error('Respons pembatalan tidak valid.')
  if (!result.success) throw new Error(result.message)
  return result
}

export function getCommunityErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''

  if (message.includes('pin bendahara') || message.includes('pelunasan') || message.includes('periode') || message.includes('koreksi') || message.includes('anggota') || message.includes('tidak memiliki izin') || message.includes('nama')) {
    return error instanceof Error ? error.message : 'Data belum dapat disimpan.'
  }

  if (message.includes('schema cache') || message.includes('could not find the function') || message.includes('pgrst202')) {
    return 'Migration CRUD pengurus belum dijalankan di database.'
  }

  if (message.includes('permission') || message.includes('row-level security')) {
    return 'Anda tidak memiliki izin untuk mengubah data ini.'
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'Koneksi ke Supabase bermasalah. Periksa internet lalu coba lagi.'
  }

  return error instanceof Error ? error.message : 'Data komunitas belum dapat dimuat. Silakan coba lagi.'
}
