import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { TabBar } from '../components/UI'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { CHARACTERS, type CharacterId } from '../components/AvatarCharacter'
import Character3D from '../components/Character3D'
import { getUnlockedCharacters } from '../data/achievements'
import type { AchievementStats } from '../data/achievements'
import AvatarCreator from '../components/AvatarCreator'
import { FlameIcon, BookOpenIcon, ClockIcon, LightningIcon, MoonIcon, SunIcon } from '../components/Icons'
import type { AvatarConfig } from '../types'

export default function ProfileScreen() {
  const { theme } = useTheme()
  const { user, profile, updateProfile, signOut } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()

  const [username, setUsername] = useState(profile?.username ?? '')
  const [goalBooks, setGoalBooks] = useState(String(profile?.reading_goal_books_per_year ?? 12))
  const [goalMins, setGoalMins] = useState(String(profile?.reading_goal_minutes_per_day ?? 30))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showCreator, setShowCreator] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const avatarCfg: AvatarConfig | null = (profile?.avatar_config as AvatarConfig) ?? null
  const char: CharacterId = avatarCfg?.character ?? 'lion'
  const primaryColor = avatarCfg?.primaryColor ?? CHARACTERS.find(c => c.id === char)!.defaultPrimary
  const secondaryColor = avatarCfg?.secondaryColor ?? CHARACTERS.find(c => c.id === char)!.defaultSecondary
  const charDef = CHARACTERS.find(c => c.id === char)!

  // ── Profile stats ──────────────────────────────────────────────────────────
  const [profileStats, setProfileStats] = useState({ booksFinished: 0, pagesRead: 0, hours: 0, streak: 0 })
  const [achievementStats, setAchievementStats] = useState<AchievementStats | null>(null)

  useEffect(() => {
    if (!user) return
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString()
    Promise.all([
      supabase.from('user_books').select('status, book:books(genres)').eq('user_id', user.id),
      supabase.from('reading_sessions').select('pages_read, duration_seconds, started_at, is_manual').eq('user_id', user.id).gte('started_at', startOfYear),
      supabase.from('reading_sessions').select('pages_read, duration_seconds, started_at, is_manual').eq('user_id', user.id),
      supabase.from('book_notes').select('id').eq('user_id', user.id),
    ]).then(([booksRes, sessYearRes, allSessRes, notesRes]) => {
      const booksFinished = (booksRes.data ?? []).filter((b: any) => b.status === 'finished').length
      const sessions = sessYearRes.data ?? []
      const allSessions = (allSessRes.data ?? []).filter((s: any) => !s.is_manual)
      const pagesRead = sessions.reduce((s: number, r: any) => s + (r.pages_read ?? 0), 0)
      const totalSeconds = sessions.reduce((s: number, r: any) => s + (r.duration_seconds ?? 0), 0)
      const hours = Math.round(totalSeconds / 3600)
      const sessionDates = new Set(sessions.map((s: any) => new Date(s.started_at).toDateString()))
      let streak = 0
      const today = new Date()
      for (let i = 0; i < 366; i++) {
        const d = new Date(today); d.setDate(today.getDate() - i)
        if (sessionDates.has(d.toDateString())) streak++
        else if (i > 0) break
      }
      setProfileStats({ booksFinished, pagesRead, hours, streak })

      // Build achievement stats for unlocked characters
      const genreCounts: Record<string, number> = {}
      for (const ub of (booksRes.data ?? []) as any[]) {
        for (const g of ub.book?.genres ?? []) genreCounts[g] = (genreCounts[g] ?? 0) + 1
      }
      setAchievementStats({
        booksFinished,
        totalBooks: (booksRes.data ?? []).length,
        totalPages: allSessions.reduce((s: number, r: any) => s + (r.pages_read ?? 0), 0),
        totalHours: allSessions.reduce((s: number, r: any) => s + ((r.duration_seconds ?? 0) / 3600), 0),
        streak,
        genreCounts,
        sessionCount: allSessions.length,
        notesCount: (notesRes.data ?? []).length,
      })
    })
  }, [user])

  // ── Avatar upload ──────────────────────────────────────────────────────────
  const handleSaveAvatar = async (character: CharacterId, primary: string, secondary: string) => {
    setShowCreator(false)
    await updateProfile({ avatar_config: { character, primaryColor: primary, secondaryColor: secondary } as any })
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${user.id}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await updateProfile({ avatar_url: `${data.publicUrl}?t=${Date.now()}` })
    }
    setUploadingAvatar(false)
  }

  const handleSave = async () => {
    setSaving(true)
    await updateProfile({
      username: username || null,
      reading_goal_books_per_year: parseInt(goalBooks) || null,
      reading_goal_minutes_per_day: parseInt(goalMins) || null,
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const unlockedCharacters = achievementStats ? getUnlockedCharacters(achievementStats) : undefined
  const memberYear = user?.created_at ? new Date(user.created_at).getFullYear() : null
  const profileTitle: string | null = (profile as any)?.title ?? null
  const heroStats = [
    { icon: <BookOpenIcon size={14} color={primaryColor}/>, label: 'Books', value: String(profileStats.booksFinished) },
    { icon: <FlameIcon size={14} color={primaryColor}/>, label: 'Streak', value: `${profileStats.streak}d` },
    { icon: <ClockIcon size={14} color={primaryColor}/>, label: 'Hours', value: String(profileStats.hours) },
    { icon: <LightningIcon size={14} color={primaryColor}/>, label: 'Pages', value: profileStats.pagesRead.toLocaleString() },
  ]

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: theme.bg, position: 'relative' }}>

      {/* ── Hero section: character + floating stats ──────────────────────── */}
      <div style={{ position: 'relative', overflow: 'hidden', paddingTop: 56, paddingBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 80%, ${primaryColor}20 0%, transparent 70%)`, pointerEvents: 'none' }}/>

        <div style={{ textAlign: 'center', marginBottom: 8, zIndex: 1 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: theme.fg, letterSpacing: -0.5 }}>{profile?.username ?? 'Reader'}</div>
          {profileTitle && (
            <div style={{ fontSize: 12, color: '#FFD700', fontWeight: 600, marginTop: 2 }}>{profileTitle}</div>
          )}
          <div style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{charDef.description}{memberYear ? ` · since ${memberYear}` : ''}</div>
        </div>

        {/* Character — tap to customize */}
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ zIndex: 1, cursor: 'pointer', position: 'relative' }} onClick={() => setShowCreator(true)}>
          <Character3D character={char} primaryColor={primaryColor} secondaryColor={secondaryColor} size={180}/>
          <div style={{ position: 'absolute', bottom: 8, right: -8, background: primaryColor, color: '#FFF', fontSize: 10, fontWeight: 600, padding: '4px 9px', borderRadius: 999, boxShadow: `0 2px 10px ${primaryColor}60` }}>Customize ✶</div>
        </motion.div>

        {/* Stat chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 16, zIndex: 1 }}>
          {heroStats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', background: theme.bgSecondary, borderRadius: 999, border: `1px solid ${primaryColor}30` }}>
              {s.icon}
              <span style={{ fontSize: 13, fontWeight: 600, color: theme.fg }}>{s.value}</span>
              <span style={{ fontSize: 11, color: theme.muted }}>{s.label}</span>
            </motion.div>
          ))}
        </div>

        {/* Photo avatar (small, top-right) */}
        <div style={{ position: 'absolute', top: 64, right: 20, zIndex: 2, cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: theme.bgSecondary, border: `2px solid ${primaryColor}40`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            {profile?.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span>👤</span>}
          </div>
          <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: primaryColor, border: `2px solid ${theme.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {uploadingAvatar ? <span style={{ fontSize: 7, color: '#FFF' }}>…</span>
              : <svg width="8" height="8" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="13" r="4" stroke="white" strokeWidth="2.5"/></svg>}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange}/>
        </div>
      </div>

      {/* ── Settings ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '0 22px', paddingBottom: 'calc(68px + env(safe-area-inset-bottom, 0px))' }}>
        {/* Achievements entry */}
        <button onClick={() => navigate('/achievements')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '14px 16px', background: theme.bgSecondary, border: `1px solid ${theme.border}`, borderRadius: 14, marginBottom: 20, cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 4h14v2H3V4zm0 2v6c0 2.76 2.24 5 5 5h4c2.76 0 5-2.24 5-5V6H3z" fill={theme.muted} opacity="0.85"/>
              <rect x="7" y="15" width="6" height="1.5" rx="0.75" fill={theme.muted} opacity="0.7"/>
              <rect x="5" y="16.5" width="10" height="1.5" rx="0.75" fill={theme.muted} opacity="0.7"/>
              <rect x="1" y="4" width="2" height="5" rx="1" fill={theme.muted} opacity="0.6"/>
              <rect x="17" y="4" width="2" height="5" rx="1" fill={theme.muted} opacity="0.6"/>
            </svg>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: theme.fg }}>Achievements</div>
              <div style={{ fontSize: 11, color: theme.muted }}>Medals, titles & unlockable characters</div>
            </div>
          </div>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1L6 6L1 11" stroke={theme.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ height: 1, background: theme.border, marginBottom: 24 }}/>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div>
            <label style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, display: 'block', marginBottom: 8 }}>Display Name</label>
            <input value={username} onChange={e => setUsername(e.target.value)}
              style={{ width: '100%', padding: '13px 0', background: 'none', border: 'none', borderBottom: `1.5px solid ${theme.border}`, color: theme.fg, fontSize: 16, outline: 'none' }}/>
          </div>

          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 12 }}>Reading Goals</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: theme.muted, display: 'block', marginBottom: 6 }}>Books / year</label>
                <input type="number" value={goalBooks} onChange={e => setGoalBooks(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: theme.bgSecondary, border: 'none', borderRadius: 10, fontSize: 16, color: theme.fg, textAlign: 'center', outline: 'none' }}/>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: theme.muted, display: 'block', marginBottom: 6 }}>Mins / day</label>
                <input type="number" value={goalMins} onChange={e => setGoalMins(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: theme.bgSecondary, border: 'none', borderRadius: 10, fontSize: 16, color: theme.fg, textAlign: 'center', outline: 'none' }}/>
              </div>
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            style={{ width: '100%', padding: 15, background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {dark ? <MoonIcon size={18} color={theme.muted}/> : <SunIcon size={18} color={theme.muted}/>}
              <span style={{ fontSize: 13, color: theme.muted }}>{dark ? 'Dark' : 'Light'} mode</span>
              <button onClick={toggle} style={{ width: 44, height: 26, borderRadius: 13, background: dark ? theme.accent : theme.border, border: 'none', position: 'relative', transition: 'background 0.3s', cursor: 'pointer', marginLeft: 4 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: dark ? theme.accentFg : '#FFF', position: 'absolute', top: 4, left: dark ? 22 : 4, transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }}/>
              </button>
            </div>
            <button onClick={handleSignOut}
              style={{ padding: '9px 18px', background: 'none', border: `1.5px solid ${theme.border}`, borderRadius: 10, fontSize: 13, color: theme.muted, cursor: 'pointer' }}>
              Sign Out
            </button>
          </div>

          <div style={{ fontSize: 11, color: theme.muted, textAlign: 'center', paddingBottom: 8 }}>{user?.email}</div>
        </div>
      </div>

      <AnimatePresence>
        {showCreator && (
          <AvatarCreator onClose={() => setShowCreator(false)} onSave={handleSaveAvatar}
            initialCharacter={char} initialPrimary={primaryColor} initialSecondary={secondaryColor} theme={theme}
            unlockedCharacters={unlockedCharacters}/>
        )}
      </AnimatePresence>

      <TabBar activeTab="profile" onTabChange={t => navigate(`/${t === 'home' ? 'home' : t}`)} theme={theme}/>
    </div>
  )
}
