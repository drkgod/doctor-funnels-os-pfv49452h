import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthState {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  error: string | null
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signUpWithEmail: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: string | null }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  signOut: () => Promise<{ error: string | null }>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  isAuthenticated: boolean
  isAdmin: boolean
  isDoctor: boolean
  isSecretary: boolean
  tenantId: string | null
  isTabVisible: React.MutableRefObject<boolean>
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const profileRef = useRef<Profile | null>(null)
  const userRef = useRef<User | null>(null)
  const isTabVisible = useRef<boolean>(true)

  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabVisible.current = document.visibilityState === 'visible'
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const fetchProfile = (userId: string, callback?: (p: Profile | null) => void) => {
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) {
          profileRef.current = data
          setProfile(data)
          if (callback) callback(data)
        } else {
          profileRef.current = null
          setProfile(null)
          if (callback) callback(null)
        }
      })
      .catch(() => {
        if (callback) callback(null)
      })
  }

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted) return
      setSession(initialSession)
      setUser(initialSession?.user ?? null)
      userRef.current = initialSession?.user ?? null

      if (initialSession?.user) {
        fetchProfile(initialSession.user.id, () => {
          if (isMounted) setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return

      setSession(newSession)
      const newUser = newSession?.user ?? null

      switch (event) {
        case 'INITIAL_SESSION': {
          setUser(newUser)
          userRef.current = newUser
          if (newUser) {
            setLoading(true)
            fetchProfile(newUser.id, () => {
              if (isMounted) setLoading(false)
            })
          } else {
            setProfile(null)
            profileRef.current = null
            setLoading(false)
          }
          break
        }
        case 'SIGNED_IN': {
          setUser(newUser)
          userRef.current = newUser
          if (newUser && (!profileRef.current || profileRef.current.id !== newUser.id)) {
            fetchProfile(newUser.id)
          }
          break
        }
        case 'TOKEN_REFRESHED': {
          if (!userRef.current && newUser) {
            setUser(newUser)
            userRef.current = newUser
            fetchProfile(newUser.id)
          }
          break
        }
        case 'SIGNED_OUT': {
          setUser(null)
          userRef.current = null
          setProfile(null)
          profileRef.current = null
          setLoading(false)
          break
        }
        case 'USER_UPDATED': {
          setUser(newUser)
          userRef.current = newUser
          if (newUser) {
            fetchProfile(newUser.id)
          }
          break
        }
        case 'PASSWORD_RECOVERY': {
          break
        }
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithEmail = async (email: string, password: string) => {
    setError(null)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      let msg = 'Erro ao entrar. Tente novamente.'
      if (authError.message.includes('Invalid login credentials')) msg = 'Email ou senha incorretos'
      if (authError.message.includes('Email not confirmed'))
        msg = 'Confirme seu email antes de entrar'
      setError(msg)
      return { error: msg }
    }
    return { error: null }
  }

  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    setError(null)
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })
    if (authError) {
      let msg = 'Erro ao criar conta. Tente novamente.'
      if (authError.message.includes('User already registered'))
        msg = 'Este email ja esta cadastrado'
      if (authError.message.includes('Password should be at least'))
        msg = 'A senha deve ter pelo menos 6 caracteres'
      setError(msg)
      return { error: msg }
    }
    return { error: null }
  }

  const signInWithGoogle = async () => {
    setError(null)
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (authError) {
      const msg = 'Erro ao entrar com Google. Tente novamente.'
      setError(msg)
      return { error: msg }
    }
    return { error: null }
  }

  const signOut = async () => {
    setError(null)
    const { error: authError } = await supabase.auth.signOut()
    if (authError) {
      const msg = 'Erro ao sair. Tente novamente.'
      setError(msg)
      return { error: msg }
    }
    setUser(null)
    setProfile(null)
    window.dispatchEvent(new CustomEvent('auth-signout'))
    return { error: null }
  }

  const resetPassword = async (email: string) => {
    setError(null)
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    if (authError) {
      const msg = 'Erro ao redefinir senha. Tente novamente.'
      setError(msg)
      return { error: msg }
    }
    return { error: null }
  }

  return {
    user,
    profile,
    session,
    loading,
    error,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    resetPassword,
    isAuthenticated: !!user,
    isAdmin: profile?.role === 'super_admin',
    isDoctor: profile?.role === 'doctor',
    isSecretary: profile?.role === 'secretary',
    tenantId: profile?.tenant_id || null,
    isTabVisible,
  }
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuth()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export const useAuthContext = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuthContext must be used within an AuthProvider')
  return context
}
