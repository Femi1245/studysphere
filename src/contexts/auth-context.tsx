import type { Session, User } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { mapAuthError } from '@/lib/auth-errors'
import { isSupabaseConfigured, trySupabase } from '@/lib/supabase/client'
import type { Profile, UserPreferences } from '@/types/database'

interface AuthContextValue {
  configured: boolean
  loading: boolean
  session: Session | null
  user: User | null
  profile: Profile | null
  preferences: UserPreferences | null
  refreshProfile: () => Promise<void>
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; sessionCreated: boolean }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)

  const loadProfile = useCallback(async (userId: string) => {
    const supabase = trySupabase()
    if (!supabase) return
    const [{ data: profileData }, { data: prefsData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
    ])
    setProfile((profileData as Profile | null) ?? null)
    setPreferences((prefsData as UserPreferences | null) ?? null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) await loadProfile(session.user.id)
  }, [loadProfile, session?.user?.id])

  useEffect(() => {
    const supabase = trySupabase()
    if (!supabase) {
      setLoading(false)
      return
    }

    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) {
        void loadProfile(data.session.user.id).finally(() => {
          if (mounted) setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next?.user) {
        void loadProfile(next.user.id)
      } else {
        setProfile(null)
        setPreferences(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = trySupabase()
    if (!supabase) return { error: 'Supabase is not configured.', sessionCreated: false }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
      },
    })
    if (error) return { error: mapAuthError(error.message), sessionCreated: false }
    return { error: null, sessionCreated: Boolean(data.session) }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = trySupabase()
    if (!supabase) return { error: 'Supabase is not configured.' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return { error: null }
    return { error: mapAuthError(error.message) }
  }, [])

  const signOut = useCallback(async () => {
    const supabase = trySupabase()
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    const supabase = trySupabase()
    if (!supabase) return { error: 'Supabase is not configured.' }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error: error ? mapAuthError(error.message) : null }
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const supabase = trySupabase()
    if (!supabase) return { error: 'Supabase is not configured.' }
    const { error } = await supabase.auth.updateUser({ password })
    return { error: error ? mapAuthError(error.message) : null }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      session,
      user: session?.user ?? null,
      profile,
      preferences,
      refreshProfile,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updatePassword,
    }),
    [
      loading,
      session,
      profile,
      preferences,
      refreshProfile,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updatePassword,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
