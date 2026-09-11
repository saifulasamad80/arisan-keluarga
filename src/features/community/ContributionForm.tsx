import { useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { Button } from '../../components/ui/button'
import type { CommunityMember } from './communityRepository'

export interface ContributionFormValues {
  memberId: string
  periodStart: string
  periodEnd: string
  amount: number
  status: 'paid' | 'pending'
}

interface ContributionFormProps {
  members: CommunityMember[]
  onClose: () => void
  onSubmit: (values: ContributionFormValues) => Promise<boolean>
  error?: string | null
}

export function ContributionForm({ members, onClose, onSubmit, error }: ContributionFormProps) {
  const [memberId, setMemberId] = useState(members[0]?.id ?? '')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState<'paid' | 'pending'>('paid')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!memberId) return setValidationError('Pilih anggota terlebih dahulu.')
    if (!periodStart || !periodEnd || periodEnd < periodStart) return setValidationError('Periksa periode pembayaran.')
    if (Number(amount) <= 0) return setValidationError('Nominal harus lebih dari 0.')

    setValidationError(null)
    setIsSubmitting(true)
    const saved = await onSubmit({ memberId, periodStart, periodEnd, amount: Number(amount), status })
    setIsSubmitting(false)
    if (saved) onClose()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Iuran</p><h2 className="mt-1 text-xl font-bold text-slate-900">Catat pembayaran</h2></div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Tutup"><X size={19} /></Button>
        </div>
        {(error || validationError) && <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-700">{validationError ?? error}</p>}
        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <label className="block text-sm font-semibold text-slate-700">Nama anggota<select value={memberId} onChange={(event) => setMemberId(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"><option value="">Pilih anggota</option>{members.filter((member) => member.is_active).map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}</select></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold text-slate-700">Mulai periode<input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" /></label><label className="block text-sm font-semibold text-slate-700">Akhir periode<input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" /></label></div>
          <label className="block text-sm font-semibold text-slate-700">Nominal (Rupiah)<input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Contoh: 100000" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" /></label>
          <label className="block text-sm font-semibold text-slate-700">Status<select value={status} onChange={(event) => setStatus(event.target.value as 'paid' | 'pending')} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"><option value="paid">Sudah lunas</option><option value="pending">Belum lunas</option></select></label>
          <div className="flex gap-3 pt-2"><Button type="button" variant="outline" className="flex-1" onClick={onClose}>Batal</Button><Button type="submit" className="flex-1" disabled={isSubmitting}><CheckCircle2 size={17} /> {isSubmitting ? 'Menyimpan...' : 'Simpan'}</Button></div>
        </form>
      </div>
    </div>
  )
}