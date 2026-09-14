import { useState } from 'react'
import type { FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import { FormSheet, fieldClass } from './FormSheet'

interface ConfirmDeleteDialogProps {
  title: string
  message: string
  requirePin?: boolean
  error?: string | null
  onClose: () => void
  onConfirm: (pin?: string) => Promise<boolean>
}

export function ConfirmDeleteDialog({ title, message, requirePin, error, onClose, onConfirm }: ConfirmDeleteDialogProps) {
  const [pin, setPin] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (requirePin && !/^\d{4}$/.test(pin)) return setValidationError('PIN bendahara harus terdiri dari 4 digit.')
    setValidationError(null)
    setIsSubmitting(true)
    const deleted = await onConfirm(requirePin ? pin : undefined)
    setIsSubmitting(false)
    if (deleted) onClose()
  }

  return (
    <FormSheet eyebrow="Hapus data" title={title} error={validationError ?? error} onClose={onClose}>
      <p className="rounded-xl bg-rose-50 px-3 py-3 text-xs leading-relaxed text-rose-900">{message}</p>
      <form className="mt-4 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        {requirePin && (
          <label className="block text-sm font-semibold text-slate-700">
            PIN bendahara
            <input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={4}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
              placeholder="4 digit"
              className={fieldClass}
            />
          </label>
        )}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
          <Button type="submit" className="flex-1 bg-rose-700 hover:bg-rose-800" disabled={isSubmitting}>
            <Trash2 size={17} /> {isSubmitting ? 'Menghapus...' : 'Hapus'}
          </Button>
        </div>
      </form>
    </FormSheet>
  )
}
