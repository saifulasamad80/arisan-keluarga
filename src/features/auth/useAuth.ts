import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { supabase } from '../../lib/supabase'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthState {
  session: Session | null
  profile: Profile | null
  isLoading: boolean
  isProfileLoading: boolean
  error: string | null
  signOut: () => Promise<void>
  clearError: () => void
}

function getAuthErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase()

  if (normalizedMessage.includes('email not confirmed')) {
    return 'Email belum dikonfirmasi. Silakan cek inbox email Anda terlebih dahulu.'
  }

  if (normalizedMessage.includes('invalid login credentials')) {
    return 'Email atau password salah.'
  }

  if (normalizedMessage.includes('user already registered')) {
    return 'Email tersebut sudah terdaftar. Silakan masuk menggunakan akun Anda.'
  }

  if (normalizedMessage.includes('password')) {
    return 'Password minimal 6 karakter.'
  }

  return 'Terjadi kendala saat menghubungkan ke Supabase. Silakan coba lagi.'
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(supabase))
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false)
      return
    }

    let isMounted = true

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!isMounted) return
      if (sessionError) setError(getAuthErrorMessage(sessionError.message))
      setSession(data.session)
      setIsLoading(false)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return
      setSession(nextSession)
      setError(null)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session?.user.id) {
      setProfile(null)
      setIsProfileLoading(false)
      return
    }

    let isMounted = true
    setIsProfileLoading(true)

    void supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error: profileError }) => {
        if (!isMounted) return
        if (profileError) {
          setError('Profil akun belum dapat dimuat. Pastikan migration Supabase sudah lengkap.')
          setProfile(null)
        } else {
          setProfile(data)
        }
        setIsProfileLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [session])

  async function signOut() {
    if (!supabase) return
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) setError(getAuthErrorMessage(signOutError.message))
  }

  return {
    session,
    profile,
    isLoading,
    isProfileLoading,
    error,
    signOut,
    clearError: () => setError(null),
  }
}

export function formatAuthError(message: string) {
  return getAuthErrorMessage(message)
}