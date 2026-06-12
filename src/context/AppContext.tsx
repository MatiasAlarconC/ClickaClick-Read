import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'
import { getTheme } from '../lib/theme'
import type { Theme } from '../types'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<void>
  isAdmin: boolean
  notifications: AppNotification[]
  markNotificationsRead: () => Promise<void>
}

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  created_at: string
  data?: Record<string, unknown>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          // Proactively refresh if token expires within 10 minutes
          const expiresAt = session.expires_at ?? 0
          if (expiresAt - Math.floor(Date.now() / 1000) < 600) {
            const { data: refreshed } = await supabase.auth.refreshSession()
            const s = refreshed.session ?? session
            setSession(s); setUser(s.user); fetchProfile(s.user.id)
          } else {
            setSession(session); setUser(session.user); fetchProfile(session.user.id)
          }
        } else {
          setSession(null); setUser(null)
        }
      } catch { /* silently fall through — onAuthStateChange handles it */ }
      setLoading(false)
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setIsAdmin(false)
      }
    })

    // Refresh token whenever the PWA is brought back to foreground
    const handleVisibility = () => {
      if (!document.hidden) supabase.auth.refreshSession().catch(() => {})
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) {
      setProfile(data as Profile)
      setIsAdmin((data as Profile & { is_admin?: boolean }).is_admin ?? false)
    }
    // Fetch unread notifications on every login
    const { data: notifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications((notifs ?? []) as AppNotification[])
  }

  async function markNotificationsRead() {
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifications([])
  }

  async function signUp(email: string, password: string, username: string) {
    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: appUrl },
    })
    if (error) return { error: error.message }
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        username,
        reading_goal_books_per_year: 12,
        reading_goal_minutes_per_day: 30,
      })
      await fetchProfile(data.user.id)
    }
    return { error: null }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!user) return
    const { data } = await supabase.from('profiles').update(updates).eq('id', user.id).select().single()
    if (data) setProfile(data as Profile)
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signOut, updateProfile, isAdmin, notifications, markNotificationsRead }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// Theme context
interface ThemeContextValue {
  dark: boolean
  toggle: () => void
  theme: Theme
}
const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('dark_mode')
    if (saved !== null) return saved === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('dark_mode', String(dark))
  }, [dark])

  const toggle = () => setDark(d => !d)
  const theme = getTheme(dark)

  return (
    <ThemeContext.Provider value={{ dark, toggle, theme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

// ─── Responsive hook ──────────────────────────────────────────────────────────
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = React.useState(() => window.innerWidth >= 768)
  React.useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isDesktop
}
