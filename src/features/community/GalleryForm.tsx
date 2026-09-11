import { useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2, ImagePlus, X } from 'lucide-react'
import { Button } from '../../components/ui/button'

export interface GalleryFormValues {
  title: string
  caption: string
  takenOn: string
  file: File
}

interface GalleryFormProps {
  onClose: () => void
  onSubmit: (values: GalleryFormValues) => Promise<boolean>
  error?: string | null
}

export function GalleryForm({ onClose, onSubmit, error }: GalleryFormProps) {
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [takenOn, setTakenOn] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (title.trim().length < 3) {
      setValidationError('Judul foto minimal 3 karakter.')
      return
    }
    if (!file) {
      setValidationError('Pilih satu foto terlebih dahulu.')
      return
    }
    if (!file.type.startsWith('image/')) {
      setValidationError('File yang dipilih harus berupa foto.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setValidationError('Ukuran foto maksimal 8 MB.')
      return
    }

    setValidationError(null)
    setIsSubmitting(true)
    const saved = await onSubmit({ title: title.trim(), caption: caption.trim(), takenOn, file })
    setIsSubmitting(false)
    if (saved) onClose()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Galeri</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Tambah foto kegiatan</h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Tutup"><X size={19} /></Button>
        </div>

        {(error || validationError) && <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-700">{validationError ?? error}</p>}

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <label className="block text-sm font-semibold text-slate-700">
            Judul foto
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Contoh: Arisan keluarga bulan Juni" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Keterangan <span className="font-normal text-slate-400">(opsional)</span>
            <textarea value={caption} onChange={(event) => setCaption(event.target.value)} rows={3} placeholder="Tulis keterangan singkat..." className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Tanggal kegiatan <span className="font-normal text-slate-400">(opsional)</span>
            <input type="date" value={takenOn} onChange={(event) => setTakenOn(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
          </label>
          <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-teal-300 bg-teal-50/60 px-4 text-center text-sm text-teal-800 hover:bg-teal-50">
            <ImagePlus size={24} />
            <span className="mt-2 font-semibold">{file ? file.name : 'Pilih foto dari perangkat'}</span>
            <span className="mt-1 text-xs text-teal-700/70">JPG, PNG, atau WEBP · maksimal 8 MB</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}><CheckCircle2 size={17} /> {isSubmitting ? 'Mengunggah...' : 'Simpan foto'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}