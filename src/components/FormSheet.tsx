import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './ui/button'

export const fieldClass =
  'mt-1.5 h-12 w-full rounded-2xl border-2 border-stone-300 bg-white px-3.5 text-base font-medium text-stone-900 outline-none placeholder:text-stone-500 focus:border-teal-700 focus:ring-4 focus:ring-teal-100'

export const areaClass =
  'mt-1.5 w-full resize-none rounded-2xl border-2 border-stone-300 bg-white px-3.5 py-3 text-base font-medium text-stone-900 outline-none placeholder:text-stone-500 focus:border-teal-700 focus:ring-4 focus:ring-teal-100'

interface FormSheetProps {
  eyebrow: string
  title: string
  error?: string | null
  onClose: () => void
  children: ReactNode
}

export function FormSheet({ eyebrow, title, error, onClose, children }: FormSheetProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-stone-950/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.08em] text-teal-800">{eyebrow}</p>
            <h2 className="mt-1 text-2xl font-black text-stone-950">{title}</h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Tutup"><X size={22} /></Button>
        </div>
        {error && <p role="alert" className="mb-4 rounded-2xl bg-rose-100 px-3 py-3 text-sm font-medium leading-relaxed text-rose-900">{error}</p>}
        {children}
      </div>
    </div>
  )
}
