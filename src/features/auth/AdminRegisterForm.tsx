import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle, LockKeyhole, Mail, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '../../components/ui/button'
import { supabase } from '../../lib/supabase'

const adminRegisterSchema = z.object({
  fullName: z.string().trim().min(2, 'Nama minimal 2 karakter.'),
  email: z.string().trim().email('Masukkan email yang valid.'),
  password: z.string().min(6, 'Password minimal 6 karakter.'),
  role: z.enum(['admin', 'treasurer']),
})

type AdminRegisterValues = z.infer<typeof adminRegisterSchema>

interface AdminRegisterFormProps {
  onClose: () => void
}

export function AdminRegisterForm({ onClose }: AdminRegisterFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdminRegisterValues>({
    resolver: zodResolver(adminRegisterSchema),
    defaultValues: { fullName: '', email: '', password: '', role: 'treasurer' },
  })

  async function onSubmit(values: AdminRegisterValues) {
    if (!supabase) return
    setIsSubmitting(true)
    setMessage(null)

    const { error } = await supabase.functions.invoke('admin-create-user', {
      body: values,
    })

    setIsSubmitting(false)
    if (error) {
      setMessage({ type: 'error', text: 'Akun pengurus belum dapat dibuat. Pastikan Anda adalah admin web.' })
      return
    }

    setMessage({ type: 'success', text: 'Akun pengurus berhasil dibuat dan siap digunakan.' })
    reset({ fullName: '', email: '', password: '', role: values.role })
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/50 px-4 py-8">
      <section className="mx-auto w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="admin-register-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Khusus admin web</p>
            <h2 id="admin-register-title" className="mt-2 text-xl font-black text-slate-900">Daftarkan pengurus</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">Form ini hanya tersedia untuk admin. Jangan bagikan password awal melalui chat publik.</p>
          </div>
          <button type="button" onClick={onClose} className="flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Tutup form">
            <X size={19} />
          </button>
        </div>

        {message && <p className={`mt-5 rounded-xl px-3 py-2.5 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{message.text}</p>}

        <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <label className="block text-sm font-semibold text-slate-700">
            Nama lengkap
            <div className="relative mt-1.5">
              <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input {...register('fullName')} autoComplete="name" placeholder="Nama lengkap" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
            </div>
            {errors.fullName && <span className="mt-1 block text-xs font-normal text-rose-600">{errors.fullName.message}</span>}
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Email pengurus
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input {...register('email')} type="email" autoComplete="email" placeholder="nama@email.com" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
            </div>
            {errors.email && <span className="mt-1 block text-xs font-normal text-rose-600">{errors.email.message}</span>}
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Peran
            <select {...register('role')} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100">
              <option value="treasurer">Bendahara</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Password awal
            <div className="relative mt-1.5">
              <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input {...register('password')} type="password" autoComplete="new-password" placeholder="Minimal 6 karakter" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
            </div>
            {errors.password && <span className="mt-1 block text-xs font-normal text-rose-600">{errors.password.message}</span>}
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="animate-spin" size={17} />}
              {isSubmitting ? 'Mendaftarkan...' : 'Daftarkan pengurus'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}