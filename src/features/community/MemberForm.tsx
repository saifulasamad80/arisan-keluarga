import { useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { FormSheet, fieldClass } from '../../components/FormSheet'

export interface MemberFormValues {
  id?: string
  fullName: string
  memberType: 'Arisan' | 'Non-Arisan'
  periodStatus: 'LUNAS' | 'BELUM'
  arrearsPeriods: number
  phone: string
}

interface MemberFormProps {
  member?: {
    id: string
    full_name: string
    member_type: string
    period_status: 'LUNAS' | 'BELUM'
    arrears_periods: number
    phone?: string | null
  } | null
  onClose: () => void
  onSubmit: (values: MemberFormValues) => Promise<boolean>
  error?: string | null
}

export function MemberForm({ member, onClose, onSubmit, error }: MemberFormProps) {
  const [fullName, setFullName] = useState(member?.full_name ?? '')
  const [memberType, setMemberType] = useState<'Arisan' | 'Non-Arisan'>(member?.member_type === 'Non-Arisan' ? 'Non-Arisan' : 'Arisan')
  const [periodStatus, setPeriodStatus] = useState<'LUNAS' | 'BELUM'>(member?.period_status === 'LUNAS' ? 'LUNAS' : 'BELUM')
  const [arrearsPeriods, setArrearsPeriods] = useState(String(member?.arrears_periods ?? 0))
  const [phone, setPhone] = useState(member?.phone ?? '')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (fullName.trim().length < 2) return setValidationError('Nama anggota minimal 2 karakter.')
    const parsedArrears = Number(arrearsPeriods)
    if (!Number.isInteger(parsedArrears) || parsedArrears < 0) return setValidationError('Tunggakan harus bilangan bulat 0 atau lebih.')
    setValidationError(null)
    setIsSubmitting(true)
    const saved = await onSubmit({
      id: member?.id,
      fullName: fullName.trim(),
      memberType,
      periodStatus,
      arrearsPeriods: parsedArrears,
      phone: phone.trim(),
    })
    setIsSubmitting(false)
    if (saved) onClose()
  }

  return (
    <FormSheet
      eyebrow="Roster Status_Iuran"
      title={member ? 'Ubah data anggota' : 'Tambah anggota'}
      error={validationError ?? error}
      onClose={onClose}
    >
      <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
        Mengubah status atau tunggakan di sini tidak mencatat kas. Gunakan Set Lunas jika uang benar-benar diterima.
      </p>
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <label className="block text-sm font-semibold text-slate-700">
          Nama anggota
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Tipe
          <select value={memberType} onChange={(event) => setMemberType(event.target.value as 'Arisan' | 'Non-Arisan')} className={fieldClass}>
            <option value="Arisan">Arisan</option>
            <option value="Non-Arisan">Non-Arisan</option>
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Status periode ini
          <select value={periodStatus} onChange={(event) => setPeriodStatus(event.target.value as 'LUNAS' | 'BELUM')} className={fieldClass}>
            <option value="BELUM">BELUM</option>
            <option value="LUNAS">LUNAS</option>
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Tunggakan (jumlah periode)
          <input type="number" min="0" step="1" value={arrearsPeriods} onChange={(event) => setArrearsPeriods(event.target.value)} className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Nomor HP <span className="font-normal text-slate-400">(opsional)</span>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="08..." className={fieldClass} />
        </label>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}><CheckCircle2 size={17} /> {isSubmitting ? 'Menyimpan...' : 'Simpan'}</Button>
        </div>
      </form>
    </FormSheet>
  )
}
