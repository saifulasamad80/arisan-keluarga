import { useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { Button } from '../../components/ui/button'
import type { CommunityMember } from './communityRepository'
import { getContributionMemberType, getContributionSplit, calculateContributionTotal, type ContributionMemberType } from '../finance/contributionRules'

function getMemberDisplayName(member: CommunityMember) {
  const name = member.full_name.trim()
  return name && !name.includes('@') ? name : 'Nama belum diatur'
}

export interface ContributionFormValues {
  memberId: string
  periodCount: number
  pin: string
}

interface ContributionFormProps {
  members: CommunityMember[]
  presetMemberId?: string
  onClose: () => void
  onSubmit: (values: ContributionFormValues) => Promise<boolean>
  error?: string | null
}

export function ContributionForm({ members, presetMemberId, onClose, onSubmit, error }: ContributionFormProps) {
  const [memberId, setMemberId] = useState(presetMemberId ?? members.find((member) => member.period_status === 'BELUM')?.id ?? '')
  const [periodCount, setPeriodCount] = useState('1')
  const [pin, setPin] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const selectedMember = members.find((member) => member.id === memberId)
  const memberType: ContributionMemberType = getContributionMemberType(selectedMember?.member_type)
  const split = getContributionSplit(memberType)
  const parsedPeriodCount = Number(periodCount)
  const validPeriodCount = Number.isInteger(parsedPeriodCount) && parsedPeriodCount > 0
  const total = validPeriodCount ? calculateContributionTotal(memberType, parsedPeriodCount) : 0

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!memberId) return setValidationError('Pilih anggota terlebih dahulu.')
    if (selectedMember?.period_status === 'LUNAS') return setValidationError('Anggota ini sudah LUNAS. Gunakan Batal Lunas jika perlu koreksi.')
    if (!Number.isInteger(Number(periodCount)) || Number(periodCount) < 1) return setValidationError('Jumlah periode harus berupa bilangan bulat positif.')
    if (!/^\d{4}$/.test(pin)) return setValidationError('PIN bendahara harus terdiri dari 4 digit.')

    setValidationError(null)
    setIsSubmitting(true)
    const saved = await onSubmit({ memberId, periodCount: Number(periodCount), pin })
    setIsSubmitting(false)
    if (saved) onClose()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Set Lunas</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Catat pelunasan iuran</h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Tutup"><X size={19} /></Button>
        </div>
        {(error || validationError) && <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-700">{validationError ?? error}</p>}
        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <label className="block text-sm font-semibold text-slate-700">
            Nama anggota
            <select
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
              disabled={Boolean(presetMemberId)}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            >
              <option value="">Pilih anggota</option>
              {members.filter((member) => member.is_active).map((member) => (
                <option key={member.id} value={member.id}>
                  {getMemberDisplayName(member)} · {member.member_type} · {member.period_status}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Jumlah periode
            <input
              type="number"
              min="1"
              step="1"
              value={periodCount}
              onChange={(event) => setPeriodCount(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </label>
          <section className="rounded-xl bg-teal-50 p-3 text-xs text-teal-900">
            <p className="font-bold">Auto-split · {memberType === 'arisan' ? 'Arisan Rp 240.000' : 'Non-Arisan Rp 100.000'}</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <span>Arisan: Rp{split.arisan.toLocaleString('id-ID')}</span>
              <span>Wajib: Rp{split.wajib.toLocaleString('id-ID')}</span>
              <span>Sosial: Rp{split.sosial.toLocaleString('id-ID')}</span>
              <span>Konsumsi: Rp{split.konsumsi.toLocaleString('id-ID')}</span>
              <span>Kaos: Rp{split.kaos.toLocaleString('id-ID')}</span>
            </div>
            <p className="mt-2 border-t border-teal-200 pt-2 font-bold">Total: Rp{total.toLocaleString('id-ID')} untuk {periodCount || 0} periode</p>
            {selectedMember && <p className="mt-1">Tunggakan saat ini: {selectedMember.arrears_periods} periode. Setelah lunas menjadi {Math.max(0, selectedMember.arrears_periods - (validPeriodCount ? parsedPeriodCount : 0))}.</p>}
          </section>
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
            <Button type="submit" className="flex-1" disabled={isSubmitting}><CheckCircle2 size={17} /> {isSubmitting ? 'Menyimpan...' : 'Set Lunas'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
