import { useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { FormSheet, fieldClass } from '../../components/FormSheet'
import type { ArisanWinner } from './communityRepository'

export interface WinnerFormValues {
  id?: string
  periodLabel: string
  winnerName: string
  description: string
}

interface WinnerFormProps {
  winner?: ArisanWinner | null
  onClose: () => void
  onSubmit: (values: WinnerFormValues) => Promise<boolean>
  error?: string | null
}

export function WinnerForm({ winner, onClose, onSubmit, error }: WinnerFormProps) {
  const [periodLabel, setPeriodLabel] = useState(winner?.period_label ?? '')
  const [winnerName, setWinnerName] = useState(winner?.winner_name ?? '')
  const [description, setDescription] = useState(winner?.description ?? '')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (periodLabel.trim().length < 3) return setValidationError('Label periode minimal 3 karakter.')
    if (winnerName.trim().length < 2) return setValidationError('Nama pemenang minimal 2 karakter.')
    setValidationError(null)
    setIsSubmitting(true)
    const saved = await onSubmit({
      id: winner?.id,
      periodLabel: periodLabel.trim(),
      winnerName: winnerName.trim(),
      description: description.trim(),
    })
    setIsSubmitting(false)
    if (saved) onClose()
  }

  return (
    <FormSheet eyebrow="Riwayat pemenang" title={winner ? 'Ubah pemenang' : 'Tambah pemenang'} error={validationError ?? error} onClose={onClose}>
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <label className="block text-sm font-semibold text-slate-700">
          Periode
          <input value={periodLabel} onChange={(event) => setPeriodLabel(event.target.value)} placeholder="Contoh: Agustus 2026" className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Nama pemenang
          <input value={winnerName} onChange={(event) => setWinnerName(event.target.value)} className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Keterangan <span className="font-normal text-slate-400">(opsional)</span>
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Pemenang 1 / Pemenang 2" className={fieldClass} />
        </label>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}><CheckCircle2 size={17} /> {isSubmitting ? 'Menyimpan...' : 'Simpan'}</Button>
        </div>
      </form>
    </FormSheet>
  )
}
