import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { ContributionFormValues } from './ContributionForm'
import {
  getCommunityErrorMessage,
  listMembers,
  listPublicContributions,
  listLegacyContributionStatus,
  listLegacyDeceasedPeople,
  listGalleryPhotos,
  listMembersForReminder,
  uploadGalleryPhoto,
  settleContribution,
  type GalleryPhoto,
  type PublicContribution,
  type LegacyContributionStatus,
  type LegacyDeceasedPerson,
  listPrayerNotes,
  listUpcomingEvents,
  type CommunityEvent,
  type CommunityMember,
  type PrayerNote,
} from './communityRepository'

interface CommunityState {
  events: CommunityEvent[]
  prayerNotes: PrayerNote[]
  members: CommunityMember[]
  contributions: PublicContribution[]
  legacyContributionStatus: LegacyContributionStatus[]
  legacyDeceasedPeople: LegacyDeceasedPerson[]
  galleryPhotos: GalleryPhoto[]
  reminderMembers: Array<CommunityMember & { phone: string | null }>
  isSavingGallery: boolean
  saveGalleryPhoto: (values: { title: string; caption: string; takenOn: string; file: File }) => Promise<boolean>
  isSavingContribution: boolean
  saveContribution: (values: ContributionFormValues) => Promise<boolean>
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
  clearError: () => void
}

export function useCommunity(userId: string | null): CommunityState {
  const [events, setEvents] = useState<CommunityEvent[]>([])
  const [prayerNotes, setPrayerNotes] = useState<PrayerNote[]>([])
  const [members, setMembers] = useState<CommunityMember[]>([])
  const [contributions, setContributions] = useState<PublicContribution[]>([])
  const [legacyContributionStatus, setLegacyContributionStatus] = useState<LegacyContributionStatus[]>([])
  const [legacyDeceasedPeople, setLegacyDeceasedPeople] = useState<LegacyDeceasedPerson[]>([])
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>([])
  const [reminderMembers, setReminderMembers] = useState<Array<CommunityMember & { phone: string | null }>>([])
  const [isLoading, setIsLoading] = useState(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)
  const [isSavingGallery, setIsSavingGallery] = useState(false)
  const [isSavingContribution, setIsSavingContribution] = useState(false)

  const reload = useCallback(async () => {
    if (!supabase) {
      setEvents([])
      setPrayerNotes([])
      setMembers([])
      setContributions([])
      setLegacyContributionStatus([])
      setLegacyDeceasedPeople([])
      setGalleryPhotos([])
      setReminderMembers([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [nextEvents, nextGalleryPhotos, nextLegacyDeceasedPeople] = await Promise.all([
        listUpcomingEvents(),
        listGalleryPhotos(),
        listLegacyDeceasedPeople(),
      ])
      let nextPrayerNotes: PrayerNote[] = []
      let nextMembers: CommunityMember[] = []
      let nextContributions: PublicContribution[] = []
      let nextLegacyContributionStatus: LegacyContributionStatus[] = []

      // Data keuangan, iuran, anggota, dan catatan doa tidak boleh diminta
      // oleh anonymous. Selain mengurangi kebocoran metadata, ini mencegah
      // halaman publik memanggil view yang memang hanya untuk authenticated.
      if (userId) {
        const [prayerNotes, members, contributions, legacyContributionStatus] = await Promise.all([
          listPrayerNotes(),
          listMembers(),
          listPublicContributions(),
          listLegacyContributionStatus(),
        ])
        nextPrayerNotes = prayerNotes
        nextMembers = members
        nextContributions = contributions
        nextLegacyContributionStatus = legacyContributionStatus
      }
      setEvents(nextEvents)
      setPrayerNotes(nextPrayerNotes)
      setMembers(nextMembers)
      setContributions(nextContributions)
      setLegacyContributionStatus(nextLegacyContributionStatus)
      setLegacyDeceasedPeople(nextLegacyDeceasedPeople)
      setGalleryPhotos(nextGalleryPhotos)
      if (userId) {
        setReminderMembers(await listMembersForReminder())
      } else {
        setReminderMembers([])
      }
    } catch (loadError) {
      setError(getCommunityErrorMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  const saveGalleryPhoto = useCallback(async (values: { title: string; caption: string; takenOn: string; file: File }) => {
    if (!userId) {
      setError('Silakan masuk sebagai pengurus untuk menambah foto.')
      return false
    }
    setIsSavingGallery(true)
    setError(null)
    try {
      await uploadGalleryPhoto({ ...values, createdBy: userId })
      await reload()
      return true
    } catch (saveError) {
      setError(getCommunityErrorMessage(saveError))
      return false
    } finally {
      setIsSavingGallery(false)
    }
  }, [reload, userId])

  const saveContribution = useCallback(async (values: ContributionFormValues) => {
    if (!userId) {
      setError('Silakan masuk sebagai pengurus untuk mencatat iuran.')
      return false
    }
    setIsSavingContribution(true)
    setError(null)
    try {
      const result = await settleContribution(values)
      if (!result.success) throw new Error(result.message)
      await reload()
      return true
    } catch (saveError) {
      setError(getCommunityErrorMessage(saveError))
      return false
    } finally {
      setIsSavingContribution(false)
    }
  }, [reload, userId])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    events,
    prayerNotes,
    members,
    contributions,
    legacyContributionStatus,
    legacyDeceasedPeople,
    galleryPhotos,
    reminderMembers,
    isSavingGallery,
    saveGalleryPhoto,
    isSavingContribution,
    saveContribution,
    isLoading,
    error,
    reload,
    clearError: () => setError(null),
  }
}