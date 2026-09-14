import { useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { formatRupiah } from '../../lib/utils'
import { EVENT_ARISAN_PAYOUT, EVENT_CONSUMPTION_PAYOUT, type EventExecutionMode } from './contributionRules'

interface ExecuteEventFormProps {
  onClose: () => void
  onSubmit: (values: { mode: EventExecutionMode; pin: string }) => Promise<boolean>
  error?: string | null
}

const MODES: Array<{ id: EventExecutionMode; title: string; detail: string }> = [
  { id: 'all', title: 'Selesaikan & eksekusi acara hari ini', detail: `Arisan ${formatRupiah(EVENT_ARISAN_PAYOUT)} + Konsumsi ${formatRupiah(EVENT_CONSUMPTION_PAYOUT)}` },
  { id: 'arisan', title: 'Serahkan arisan saja', detail: formatRupiah(EVENT_ARISAN_PAYOUT) },
  { id: 'konsumsi', title: 'Serahkan konsumsi saja', detail: formatRupiah(EVENT_CONSUMPTION_PAYOUT) },
]

export function ExecuteEventForm({ onClose, onSubmit, error }: ExecuteEventFormProps) {
  const [mode, setMode] = useState<EventExecutionMode>('all')
  const [pin, setPin] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!/^\d{4}$/.test(pin)) return setValidationError('PIN bendahara harus terdiri dari 4 digit.')
    setValidationError(null)
    setIsSubmitting(true)
    const saved = await onSubmit({ mode, pin })
    setIsSubmitting(false)
    if (saved) onClose()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Eksekusi acara</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Panel bendahara</h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Tutup"><X size={19} /></Button>
        </div>
        {(error || validationError) && <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-700">{validationError ?? error}</p>}
        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-700">Pilih transaksi</legend>
            {MODES.map((item) => (
              <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 ${mode === item.id ? 'border-teal-600 bg-teal-50' : 'border-slate-200 bg-white'}`}>
                <input type="radio" name="event-mode" className="mt-1" checked={mode === item.id} onChange={() => setMode(item.id)} />
                <span>
                  <strong className="block text-sm text-slate-900">{item.title}</strong>
                  <small className="mt-1 block text-xs text-slate-500">{item.detail}</small>
                </span>
              </label>
            ))}
          </fieldset>
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
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}><CheckCircle2 size={17} /> {isSubmitting ? 'Mencatat...' : 'Eksekusi'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
