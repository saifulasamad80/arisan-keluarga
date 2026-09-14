import { useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { FormSheet, fieldClass } from '../../components/FormSheet'
import { MANUAL_EXPENSE_CATEGORIES } from './contributionRules'
import type { CashTransaction } from './financeRepository'

export interface CashTransactionFormValues {
  id: string
  description: string
  amount: number
  category: string
  occurredOn: string
  pin: string
}

interface CashTransactionFormProps {
  transaction: CashTransaction
  onClose: () => void
  onSubmit: (values: CashTransactionFormValues) => Promise<boolean>
  error?: string | null
}

export function CashTransactionForm({ transaction, onClose, onSubmit, error }: CashTransactionFormProps) {
  const [description, setDescription] = useState(transaction.description)
  const [amount, setAmount] = useState(String(Number(transaction.amount)))
  const [category, setCategory] = useState(transaction.category)
  const [occurredOn, setOccurredOn] = useState(transaction.occurred_on)
  const [pin, setPin] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const categories = (MANUAL_EXPENSE_CATEGORIES as readonly string[]).includes(category)
    ? MANUAL_EXPENSE_CATEGORIES
    : [...MANUAL_EXPENSE_CATEGORIES, category]

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (description.trim().length < 3) return setValidationError('Keterangan minimal 3 karakter.')
    const parsedAmount = Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return setValidationError('Nominal harus lebih dari 0.')
    if (!occurredOn) return setValidationError('Tanggal transaksi wajib diisi.')
    if (!/^\d{4}$/.test(pin)) return setValidationError('PIN bendahara harus terdiri dari 4 digit.')
    setValidationError(null)
    setIsSubmitting(true)
    const saved = await onSubmit({
      id: transaction.id,
      description: description.trim(),
      amount: parsedAmount,
      category,
      occurredOn,
      pin,
    })
    setIsSubmitting(false)
    if (saved) onClose()
  }

  return (
    <FormSheet eyebrow="Buku kas" title="Ubah transaksi" error={validationError ?? error} onClose={onClose}>
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <label className="block text-sm font-semibold text-slate-700">
          Keterangan
          <input value={description} onChange={(event) => setDescription(event.target.value)} className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Nominal (Rupiah)
          <input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Pos dana
          <select value={category} onChange={(event) => setCategory(event.target.value)} className={fieldClass}>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Tanggal
          <input type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          PIN bendahara
          <input type="password" inputMode="numeric" autoComplete="current-password" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} placeholder="4 digit" className={fieldClass} />
        </label>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}><CheckCircle2 size={17} /> {isSubmitting ? 'Menyimpan...' : 'Simpan'}</Button>
        </div>
      </form>
    </FormSheet>
  )
}
