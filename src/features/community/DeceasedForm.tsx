import { useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { FormSheet, fieldClass } from '../../components/FormSheet'
import type { LegacyDeceasedPerson } from './communityRepository'

export interface DeceasedFormValues {
  id?: string
  fullName: string
  lineageLabel: string
  fatherName: string
}

interface DeceasedFormProps {
  person?: LegacyDeceasedPerson | null
  onClose: () => void
  onSubmit: (values: DeceasedFormValues) => Promise<boolean>
  error?: string | null
}

export function DeceasedForm({ person, onClose, onSubmit, error }: DeceasedFormProps) {
  const [fullName, setFullName] = useState(person?.full_name ?? '')
  const [lineageLabel, setLineageLabel] = useState(person?.lineage_label ?? '')
  const [fatherName, setFatherName] = useState(person?.father_name ?? '')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (fullName.trim().length < 2) return setValidationError('Nama minimal 2 karakter.')
    setValidationError(null)
    setIsSubmitting(true)
    const saved = await onSubmit({
      id: person?.id,
      fullName: fullName.trim(),
      lineageLabel: lineageLabel.trim(),
      fatherName: fatherName.trim(),
    })
    setIsSubmitting(false)
    if (saved) onClose()
  }

  return (
    <FormSheet eyebrow="Daftar almarhum" title={person ? 'Ubah nama' : 'Tambah nama'} error={validationError ?? error} onClose={onClose}>
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <label className="block text-sm font-semibold text-slate-700">
          Nama
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Bin / Binti <span className="font-normal text-slate-400">(opsional)</span>
          <input value={lineageLabel} onChange={(event) => setLineageLabel(event.target.value)} placeholder="bin / binti" className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Nama ayah <span className="font-normal text-slate-400">(opsional)</span>
          <input value={fatherName} onChange={(event) => setFatherName(event.target.value)} className={fieldClass} />
        </label>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}><CheckCircle2 size={17} /> {isSubmitting ? 'Menyimpan...' : 'Simpan'}</Button>
        </div>
      </form>
    </FormSheet>
  )
}
