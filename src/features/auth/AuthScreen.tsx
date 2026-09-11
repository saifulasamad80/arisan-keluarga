import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '../../components/ui/button'
import { formatAuthError } from './useAuth'
import { supabase } from '../../lib/supabase'

const authSchema = z.object({
  fullName: z.string().trim(),
  email: z.string().trim().email('Masukkan email yang valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
})

type AuthFormInput = z.input<typeof authSchema>
type AuthFormValues = z.output<typeof authSchema>

interface AuthScreenProps {
  initialError?: string | null
  onClose?: () => void
}

export function AuthScreen({ initialError, onClose }: AuthScreenProps) {
  const [isRegistering, setIsRegistering] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(
    initialError ? { type: 'error', text: initialError } : null,
  )
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AuthFormInput, unknown, AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  })

  function switchMode() {
    setIsRegistering((current) => !current)
    setMessage(null)
    reset()
  }

  async function onSubmit(values: AuthFormValues) {
    if (!supabase) return

    setIsSubmitting(true)
    setMessage(null)

    if (isRegistering && values.fullName.length < 2) {
      setMessage({ type: 'error', text: 'Nama minimal 2 karakter.' })
      setIsSubmitting(false)
      return
    }

    const result = isRegistering
      ? await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: { data: { full_name: values.fullName } },
        })
      : await supabase.auth.signInWithPassword({ email: values.email, password: values.password })

    setIsSubmitting(false)

    if (result.error) {
      setMessage({ type: 'error', text: formatAuthError(result.error.message) })
      return
    }

    if (isRegistering && !result.data.session) {
      setMessage({
        type: 'success',
        text: 'Akun berhasil dibuat. Silakan konfirmasi email sebelum masuk.',
      })
      reset({ fullName: values.fullName, email: values.email, password: '' })
      return
    }

    setMessage(null)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7fbfa] px-4 py-8 sm:px-6">
      <section className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-lg shadow-teal-900/15">
            <ShieldCheck size={29} />
          </div>
          <p className="mt-4 text-sm font-bold uppercase tracking-[0.18em] text-teal-700">Arisan IKT</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {isRegistering ? 'Buat akun pengurus' : 'Selamat datang kembali'}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
            {isRegistering
              ? 'Daftar untuk bergabung dan mengelola kegiatan keluarga IKT.'
              : 'Masuk untuk mengelola arisan, kas, anggota, dan buku doa IKT.'}
          </p>
        </div>

        {onClose && (
          <Button type="button" variant="ghost" className="mb-3 w-full" onClick={onClose}>
            Kembali ke aplikasi
          </Button>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-7">
          {message && (
            <div
              role="alert"
              className={`mb-5 rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                message.type === 'error'
                  ? 'bg-rose-50 text-rose-700'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {message.text}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {isRegistering && (
              <label className="block text-sm font-semibold text-slate-700">
                Nama lengkap
                <div className="relative mt-1.5">
                  <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input
                    {...register('fullName')}
                    autoComplete="name"
                    placeholder="Nama lengkap"
                    className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                </div>
                {errors.fullName && <span className="mt-1 block text-xs font-normal text-rose-600">{errors.fullName.message}</span>}
              </label>
            )}

            <label className="block text-sm font-semibold text-slate-700">
              Email
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  placeholder="nama@email.com"
                  className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </div>
              {errors.email && <span className="mt-1 block text-xs font-normal text-rose-600">{errors.email.message}</span>}
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Password
              <div className="relative mt-1.5">
                <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isRegistering ? 'new-password' : 'current-password'}
                  placeholder="Minimal 6 karakter"
                  className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-11 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {errors.password && <span className="mt-1 block text-xs font-normal text-rose-600">{errors.password.message}</span>}
            </label>

            <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="animate-spin" size={17} />}
              {isSubmitting ? 'Memproses...' : isRegistering ? 'Buat akun' : 'Masuk'}
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">
            {isRegistering ? 'Sudah memiliki akun?' : 'Belum memiliki akun?'}{' '}
            <button type="button" onClick={switchMode} className="font-semibold text-teal-700 hover:text-teal-800">
              {isRegistering ? 'Masuk di sini' : 'Daftar sekarang'}
            </button>
          </div>
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-slate-400">
          Data keluarga IKT dilindungi oleh autentikasi dan kebijakan akses Supabase.
        </p>
      </section>
    </main>
  )
}