import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TabBar, BlobShape } from '../components/UI'
import { useAuth, useTheme } from '../context/AppContext'

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

      <div style={{ flex: 1, padding: '64px 22px 0' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 400, color: theme.fg, letterSpacing: -1, marginBottom: 28 }}>Profile</div>

        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: theme.bgSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, border: `1px solid ${theme.border}` }}>
            {profile?.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : '👤'}
          </div>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: theme.fg }}>{profile?.username ?? 'Reader'}</div>
            <div style={{ fontSize: 13, color: theme.muted }}>{user?.email}</div>
          </div>
        </div>

        {/* Settings sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Display name */}
          <div>
            <label style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, display: 'block', marginBottom: 8 }}>Display Name</label>
            <input value={username} onChange={e => setUsername(e.target.value)}
              style={{ width: '100%', padding: '13px 0', background: 'none', border: 'none', borderBottom: `1.5px solid ${theme.border}`, color: theme.fg, fontSize: 16 }} />
          </div>

          {/* Reading goals */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 14 }}>Reading Goals</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: theme.muted, display: 'block', marginBottom: 6 }}>Books per year</label>
                <input type="number" value={goalBooks} onChange={e => setGoalBooks(e.target.value)}
                  style={{ width: '100%', padding: '11px', background: theme.bgSecondary, border: 'none', borderRadius: 10, fontSize: 16, color: theme.fg, textAlign: 'center' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: theme.muted, display: 'block', marginBottom: 6 }}>Mins per day</label>
                <input type="number" value={goalMins} onChange={e => setGoalMins(e.target.value)}
                  style={{ width: '100%', padding: '11px', background: theme.bgSecondary, border: 'none', borderRadius: 10, fontSize: 16, color: theme.fg, textAlign: 'center' }} />
              </div>
            </div>
          </div>

          {/* Dark mode */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 15, color: theme.fg, fontWeight: 500 }}>Dark Mode</div>
              <div style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>Toggle appearance</div>
            </div>
            <button onClick={toggle} style={{ width: 48, height: 28, borderRadius: 14, background: dark ? theme.accent : theme.border, border: 'none', position: 'relative', transition: 'background 0.3s' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: dark ? theme.accentFg : '#FFF', position: 'absolute', top: 4, left: dark ? 24 : 4, transition: 'left 0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
            </button>
          </div>

          {/* Save button */}
          <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 15, background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 500, marginTop: 8 }}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
          </button>

          {/* Divider */}
          <div style={{ borderTop: `1px solid ${theme.border}` }} />

          {/* Sign out */}
          <button onClick={handleSignOut} style={{ width: '100%', padding: 15, background: 'none', border: `1.5px solid ${theme.border}`, borderRadius: 12, fontSize: 15, color: theme.muted }}>
            Sign Out
          </button>
        </div>
      </div>

      <TabBar activeTab="profile" onTabChange={t => navigate(`/${t === 'home' ? 'home' : t}`)} theme={theme} />
    </div>
  )
}
