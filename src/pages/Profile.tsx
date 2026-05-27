import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TabBar, BlobShape } from '../components/UI'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'

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
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Profile stats ──────────────────────────────────────────────────────────
  const [profileStats, setProfileStats] = useState({ booksFinished: 0, pagesRead: 0, hours: 0, streak: 0 })

  useEffect(() => {
    if (!user) return
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString()
    Promise.all([
      supabase.from('user_books').select('status').eq('user_id', user.id),
      supabase.from('reading_sessions').select('pages_read, duration_seconds, started_at').eq('user_id', user.id).gte('started_at', startOfYear),
    ]).then(([booksRes, sessRes]) => {
      const booksFinished = (booksRes.data ?? []).filter((b: any) => b.status === 'finished').length
      const sessions = sessRes.data ?? []
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
    })
  }, [user])

  // ── Avatar upload ──────────────────────────────────────────────────────────
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

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: theme.bg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -60, right: -80, width: 240, height: 240, pointerEvents: 'none' }}>
        <BlobShape size="medium" fill={theme.blobFill} opacity={0.4} style={{ width: '100%', height: '100%' }} />
      </div>

      <div style={{ flex: 1, padding: '64px 22px 0', paddingBottom: 'calc(68px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 400, color: theme.fg, letterSpacing: -1, marginBottom: 28 }}>Profile</div>

        {/* ── Identity row ───────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          {/* Avatar with camera overlay */}
          <div style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: theme.bgSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, border: `2px solid ${theme.border}`, overflow: 'hidden' }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span>👤</span>}
            </div>
            <div style={{ position: 'absolute', bottom: 1, right: 1, width: 22, height: 22, borderRadius: '50%', background: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${theme.bg}` }}>
              {uploadingAvatar
                ? <span style={{ fontSize: 9, color: theme.accentFg }}>…</span>
                : <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="13" r="4" stroke="white" strokeWidth="2"/></svg>}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: theme.fg, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.username ?? 'Reader'}
            </div>
            <div style={{ fontSize: 12, color: theme.muted, marginTop: 3 }}>{user?.email}</div>
            {user?.created_at && (
              <div style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>
                Reader since {new Date(user.created_at).getFullYear()}
              </div>
            )}
          </div>
        </div>

        {/* ── Stats cards ────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
          {[
            { label: 'Books read', value: String(profileStats.booksFinished), sub: 'this year' },
            { label: 'Pages', value: profileStats.pagesRead.toLocaleString(), sub: 'this year' },
            { label: 'Hours', value: String(profileStats.hours), sub: 'reading' },
            { label: 'Day streak', value: String(profileStats.streak), sub: 'days' },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              style={{ background: theme.bgSecondary, borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: 0.9, textTransform: 'uppercase', color: theme.muted, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: theme.fg, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10.5, color: theme.muted, marginTop: 2 }}>{s.sub}</div>
            </motion.div>
          ))}
        </div>

        {/* ── Settings ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Display name */}
          <div>
            <label style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, display: 'block', marginBottom: 8 }}>Display Name</label>
            <input value={username} onChange={e => setUsername(e.target.value)}
              style={{ width: '100%', padding: '13px 0', background: 'none', border: 'none', borderBottom: `1.5px solid ${theme.border}`, color: theme.fg, fontSize: 16, outline: 'none' }} />
          </div>

          {/* Reading goals */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 12 }}>Reading Goals</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: theme.muted, display: 'block', marginBottom: 6 }}>Books / year</label>
                <input type="number" value={goalBooks} onChange={e => setGoalBooks(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: theme.bgSecondary, border: 'none', borderRadius: 10, fontSize: 16, color: theme.fg, textAlign: 'center', outline: 'none' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: theme.muted, display: 'block', marginBottom: 6 }}>Mins / day</label>
                <input type="number" value={goalMins} onChange={e => setGoalMins(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: theme.bgSecondary, border: 'none', borderRadius: 10, fontSize: 16, color: theme.fg, textAlign: 'center', outline: 'none' }} />
              </div>
            </div>
          </div>

          {/* Save */}
          <button onClick={handleSave} disabled={saving}
            style={{ width: '100%', padding: 15, background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
          </button>

          {/* Dark mode + Sign out in one compact row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: theme.muted }}>{dark ? '🌙' : '☀️'}</span>
              <button onClick={toggle} style={{ width: 44, height: 26, borderRadius: 13, background: dark ? theme.accent : theme.border, border: 'none', position: 'relative', transition: 'background 0.3s', cursor: 'pointer' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: dark ? theme.accentFg : '#FFF', position: 'absolute', top: 4, left: dark ? 22 : 4, transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
              </button>
            </div>
            <button onClick={handleSignOut}
              style={{ padding: '9px 18px', background: 'none', border: `1.5px solid ${theme.border}`, borderRadius: 10, fontSize: 13, color: theme.muted, cursor: 'pointer' }}>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <TabBar activeTab="profile" onTabChange={t => navigate(`/${t === 'home' ? 'home' : t}`)} theme={theme} />
    </div>
  )
}
