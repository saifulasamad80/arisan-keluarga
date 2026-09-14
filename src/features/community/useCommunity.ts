import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { ContributionFormValues } from './ContributionForm'
import type { MemberFormValues } from './MemberForm'
import type { EventFormValues } from './EventForm'
import type { DeceasedFormValues } from './DeceasedForm'
import type { WinnerFormValues } from './WinnerForm'
import type { PrayerNoteFormValues } from './PrayerNoteForm'
import type { GalleryFormValues } from './GalleryForm'
import {
  getCommunityErrorMessage,
  listMembers,
  listPublicContributions,
  listLegacyContributionStatus,
  listLegacyDeceasedPeople,
  listArisanWinners,
  listGalleryPhotos,
  listMembersForReminder,
  saveGalleryPhotoRecord,
  deleteGalleryPhotoRecord,
  settleContribution,
  reverseContribution,
  upsertMember,
  deleteMember as removeMemberRecord,
  saveEvent as saveEventRecord,
  deleteEvent as removeEventRecord,
  saveDeceasedPerson,
  deleteDeceasedPerson,
  saveWinner as saveWinnerRecord,
  deleteWinner as removeWinnerRecord,
  savePrayerNote as savePrayerNoteRecord,
  deletePrayerNote as removePrayerNoteRecord,
  type GalleryPhoto,
  type PublicContribution,
  type LegacyContributionStatus,
  type LegacyDeceasedPerson,
  type ArisanWinner,
  type ManagerMember,
  listPrayerNotes,
  listEvents,
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
  winners: ArisanWinner[]
  galleryPhotos: GalleryPhoto[]
  reminderMembers: ManagerMember[]
  isSaving: boolean
  isSavingGallery: boolean
  saveGalleryPhoto: (values: GalleryFormValues) => Promise<boolean>
  deleteGalleryPhoto: (photo: GalleryPhoto) => Promise<boolean>
  saveMember: (values: MemberFormValues) => Promise<boolean>
  deleteMember: (memberId: string) => Promise<boolean>
  saveEvent: (values: EventFormValues) => Promise<boolean>
  deleteEvent: (eventId: string) => Promise<boolean>
  saveDeceased: (values: DeceasedFormValues) => Promise<boolean>
  deleteDeceased: (personId: string) => Promise<boolean>
  saveWinner: (values: WinnerFormValues) => Promise<boolean>
  deleteWinner: (winnerId: string) => Promise<boolean>
  savePrayerNote: (values: PrayerNoteFormValues) => Promise<boolean>
  deletePrayerNote: (noteId: string) => Promise<boolean>
  isSavingContribution: boolean
  saveContribution: (values: ContributionFormValues) => Promise<boolean>
  reverseContribution: (values: { memberId: string; pin: string }) => Promise<boolean>
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
  const [winners, setWinners] = useState<ArisanWinner[]>([])
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>([])
  const [reminderMembers, setReminderMembers] = useState<ManagerMember[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
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
      setWinners([])
      setGalleryPhotos([])
      setReminderMembers([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [nextEvents, nextGalleryPhotos, nextLegacyDeceasedPeople, nextWinners] = await Promise.all([
        listEvents(),
        listGalleryPhotos(),
        listLegacyDeceasedPeople(),
        listArisanWinners(),
      ])
      let nextPrayerNotes: PrayerNote[] = []
      let nextMembers: CommunityMember[] = []
      let nextContributions: PublicContribution[] = []
      let nextLegacyContributionStatus: LegacyContributionStatus[] = []

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
      setWinners(nextWinners)
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

  const runMutation = useCallback(async (task: () => Promise<unknown>) => {
    if (!userId) {
      setError('Silakan masuk sebagai pengurus untuk mengubah data.')
      return false
    }
    setIsSaving(true)
    setError(null)
    try {
      await task()
      await reload()
      return true
    } catch (saveError) {
      setError(getCommunityErrorMessage(saveError))
      return false
    } finally {
      setIsSaving(false)
    }
  }, [reload, userId])

  const saveGalleryPhoto = useCallback(async (values: GalleryFormValues) => {
    if (!userId) {
      setError('Silakan masuk sebagai pengurus untuk menambah foto.')
      return false
    }
    setIsSavingGallery(true)
    setError(null)
    try {
      const previous = values.id ? galleryPhotos.find((photo) => photo.id === values.id) : undefined
      await saveGalleryPhotoRecord({ ...values, createdBy: userId, previousImageUrl: previous?.image_url })
      await reload()
      return true
    } catch (saveError) {
      setError(getCommunityErrorMessage(saveError))
      return false
    } finally {
      setIsSavingGallery(false)
    }
  }, [galleryPhotos, reload, userId])

  const removeGalleryPhoto = useCallback(async (photo: GalleryPhoto) => {
    return runMutation(() => deleteGalleryPhotoRecord(photo))
  }, [runMutation])

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

  const undoContribution = useCallback(async (values: { memberId: string; pin: string }) => {
    if (!userId) {
      setError('Silakan masuk sebagai pengurus untuk membatalkan iuran.')
      return false
    }
    setIsSavingContribution(true)
    setError(null)
    try {
      await reverseContribution(values)
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
    winners,
    galleryPhotos,
    reminderMembers,
    isSaving,
    isSavingGallery,
    saveGalleryPhoto,
    deleteGalleryPhoto: removeGalleryPhoto,
    saveMember: (values) => runMutation(() => upsertMember(values)),
    deleteMember: (memberId) => runMutation(() => removeMemberRecord(memberId)),
    saveEvent: (values) => runMutation(() => {
      if (!userId) throw new Error('Silakan masuk sebagai pengurus untuk mengubah data.')
      return saveEventRecord(values, userId)
    }),
    deleteEvent: (eventId) => runMutation(() => removeEventRecord(eventId)),
    saveDeceased: (values) => runMutation(() => saveDeceasedPerson(values)),
    deleteDeceased: (personId) => runMutation(() => deleteDeceasedPerson(personId)),
    saveWinner: (values) => runMutation(() => saveWinnerRecord(values)),
    deleteWinner: (winnerId) => runMutation(() => removeWinnerRecord(winnerId)),
    savePrayerNote: (values) => runMutation(() => {
      if (!userId) throw new Error('Silakan masuk sebagai pengurus untuk mengubah data.')
      return savePrayerNoteRecord(values, userId)
    }),
    deletePrayerNote: (noteId) => runMutation(() => removePrayerNoteRecord(noteId)),
    isSavingContribution,
    saveContribution,
    reverseContribution: undoContribution,
    isLoading,
    error,
    reload,
    clearError: () => setError(null),
  }
}
