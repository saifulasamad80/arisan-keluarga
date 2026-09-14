import { useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { FormSheet, fieldClass, areaClass } from '../../components/FormSheet'
import type { PrayerNote } from './communityRepository'

export interface PrayerNoteFormValues {
  id?: string
  title: string
  body: string
  isPinned: boolean
}

interface PrayerNoteFormProps {
  note?: PrayerNote | null
  onClose: () => void
  onSubmit: (values: PrayerNoteFormValues) => Promise<boolean>
  error?: string | null
}

export function PrayerNoteForm({ note, onClose, onSubmit, error }: PrayerNoteFormProps) {
  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')
  const [isPinned, setIsPinned] = useState(note?.is_pinned ?? false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (title.trim().length < 3) return setValidationError('Judul minimal 3 karakter.')
    if (body.trim().length < 3) return setValidationError('Isi catatan minimal 3 karakter.')
    setValidationError(null)
    setIsSubmitting(true)
    const saved = await onSubmit({ id: note?.id, title: title.trim(), body: body.trim(), isPinned })
    setIsSubmitting(false)
    if (saved) onClose()
  }

  return (
    <FormSheet eyebrow="Catatan doa" title={note ? 'Ubah catatan' : 'Tambah catatan'} error={validationError ?? error} onClose={onClose}>
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <label className="block text-sm font-semibold text-slate-700">
          Judul
          <input value={title} onChange={(event) => setTitle(event.target.value)} className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Isi catatan
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} className={areaClass} />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={isPinned} onChange={(event) => setIsPinned(event.target.checked)} />
          Sematkan di atas
        </label>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}><CheckCircle2 size={17} /> {isSubmitting ? 'Menyimpan...' : 'Simpan'}</Button>
        </div>
      </form>
    </FormSheet>
  )
}
