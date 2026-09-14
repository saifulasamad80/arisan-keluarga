import { useState } from 'react'
import type { FormEvent } from 'react'
import { Undo2, X } from 'lucide-react'
import { Button } from '../../components/ui/button'
import type { CommunityMember } from './communityRepository'
import { getContributionMemberType, calculateContributionTotal } from '../finance/contributionRules'

interface BatalLunasFormProps {
  member: CommunityMember
  onClose: () => void
  onSubmit: (values: { memberId: string; pin: string }) => Promise<boolean>
  error?: string | null
}

export function BatalLunasForm({ member, onClose, onSubmit, error }: BatalLunasFormProps) {
  const [pin, setPin] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const memberType = getContributionMemberType(member.member_type)
  const estimatedTotal = calculateContributionTotal(memberType, 1)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!/^\d{4}$/.test(pin)) return setValidationError('PIN bendahara harus terdiri dari 4 digit.')
    setValidationError(null)
    setIsSubmitting(true)
    const saved = await onSubmit({ memberId: member.id, pin })
    setIsSubmitting(false)
    if (saved) onClose()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Batal Lunas</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">{member.full_name}</h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Tutup"><X size={19} /></Button>
        </div>
        {(error || validationError) && <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-700">{validationError ?? error}</p>}
        <p className="rounded-xl bg-amber-50 px-3 py-3 text-xs leading-relaxed text-amber-900">
          Status kembali ke <strong>BELUM</strong>, tunggakan dikembalikan ke nilai sebelum pelunasan, dan satu pengeluaran
          <strong> Koreksi/Pembatalan</strong> dicatat senilai pelunasan aktif (biasanya Rp{estimatedTotal.toLocaleString('id-ID')} per periode).
        </p>
        <form className="mt-4 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
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
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Tutup</Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}><Undo2 size={17} /> {isSubmitting ? 'Memproses...' : 'Batalkan lunas'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
