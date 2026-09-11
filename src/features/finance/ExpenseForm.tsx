import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '../../components/ui/button'

const expenseSchema = z.object({
  description: z.string().min(3, 'Keterangan minimal 3 karakter'),
  amount: z.coerce.number().positive('Nominal harus lebih dari 0'),
  category: z.enum(['Operasional', 'Kegiatan', 'Konsumsi', 'Lainnya']),
})

type ExpenseFormInput = z.input<typeof expenseSchema>
export type ExpenseFormValues = z.output<typeof expenseSchema>

interface ExpenseFormProps {
  onClose: () => void
  onSubmit: (values: ExpenseFormValues) => Promise<void> | void
  error?: string | null
}

export function ExpenseForm({ onClose, onSubmit, error }: ExpenseFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormInput, unknown, ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { description: '', amount: 0, category: 'Operasional' },
  })

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Keuangan</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Catat pengeluaran</h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Tutup">
            <X size={19} />
          </Button>
        </div>

        {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-700">{error}</p>}

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <label className="block text-sm font-semibold text-slate-700">
            Keterangan
            <input
              {...register('description')}
              placeholder="Contoh: Konsumsi rapat bulanan"
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
            {errors.description && <span className="mt-1 block text-xs font-normal text-rose-600">{errors.description.message}</span>}
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Nominal (Rupiah)
            <input
              {...register('amount')}
              type="number"
              min="1"
              placeholder="0"
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
            {errors.amount && <span className="mt-1 block text-xs font-normal text-rose-600">{errors.amount.message}</span>}
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Kategori
            <select
              {...register('category')}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            >
              <option>Operasional</option>
              <option>Kegiatan</option>
              <option>Konsumsi</option>
              <option>Lainnya</option>
            </select>
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              <CheckCircle2 size={17} /> Simpan
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}