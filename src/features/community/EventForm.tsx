import { useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { FormSheet, fieldClass } from '../../components/FormSheet'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../../lib/utils'
import type { CommunityEvent } from './communityRepository'

export interface EventFormValues {
  id?: string
  hostName: string
  prayerOfficer: string
  startsAt: string
  location: string
  mapUrl: string
}

interface EventFormProps {
  event?: CommunityEvent | null
  onClose: () => void
  onSubmit: (values: EventFormValues) => Promise<boolean>
  error?: string | null
}

export function EventForm({ event, onClose, onSubmit, error }: EventFormProps) {
  const [hostName, setHostName] = useState(event?.host_name ?? '')
  const [prayerOfficer, setPrayerOfficer] = useState(event?.prayer_officer ?? '')
  const [startsAt, setStartsAt] = useState(event?.starts_at ? toDatetimeLocalValue(event.starts_at) : '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [mapUrl, setMapUrl] = useState(event?.map_url ?? '')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault()
    if (hostName.trim().length < 2) return setValidationError('Nama tuan rumah minimal 2 karakter.')
    const isoStartsAt = fromDatetimeLocalValue(startsAt)
    if (!isoStartsAt) return setValidationError('Tanggal dan jam acara wajib diisi.')
    if (mapUrl.trim()) {
      try {
        const url = new URL(mapUrl.trim())
        if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol')
      } catch {
        return setValidationError('Tautan peta harus berupa URL http atau https.')
      }
    }
    setValidationError(null)
    setIsSubmitting(true)
    const saved = await onSubmit({
      id: event?.id,
      hostName: hostName.trim(),
      prayerOfficer: prayerOfficer.trim(),
      startsAt: isoStartsAt,
      location: location.trim(),
      mapUrl: mapUrl.trim(),
    })
    setIsSubmitting(false)
    if (saved) onClose()
  }

  return (
    <FormSheet eyebrow="Agenda arisan" title={event ? 'Ubah agenda' : 'Tambah agenda'} error={validationError ?? error} onClose={onClose}>
      <form className="space-y-4" onSubmit={(eventSubmit) => void handleSubmit(eventSubmit)}>
        <label className="block text-sm font-semibold text-slate-700">
          Tuan rumah
          <input value={hostName} onChange={(eventChange) => setHostName(eventChange.target.value)} className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Petugas doa <span className="font-normal text-slate-400">(opsional)</span>
          <input value={prayerOfficer} onChange={(eventChange) => setPrayerOfficer(eventChange.target.value)} className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Tanggal dan jam
          <input type="datetime-local" value={startsAt} onChange={(eventChange) => setStartsAt(eventChange.target.value)} className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Alamat <span className="font-normal text-slate-400">(opsional)</span>
          <input value={location} onChange={(eventChange) => setLocation(eventChange.target.value)} className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Tautan Google Maps <span className="font-normal text-slate-400">(opsional)</span>
          <input value={mapUrl} onChange={(eventChange) => setMapUrl(eventChange.target.value)} placeholder="https://maps.google.com/..." className={fieldClass} />
        </label>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}><CheckCircle2 size={17} /> {isSubmitting ? 'Menyimpan...' : 'Simpan'}</Button>
        </div>
      </form>
    </FormSheet>
  )
}
