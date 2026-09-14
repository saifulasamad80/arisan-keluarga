import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './ui/button'

export const fieldClass =
  'mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100'

export const areaClass =
  'mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100'

interface FormSheetProps {
  eyebrow: string
  title: string
  error?: string | null
  onClose: () => void
  children: ReactNode
}

export function FormSheet({ eyebrow, title, error, onClose, children }: FormSheetProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">{eyebrow}</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">{title}</h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Tutup"><X size={19} /></Button>
        </div>
        {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-700">{error}</p>}
        {children}
      </div>
    </div>
  )
}
