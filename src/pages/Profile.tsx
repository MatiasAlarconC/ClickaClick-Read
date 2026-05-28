import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { TabBar } from '../components/UI'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { CHARACTERS, type CharacterId } from '../components/AvatarCharacter'
import Character3D from '../components/Character3D'
import { getUnlockedCharacters, getUnlockedTitles } from '../data/achievements'
import type { AchievementStats } from '../data/achievements'
import AvatarCreator from '../components/AvatarCreator'
import { FlameIcon, BookOpenIcon, ClockIcon, LightningIcon, MoonIcon, SunIcon } from '../components/Icons'
import type { AvatarConfig } from '../types'

// ── Inline chevron ────────────────────────────────────────────────────────────
function Chevron({ down, color }: { down: boolean; color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transition: 'transform 0.25s', transform: down ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
      <path d="M2 4l4 4 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function ProfileScreen() {
  const { theme } = useTheme()
  const { user, profile, updateProfile, signOut } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()

  // ── Form state ─────────────────────────────────────────────────────────────
  const [username, setUsername]   = useState(profile?.username ?? '')
  const [goalBooks, setGoalBooks] = useState(String(profile?.reading_goal_books_per_year ?? 12))
  const [goalMins,  setGoalMins]  = useState(String(profile?.reading_goal_minutes_per_day ?? 30))
  const [goalPages, setGoalPages] = useState(String((profile as any)?.reading_goal_pages_per_day ?? ''))
  const [goalStreak, setGoalStreak] = useState(String((profile as any)?.reading_goal_streak_days ?? ''))

  // ── Friends / Social ────────────────────────────────────────────────────
  interface FriendProfile { id: string; username: string | null; avatar_url: string | null }
  interface Friendship { id: string; requester_id: string; addressee_id: string; status: string }
  const [friendSearch,    setFriendSearch]    = useState('')
  const [friendResults,   setFriendResults]   = useState<FriendProfile[]>([])
  const [friendSearching, setFriendSearching] = useState(false)
  const [friends,         setFriends]         = useState<FriendProfile[]>([])
  const [incomingReqs,    setIncomingReqs]    = useState<(Friendship & { profile: FriendProfile })[]>([])
  const [outgoingReqs,    setOutgoingReqs]    = useState<(Friendship & { profile: FriendProfile })[]>([])
  const [friendActionId,  setFriendActionId]  = useState<string | null>(null)

  const loadFriends = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    if (!data) return
    const otherIds = data.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id)
    const { data: profiles } = otherIds.length
      ? await supabase.from('profiles').select('id, username, avatar_url').in('id', otherIds)
      : { data: [] }
    const pm: Record<string, FriendProfile> = {}
    for (const p of profiles ?? []) pm[p.id] = p
    const acc: FriendProfile[] = []
    const inc: (Friendship & { profile: FriendProfile })[] = []
    const out: (Friendship & { profile: FriendProfile })[] = []
    for (const f of data) {
      const oid = f.requester_id === user.id ? f.addressee_id : f.requester_id
      const prof = pm[oid] ?? { id: oid, username: 'Unknown', avatar_url: null }
      if (f.status === 'accepted') acc.push(prof)
      else if (f.status === 'pending') {
        if (f.addressee_id === user.id) inc.push({ ...f, profile: prof })
        else out.push({ ...f, profile: prof })
      }
    }
    setFriends(acc); setIncomingReqs(inc); setOutgoingReqs(out)
  }, [user])

  useEffect(() => {
    if (!friendSearch.trim() || !user) { setFriendResults([]); return }
    const t = setTimeout(async () => {
      setFriendSearching(true)
      const { data } = await supabase
        .from('profiles').select('id, username, avatar_url')
        .ilike('username', `%${friendSearch.trim()}%`).neq('id', user.id).limit(10)
      setFriendResults((data ?? []) as FriendProfile[])
      setFriendSearching(false)
    }, 400)
    return () => clearTimeout(t)
  }, [friendSearch, user])

  const getFriendStatus = (id: string) => {
    if (incomingReqs.some(f => f.profile.id === id)) return 'pending_received'
    if (outgoingReqs.some(f => f.profile.id === id)) return 'pending_sent'
    if (friends.some(f => f.id === id)) return 'accepted'
    return 'none'
  }
  const sendFriendReq = async (addresseeId: string) => {
    if (!user) return
    setFriendActionId(addresseeId)
    await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: addresseeId, status: 'pending' })
    await loadFriends()
    setFriendActionId(null)
  }
  const acceptFriendReq = async (fid: string) => {
    setFriendActionId(fid)
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', fid)
    await loadFriends(); setFriendActionId(null)
  }
  const deleteFriendship = async (fid: string) => {
    setFriendActionId(fid)
    await supabase.from('friendships').delete().eq('id', fid)
    await loadFriends(); setFriendActionId(null)
  }
  const removeFriend = async (friendId: string) => {
    if (!user) return
    setFriendActionId(friendId)
    await supabase.from('friendships').delete()
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`)
    await loadFriends(); setFriendActionId(null)
  }
  const [saving, setSaving]   = useState(false)
  const [saved,  setSaved]    = useState(false)
  const [goalSaved, setGoalSaved] = useState(false)

  // ── Section visibility ─────────────────────────────────────────────────────
  const [showCreator,     setShowCreator]     = useState(false)
  const [showGoals,       setShowGoals]       = useState(false)
  const [showAccount,     setShowAccount]     = useState(false)
  const [showFriends,     setShowFriends]     = useState(false)
  useEffect(() => { if (showFriends) loadFriends() }, [showFriends, loadFriends])
  const [showTitlePicker, setShowTitlePicker] = useState(false)
  const [showEmailForm,   setShowEmailForm]   = useState(false)
  const [showPwForm,      setShowPwForm]      = useState(false)

  // ── Account change state ───────────────────────────────────────────────────
  const [newEmail,    setNewEmail]    = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMsg,    setEmailMsg]    = useState<string | null>(null)

  const [newPassword,      setNewPassword]      = useState('')
  const [confirmPassword,  setConfirmPassword]  = useState('')
  const [passwordSaving,   setPasswordSaving]   = useState(false)
  const [passwordMsg,      setPasswordMsg]      = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const avatarCfg: AvatarConfig | null = (profile?.avatar_config as AvatarConfig) ?? null
  const char: CharacterId  = avatarCfg?.character    ?? 'lion'
  const primaryColor       = avatarCfg?.primaryColor ?? CHARACTERS.find(c => c.id === char)!.defaultPrimary
  const secondaryColor     = avatarCfg?.secondaryColor ?? CHARACTERS.find(c => c.id === char)!.defaultSecondary
  const charDef            = CHARACTERS.find(c => c.id === char)!

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
      const booksFinished  = (booksRes.data ?? []).filter((b: any) => b.status === 'finished').length
      const sessions       = sessYearRes.data ?? []
      const allSessions    = (allSessRes.data ?? []).filter((s: any) => !s.is_manual)
      const pagesRead      = sessions.reduce((s: number, r: any) => s + (r.pages_read ?? 0), 0)
      const totalSeconds   = sessions.reduce((s: number, r: any) => s + (r.duration_seconds ?? 0), 0)
      const hours          = Math.round(totalSeconds / 3600)
      const sessionDates   = new Set(sessions.map((s: any) => new Date(s.started_at).toDateString()))
      let streak = 0
      const today = new Date()
      for (let i = 0; i < 366; i++) {
        const d = new Date(today); d.setDate(today.getDate() - i)
        if (sessionDates.has(d.toDateString())) streak++
        else if (i > 0) break
      }
      setProfileStats({ booksFinished, pagesRead, hours, streak })

      const genreCounts: Record<string, number> = {}
      for (const ub of (booksRes.data ?? []) as any[])
        for (const g of ub.book?.genres ?? []) genreCounts[g] = (genreCounts[g] ?? 0) + 1

      setAchievementStats({
        booksFinished,
        totalBooks:    (booksRes.data ?? []).length,
        totalPages:    allSessions.reduce((s: number, r: any) => s + (r.pages_read ?? 0), 0),
        totalHours:    allSessions.reduce((s: number, r: any) => s + ((r.duration_seconds ?? 0) / 3600), 0),
        streak, genreCounts,
        sessionCount:  allSessions.length,
        notesCount:    (notesRes.data ?? []).length,
      })
    })
  }, [user])

  // ── Derived ────────────────────────────────────────────────────────────────
  const unlockedCharacters = achievementStats ? getUnlockedCharacters(achievementStats) : undefined
  const unlockedTitles     = achievementStats ? getUnlockedTitles(achievementStats) : []
  const profileTitle: string | null = (profile as any)?.title ?? null
  const availableTitles    = (() => {
    const base = ['Reader', ...unlockedTitles.filter(t => t !== 'Reader')]
    if (profileTitle && !base.includes(profileTitle)) base.push(profileTitle)
    return base
  })()
  const memberYear = user?.created_at ? new Date(user.created_at).getFullYear() : null
  const heroStats = [
    { icon: <BookOpenIcon size={14} color={primaryColor}/>, label: 'Books',  value: String(profileStats.booksFinished) },
    { icon: <FlameIcon    size={14} color={primaryColor}/>, label: 'Streak', value: `${profileStats.streak}d` },
    { icon: <ClockIcon    size={14} color={primaryColor}/>, label: 'Hours',  value: String(profileStats.hours) },
    { icon: <LightningIcon size={14} color={primaryColor}/>, label: 'Pages', value: profileStats.pagesRead.toLocaleString() },
  ]

  // ── Handlers ───────────────────────────────────────────────────────────────
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

  const handleSaveAccount = async () => {
    setSaving(true)
    await updateProfile({ username: username || null })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSaveGoals = async () => {
    setSaving(true)
    await updateProfile({
      reading_goal_books_per_year:  parseInt(goalBooks)  || null,
      reading_goal_minutes_per_day: parseInt(goalMins)   || null,
      reading_goal_pages_per_day:   parseInt(goalPages)  || null,
      reading_goal_streak_days:     parseInt(goalStreak) || null,
    } as any)
    setSaving(false); setGoalSaved(true)
    setTimeout(() => setGoalSaved(false), 2000)
  }

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) return
    setEmailSaving(true); setEmailMsg(null)
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    setEmailSaving(false)
    setEmailMsg(error ? `Error: ${error.message}` : 'Check your inbox to confirm the new email address.')
    if (!error) setNewEmail('')
  }

  const handleChangePassword = async () => {
    setPasswordMsg(null)
    if (!newPassword) return
    if (newPassword !== confirmPassword) { setPasswordMsg("Passwords don't match"); return }
    if (newPassword.length < 8)          { setPasswordMsg("Minimum 8 characters");  return }
    setPasswordSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)
    setPasswordMsg(error ? `Error: ${error.message}` : 'Password updated successfully.')
    if (!error) { setNewPassword(''); setConfirmPassword('') }
  }

  const handleSelectTitle = async (title: string) => {
    await updateProfile({ title } as any)
    setShowTitlePicker(false)
  }

  const handleSignOut = async () => { await signOut(); navigate('/') }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', background: theme.bgSecondary,
    border: `1px solid ${theme.border}`, borderRadius: 10,
    fontSize: 14, color: theme.fg, outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: theme.muted, display: 'block', marginBottom: 6,
  }
  const sectionHeadStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', padding: '14px 16px', background: theme.bgSecondary,
    border: `1px solid ${theme.border}`, borderRadius: 14,
    cursor: 'pointer', marginBottom: 0,
  }

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: theme.bg, position: 'relative' }}>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', overflow: 'hidden', paddingTop: 56, paddingBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 80%, ${primaryColor}20 0%, transparent 70%)`, pointerEvents: 'none' }}/>

        <div style={{ textAlign: 'center', marginBottom: 8, zIndex: 1 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: theme.fg, letterSpacing: -0.5 }}>{profile?.username ?? 'Reader'}</div>
          {/* Title with edit pencil */}
          <button onClick={() => setShowTitlePicker(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 2, padding: '2px 6px', borderRadius: 6 }}>
            <span style={{ fontSize: 12, color: primaryColor, fontWeight: 600 }}>{profileTitle ?? 'Reader'}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M17 3a2.828 2.828 0 014 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke={primaryColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{memberYear ? `member since ${memberYear}` : charDef.description}</div>
        </div>

        {/* Character — click to animate only (Customize is its own button) */}
        <div style={{ zIndex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}>
            <Character3D character={char} primaryColor={primaryColor} secondaryColor={secondaryColor} size={180}/>
          </motion.div>
          <button onClick={() => setShowCreator(true)} style={{ background: primaryColor, color: '#FFF', border: 'none', borderRadius: 999, padding: '6px 18px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, cursor: 'pointer', boxShadow: `0 2px 12px ${primaryColor}55`, textTransform: 'uppercase' }}>
            Customize
          </button>
        </div>

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
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: theme.bgSecondary, border: `2px solid ${primaryColor}40`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={theme.muted} strokeWidth="1.5"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={theme.muted} strokeWidth="1.5" strokeLinecap="round"/></svg>
            }
          </div>
          <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: primaryColor, border: `2px solid ${theme.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {uploadingAvatar
              ? <span style={{ fontSize: 7, color: '#FFF' }}>…</span>
              : <svg width="8" height="8" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="13" r="4" stroke="white" strokeWidth="2.5"/></svg>
            }
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange}/>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '0 22px', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Achievements */}
        <button onClick={() => navigate('/achievements')} style={{ ...sectionHeadStyle }}>
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

        {/* ── Friends ──────────────────────────────────────────────────────── */}
        <div style={{ background: theme.bgSecondary, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <button onClick={() => setShowFriends(v => !v)} style={{ ...sectionHeadStyle, borderRadius: 0, marginBottom: 0, border: 'none', background: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
                <circle cx="8" cy="7" r="3" stroke={theme.muted} strokeWidth="1.5"/>
                <circle cx="15" cy="5" r="2.5" stroke={theme.muted} strokeWidth="1.5"/>
                <path d="M2 18C2 15.24 4.69 13 8 13C11.31 13 14 15.24 14 18" stroke={theme.muted} strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M15 11C17.21 11 19 12.57 19 14.5" stroke={theme.muted} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: theme.fg }}>Friends</div>
                <div style={{ fontSize: 11, color: theme.muted }}>
                  {friends.length > 0 ? `${friends.length} friend${friends.length !== 1 ? 's' : ''}` : 'Find & add readers'}
                  {incomingReqs.length > 0 && <span style={{ marginLeft: 6, background: primaryColor, color: '#fff', borderRadius: 99, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{incomingReqs.length}</span>}
                </div>
              </div>
            </div>
            <Chevron down={showFriends} color={theme.muted}/>
          </button>
          <AnimatePresence initial={false}>
            {showFriends && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                <div style={{ padding: '4px 16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Search */}
                  <div style={{ position: 'relative', marginTop: 4 }}>
                    <input
                      value={friendSearch} onChange={e => setFriendSearch(e.target.value)}
                      placeholder="Search by username…"
                      style={{ width: '100%', padding: '9px 32px 9px 12px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 13, color: theme.fg, outline: 'none', boxSizing: 'border-box' }}
                    />
                    {friendSearch && <button onClick={() => setFriendSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: theme.muted, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>}
                  </div>
                  {/* Search results */}
                  {friendSearch.trim() && (
                    friendSearching
                      ? <div style={{ fontSize: 12, color: theme.muted, padding: '4px 0' }}>Searching…</div>
                      : friendResults.length === 0
                      ? <div style={{ fontSize: 12, color: theme.muted, padding: '4px 0' }}>No users found.</div>
                      : friendResults.map(p => {
                          const status = getFriendStatus(p.id)
                          const loading = friendActionId === p.id
                          return (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 34, height: 34, borderRadius: '50%', background: theme.border, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: theme.muted }}>
                                {p.avatar_url ? <img src={p.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : (p.username?.[0] ?? '?').toUpperCase()}
                              </div>
                              <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: theme.fg }}>@{p.username ?? 'unnamed'}</div>
                              {status === 'none' && <button disabled={loading} onClick={() => sendFriendReq(p.id)} style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: primaryColor, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>{loading ? '…' : 'Add'}</button>}
                              {status === 'pending_sent' && <span style={{ fontSize: 11, color: theme.muted }}>Sent ✓</span>}
                              {status === 'pending_received' && <button disabled={loading} onClick={() => { const f = incomingReqs.find(i => i.profile.id === p.id); if (f) acceptFriendReq(f.id) }} style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: primaryColor, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{loading ? '…' : 'Accept'}</button>}
                              {status === 'accepted' && <span style={{ fontSize: 11, color: theme.muted }}>Friends ✓</span>}
                            </div>
                          )
                        })
                  )}
                  {/* Incoming requests */}
                  {!friendSearch.trim() && incomingReqs.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: theme.muted }}>Requests ({incomingReqs.length})</div>
                      {incomingReqs.map(f => (
                        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: theme.border, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: theme.muted }}>{(f.profile.username?.[0] ?? '?').toUpperCase()}</div>
                          <div style={{ flex: 1, fontSize: 13, color: theme.fg }}>@{f.profile.username ?? 'unnamed'}</div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button disabled={friendActionId === f.id} onClick={() => acceptFriendReq(f.id)} style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: primaryColor, color: '#fff', fontSize: 11, cursor: 'pointer' }}>{friendActionId === f.id ? '…' : 'Accept'}</button>
                            <button disabled={friendActionId === f.id} onClick={() => deleteFriendship(f.id)} style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${theme.border}`, background: 'none', color: theme.muted, fontSize: 11, cursor: 'pointer' }}>Decline</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Friends list */}
                  {!friendSearch.trim() && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {friends.length > 0 && <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: theme.muted }}>Friends</div>}
                      {friends.length === 0 && incomingReqs.length === 0 && outgoingReqs.length === 0 && (
                        <div style={{ fontSize: 12, color: theme.muted, textAlign: 'center', padding: '12px 0' }}>No friends yet — search above to add readers.</div>
                      )}
                      {friends.map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <button onClick={() => navigate(`/profile/${p.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: theme.border, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: theme.muted }}>
                              {p.avatar_url ? <img src={p.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : (p.username?.[0] ?? '?').toUpperCase()}
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: theme.fg }}>@{p.username ?? 'unnamed'}</div>
                          </button>
                          <button disabled={friendActionId === p.id} onClick={() => removeFriend(p.id)} style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${theme.border}`, background: 'none', color: theme.muted, fontSize: 11, cursor: 'pointer' }}>{friendActionId === p.id ? '…' : 'Remove'}</button>
                        </div>
                      ))}
                      {outgoingReqs.map(f => (
                        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: theme.border, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: theme.muted }}>{(f.profile.username?.[0] ?? '?').toUpperCase()}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: theme.fg }}>@{f.profile.username ?? 'unnamed'}</div>
                            <div style={{ fontSize: 11, color: theme.muted }}>Request pending…</div>
                          </div>
                          <button disabled={friendActionId === f.id} onClick={() => deleteFriendship(f.id)} style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${theme.border}`, background: 'none', color: theme.muted, fontSize: 11, cursor: 'pointer' }}>{friendActionId === f.id ? '…' : 'Cancel'}</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Reading Goals ─────────────────────────────────────────────────── */}
        <div style={{ background: theme.bgSecondary, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <button onClick={() => setShowGoals(v => !v)} style={{ ...sectionHeadStyle, borderRadius: 0, marginBottom: 0, border: 'none', background: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={theme.muted} strokeWidth="1.5"/><path d="M12 7v5l3 3" stroke={theme.muted} strokeWidth="1.5" strokeLinecap="round"/></svg>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: theme.fg }}>Reading Goals</div>
                <div style={{ fontSize: 11, color: theme.muted }}>Books, pages, time & streak targets</div>
              </div>
            </div>
            <Chevron down={showGoals} color={theme.muted}/>
          </button>
          <AnimatePresence initial={false}>
            {showGoals && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                <div style={{ padding: '4px 16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Books / year</label>
                      <input type="number" value={goalBooks} onChange={e => setGoalBooks(e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} placeholder="12"/>
                    </div>
                    <div>
                      <label style={labelStyle}>Minutes / day</label>
                      <input type="number" value={goalMins}  onChange={e => setGoalMins(e.target.value)}  style={{ ...inputStyle, textAlign: 'center' }} placeholder="30"/>
                    </div>
                    <div>
                      <label style={labelStyle}>Pages / day</label>
                      <input type="number" value={goalPages} onChange={e => setGoalPages(e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} placeholder="20"/>
                    </div>
                    <div>
                      <label style={labelStyle}>Streak target (days)</label>
                      <input type="number" value={goalStreak} onChange={e => setGoalStreak(e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} placeholder="7"/>
                    </div>
                  </div>
                  <button onClick={handleSaveGoals} disabled={saving} style={{ padding: '12px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                    {saving ? 'Saving…' : goalSaved ? '✓ Saved' : 'Save Goals'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Account ──────────────────────────────────────────────────────── */}
        <div style={{ background: theme.bgSecondary, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <button onClick={() => setShowAccount(v => !v)} style={{ ...sectionHeadStyle, borderRadius: 0, marginBottom: 0, border: 'none', background: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={theme.muted} strokeWidth="1.5"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={theme.muted} strokeWidth="1.5" strokeLinecap="round"/></svg>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: theme.fg }}>Account</div>
                <div style={{ fontSize: 11, color: theme.muted }}>Name, email & password</div>
              </div>
            </div>
            <Chevron down={showAccount} color={theme.muted}/>
          </button>
          <AnimatePresence initial={false}>
            {showAccount && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                <div style={{ padding: '4px 16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* Display name */}
                  <div>
                    <label style={labelStyle}>Display Name</label>
                    <input value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} placeholder="Your name"/>
                    <button onClick={handleSaveAccount} disabled={saving} style={{ marginTop: 8, padding: '10px 20px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                      {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Name'}
                    </button>
                  </div>

                  <div style={{ height: 1, background: theme.border }}/>

                  {/* Current email */}
                  <div>
                    <div style={{ fontSize: 11, color: theme.muted, marginBottom: 4 }}>Current email</div>
                    <div style={{ fontSize: 14, color: theme.fg }}>{user?.email}</div>
                    <button onClick={() => { setShowEmailForm(v => !v); setEmailMsg(null) }} style={{ marginTop: 8, background: 'none', border: `1px solid ${theme.border}`, borderRadius: 8, padding: '7px 14px', fontSize: 12, color: theme.muted, cursor: 'pointer' }}>
                      {showEmailForm ? 'Cancel' : 'Change email'}
                    </button>
                    <AnimatePresence initial={false}>
                      {showEmailForm && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                          <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="New email address" type="email" style={inputStyle}/>
                            <button onClick={handleChangeEmail} disabled={emailSaving || !newEmail.trim()} style={{ padding: '10px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: newEmail.trim() ? 1 : 0.5 }}>
                              {emailSaving ? 'Sending…' : 'Send confirmation'}
                            </button>
                            {emailMsg && <div style={{ fontSize: 12, color: emailMsg.startsWith('Error') ? '#EF4444' : '#22C55E', padding: '8px 0' }}>{emailMsg}</div>}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div style={{ height: 1, background: theme.border }}/>

                  {/* Change password */}
                  <div>
                    <button onClick={() => { setShowPwForm(v => !v); setPasswordMsg(null) }} style={{ background: 'none', border: `1px solid ${theme.border}`, borderRadius: 8, padding: '7px 14px', fontSize: 12, color: theme.muted, cursor: 'pointer' }}>
                      {showPwForm ? 'Cancel' : 'Change password'}
                    </button>
                    <AnimatePresence initial={false}>
                      {showPwForm && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                          <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password (min 8 chars)" type="password" style={inputStyle}/>
                            <input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" type="password" style={inputStyle}/>
                            <button onClick={handleChangePassword} disabled={passwordSaving} style={{ padding: '10px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                              {passwordSaving ? 'Updating…' : 'Update password'}
                            </button>
                            {passwordMsg && <div style={{ fontSize: 12, color: passwordMsg.startsWith('Error') ? '#EF4444' : '#22C55E', padding: '8px 0' }}>{passwordMsg}</div>}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Preferences row ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {dark ? <MoonIcon size={18} color={theme.muted}/> : <SunIcon size={18} color={theme.muted}/>}
            <span style={{ fontSize: 13, color: theme.muted }}>{dark ? 'Dark' : 'Light'} mode</span>
            <button onClick={toggle} style={{ width: 44, height: 26, borderRadius: 13, background: dark ? theme.accent : theme.border, border: 'none', position: 'relative', transition: 'background 0.3s', cursor: 'pointer', marginLeft: 4 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: dark ? theme.accentFg : '#FFF', position: 'absolute', top: 4, left: dark ? 22 : 4, transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }}/>
            </button>
          </div>
          <button onClick={handleSignOut} style={{ padding: '9px 18px', background: 'none', border: `1.5px solid ${theme.border}`, borderRadius: 10, fontSize: 13, color: theme.muted, cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>

      </div>

      {/* ── Title picker sheet ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showTitlePicker && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}
            onClick={() => setShowTitlePicker(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              style={{ background: theme.bgElevated, borderRadius: '20px 20px 0 0', padding: 24, width: '100%', paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: theme.fg }}>Your Titles</div>
                <div style={{ fontSize: 11, color: theme.muted }}>{unlockedTitles.length} unlocked</div>
              </div>
              {availableTitles.length === 0 ? (
                <div style={{ fontSize: 13, color: theme.muted, textAlign: 'center', padding: '24px 0' }}>Earn achievements to unlock titles.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '50vh', overflowY: 'auto' }}>
                  {availableTitles.map(title => {
                    const isActive = (profileTitle ?? 'Reader') === title
                    return (
                      <button key={title} onClick={() => handleSelectTitle(title)} style={{ padding: '13px 16px', background: isActive ? `${primaryColor}15` : theme.bgSecondary, border: `1px solid ${isActive ? primaryColor + '50' : 'transparent'}`, borderRadius: 12, textAlign: 'left', fontSize: 14, color: isActive ? primaryColor : theme.fg, fontWeight: isActive ? 700 : 400, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {title}
                        {isActive && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke={primaryColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </button>
                    )
                  })}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Avatar creator ────────────────────────────────────────────────────── */}
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
