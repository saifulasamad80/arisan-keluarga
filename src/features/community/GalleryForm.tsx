import { useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2, ImagePlus } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { FormSheet, fieldClass, areaClass } from '../../components/FormSheet'
import type { GalleryPhoto } from './communityRepository'

export interface GalleryFormValues {
  id?: string
  title: string
  caption: string
  takenOn: string
  file: File | null
}

interface GalleryFormProps {
  photo?: GalleryPhoto | null
  onClose: () => void
  onSubmit: (values: GalleryFormValues) => Promise<boolean>
  error?: string | null
}

export function GalleryForm({ photo, onClose, onSubmit, error }: GalleryFormProps) {
  const [title, setTitle] = useState(photo?.title ?? '')
  const [caption, setCaption] = useState(photo?.caption ?? '')
  const [takenOn, setTakenOn] = useState(photo?.taken_on ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEdit = Boolean(photo)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (title.trim().length < 3) {
      setValidationError('Judul foto minimal 3 karakter.')
      return
    }
    if (!isEdit && !file) {
      setValidationError('Pilih satu foto terlebih dahulu.')
      return
    }
    if (file && !file.type.startsWith('image/')) {
      setValidationError('File yang dipilih harus berupa foto.')
      return
    }
    if (file && file.size > 8 * 1024 * 1024) {
      setValidationError('Ukuran foto maksimal 8 MB.')
      return
    }

    setValidationError(null)
    setIsSubmitting(true)
    const saved = await onSubmit({ id: photo?.id, title: title.trim(), caption: caption.trim(), takenOn, file })
    setIsSubmitting(false)
    if (saved) onClose()
  }

  return (
    <FormSheet eyebrow="Galeri" title={isEdit ? 'Ubah foto kegiatan' : 'Tambah foto kegiatan'} error={validationError ?? error} onClose={onClose}>
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <label className="block text-sm font-semibold text-slate-700">
          Judul foto
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Contoh: Arisan keluarga bulan Juni" className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Keterangan <span className="font-normal text-slate-400">(opsional)</span>
          <textarea value={caption} onChange={(event) => setCaption(event.target.value)} rows={3} placeholder="Tulis keterangan singkat..." className={areaClass} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Tanggal kegiatan <span className="font-normal text-slate-400">(opsional)</span>
          <input type="date" value={takenOn} onChange={(event) => setTakenOn(event.target.value)} className={fieldClass} />
        </label>
        <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-teal-300 bg-teal-50/60 px-4 text-center text-sm text-teal-800 hover:bg-teal-50">
          <ImagePlus size={24} />
          <span className="mt-2 font-semibold">{file ? file.name : isEdit ? 'Ganti foto (opsional)' : 'Pilih foto dari perangkat'}</span>
          <span className="mt-1 text-xs text-teal-700/70">JPG, PNG, atau WEBP · maksimal 8 MB</span>
          <input type="file" accept="image/*" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}><CheckCircle2 size={17} /> {isSubmitting ? (isEdit ? 'Menyimpan...' : 'Mengunggah...') : 'Simpan foto'}</Button>
        </div>
      </form>
    </FormSheet>
  )
}
