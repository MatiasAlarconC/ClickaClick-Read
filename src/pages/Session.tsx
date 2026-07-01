import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { BookCover, Spinner } from '../components/UI'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import type { UserBook } from '../types'

// ─── Music helpers ────────────────────────────────────────────────────────────
// All tags point to calm/classical/lofi — reading music must never be upbeat
function genreToMusicTag(genres: string[] | undefined): string {
  if (!genres?.length) return 'piano'
  const lower = genres.join(' ').toLowerCase()
  if (/fantasy|magic|dragon|wizard|adventure|epic|mythology/.test(lower)) return 'classicalpiano'
  if (/thriller|crime|mystery|horror|suspense|dark|noir/.test(lower)) return 'ambient'
  if (/romance|love|contemporary|chick.?lit|women.?fiction/.test(lower)) return 'piano'
  if (/sci.?fi|space|technology|futuristic|dystopia|cyberpunk/.test(lower)) return 'lofi'
  if (/histor|biograph|classic|literary|memoir|war/.test(lower)) return 'classicalpiano'
  if (/self.?help|business|psychology|philosophy|essay|non.?fiction/.test(lower)) return 'ambient'
  if (/poetry|art|music|creative/.test(lower)) return 'piano'
  return 'piano'
}

// Public-domain classical fallback tracks (Musopen collection via archive.org)
// Used when Jamendo returns no results — always calm, always instrumental
const FALLBACK_TRACKS: Record<string, { url: string; name: string }[]> = {
  piano: [
    { url: 'https://archive.org/download/MusopenCollectionAsMp3s/Chopin_-_Nocturne_Op.9_No.2_E_Flat_Major.mp3', name: 'Chopin — Nocturne Op.9 No.2' },
    { url: 'https://archive.org/download/MusopenCollectionAsMp3s/Debussy_-_Clair_De_Lune.mp3',                  name: 'Debussy — Clair de Lune' },
    { url: 'https://archive.org/download/MusopenCollectionAsMp3s/Chopin_-_Waltz_No._10_Op._69_No._2.mp3',       name: 'Chopin — Waltz Op.69 No.2' },
    { url: 'https://archive.org/download/MusopenCollectionAsMp3s/Satie_-_Gymnopedies_No.1.mp3',                 name: 'Satie — Gymnopédie No.1' },
  ],
  classicalpiano: [
    { url: 'https://archive.org/download/MusopenCollectionAsMp3s/Bach_-_Air_On_The_G_String.mp3',          name: 'Bach — Air on the G String' },
    { url: 'https://archive.org/download/MusopenCollectionAsMp3s/Beethoven_-_Moonlight_Sonata_Mvt._1.mp3', name: 'Beethoven — Moonlight Sonata' },
    { url: 'https://archive.org/download/MusopenCollectionAsMp3s/Schubert_-_Ave_Maria.mp3',                name: 'Schubert — Ave Maria' },
    { url: 'https://archive.org/download/MusopenCollectionAsMp3s/Chopin_-_Nocturne_Op.9_No.2_E_Flat_Major.mp3', name: 'Chopin — Nocturne Op.9 No.2' },
  ],
  ambient: [
    { url: 'https://archive.org/download/MusopenCollectionAsMp3s/Satie_-_Gymnopedies_No.1.mp3',           name: 'Satie — Gymnopédie No.1' },
    { url: 'https://archive.org/download/MusopenCollectionAsMp3s/Debussy_-_Clair_De_Lune.mp3',            name: 'Debussy — Clair de Lune' },
    { url: 'https://archive.org/download/MusopenCollectionAsMp3s/Bach_-_Air_On_The_G_String.mp3',         name: 'Bach — Air on the G String' },
    { url: 'https://archive.org/download/MusopenCollectionAsMp3s/Schubert_-_Ave_Maria.mp3',               name: 'Schubert — Ave Maria' },
  ],
  lofi: [
    { url: 'https://archive.org/download/MusopenCollectionAsMp3s/Chopin_-_Nocturne_Op.9_No.2_E_Flat_Major.mp3', name: 'Chopin — Nocturne Op.9 No.2' },
    { url: 'https://archive.org/download/MusopenCollectionAsMp3s/Satie_-_Gymnopedies_No.1.mp3',                 name: 'Satie — Gymnopédie No.1' },
    { url: 'https://archive.org/download/MusopenCollectionAsMp3s/Debussy_-_Clair_De_Lune.mp3',                  name: 'Debussy — Clair de Lune' },
    { url: 'https://archive.org/download/MusopenCollectionAsMp3s/Bach_-_Air_On_The_G_String.mp3',               name: 'Bach — Air on the G String' },
  ],
}

function pickFallback(tag: string, exclude?: string): { url: string; name: string } {
  const list = FALLBACK_TRACKS[tag] ?? FALLBACK_TRACKS.ambient
  const candidates = exclude ? list.filter(t => t.url !== exclude) : list
  const pool = candidates.length > 0 ? candidates : list
  return pool[Math.floor(Math.random() * pool.length)]
}

async function fetchJamendoTrack(tag: string): Promise<{ url: string; name: string } | null> {
  try {
    const res = await fetch(`/api/music?tag=${encodeURIComponent(tag)}`)
    if (res.ok) {
      const json = await res.json()
      const tracks: { audio: string; audiodownload?: string; name: string }[] = json.results ?? []
      const valid = tracks.filter(t => t.audio || t.audiodownload)
      if (valid.length) {
        const pick = valid[Math.floor(Math.random() * valid.length)]
        return { url: pick.audio || pick.audiodownload!, name: pick.name }
      }
    }
  } catch { /* fall through to fallback */ }
  // Jamendo unavailable or quota exceeded — use curated fallback
  return pickFallback(tag)
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

async function retrySupabase(
  fn: () => PromiseLike<{ error: unknown }>,
  maxRetries = 3
): Promise<boolean> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { error } = await fn()
    if (!error) return true
    if (attempt < maxRetries - 1) {
      await new Promise(r => setTimeout(r, 600 * (attempt + 1)))
    }
  }
  return false
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SessionScreen() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const userBook: UserBook | null = state?.book ?? null

  const [playing, setPlaying] = useState(false)
  const [secs, setSecs] = useState(0)
  const [page, setPage] = useState(String(userBook?.current_page ?? 1))
  const [startPage] = useState(String(userBook?.current_page ?? 1))
  const [showEndModal, setShowEndModal] = useState(false)
  const [endPage, setEndPage] = useState('')
  const [note, setNote] = useState('')
  const [lastSentence, setLastSentence] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  // ePub anchor — shown when last session was virtual, to help user locate place in physical book
  interface EpubAnchor { sentence: string; chapter: string; cfi: string; progress: number }
  const [epubAnchor, setEpubAnchor] = useState<EpubAnchor | null>(() => {
    try {
      const raw = userBook?.book_id ? localStorage.getItem(`epub_anchor_${userBook.book_id}`) : null
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })
  const [anchorExpanded, setAnchorExpanded] = useState(true)
  const [pageConfirmed, setPageConfirmed] = useState(false)
  const [correctedPage, setCorrectedPage] = useState('')

  // Music
  const [musicOn, setMusicOn] = useState(false)
  const [musicLoading, setMusicLoading] = useState(false)
  const [musicTrackName, setMusicTrackName] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Time-based timer refs (survive tab switches / browser throttling)
  const sessionStartTs = useRef<number | null>(null)
  const pausedMs = useRef<number>(0)
  const pauseStartTs = useRef<number | null>(null)
  const wakeLock = useRef<WakeLockSentinel | null>(null)

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }
    }
  }, [])

  // WakeLock
  useEffect(() => {
    if (!playing) return
    const acquire = async () => {
      try {
        wakeLock.current = await navigator.wakeLock?.request('screen')
      } catch { /* not supported */ }
    }
    acquire()
    return () => { wakeLock.current?.release(); wakeLock.current = null }
  }, [playing])

  // Single unified timer effect — sets refs and starts interval atomically
  useEffect(() => {
    if (!playing) {
      // Only record pause start if the session has already begun (avoids counting pre-play wait time)
      if (sessionStartTs.current !== null) pauseStartTs.current = Date.now()
      return
    }
    // Start or resume: update refs before tick() runs
    if (sessionStartTs.current === null) sessionStartTs.current = Date.now()
    if (pauseStartTs.current !== null) {
      pausedMs.current += Date.now() - pauseStartTs.current
      pauseStartTs.current = null
    }
    const tick = () => {
      if (sessionStartTs.current === null) return
      const activeMs = Date.now() - sessionStartTs.current - pausedMs.current
      setSecs(Math.max(0, Math.floor(activeMs / 1000)))
    }
    tick()
    const id = setInterval(tick, 500)
    const onVisible = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [playing])

  const fmt = (s: number) => {
    const hh = String(Math.floor(s / 3600)).padStart(2, '0')
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
    const ss = String(s % 60).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  }

  // ─── Music play / pause ───────────────────────────────────────────────────
  const [musicError, setMusicError] = useState(false)
  const [volume, setVolume] = useState(0.4)

  const toggleMusic = async () => {
    if (musicLoading) return
    setMusicError(false)

    // If track is already loaded, just toggle play / pause (no re-fetch)
    if (audioRef.current) {
      if (musicOn) {
        audioRef.current.pause()
        setMusicOn(false)
      } else {
        try {
          await audioRef.current.play()
          setMusicOn(true)
        } catch {
          setMusicError(true)
        }
      }
      return
    }

    // First time: fetch track and start
    setMusicLoading(true)
    const tag = genreToMusicTag(userBook?.book?.genres ?? undefined)
    let track = await fetchJamendoTrack(tag)
    if (!track && tag !== 'ambient') track = await fetchJamendoTrack('ambient')

    if (track) {
      const audio = new Audio(track.url)
      audio.loop = true
      audio.volume = volume
      audio.addEventListener('error', () => {
        if (audioRef.current === audio) setMusicError(true)
      }, { once: true })
      audioRef.current = audio
      setMusicTrackName(track.name)
      try {
        await audio.play()
        setMusicOn(true)
      } catch {
        // Autoplay was blocked — track is loaded, user can tap the play button
        setMusicOn(false)
      }
    } else {
      setMusicError(true)
    }
    setMusicLoading(false)
  }

  const skipTrack = async () => {
    if (musicLoading) return
    setMusicError(false)
    // Stop current
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    setMusicOn(false); setMusicTrackName(null)
    // Fetch new track
    setMusicLoading(true)
    const tag = genreToMusicTag(userBook?.book?.genres ?? undefined)
    let track = await fetchJamendoTrack(tag)
    if (!track && tag !== 'ambient') track = await fetchJamendoTrack('ambient')
    if (track) {
      const audio = new Audio(track.url)
      audio.loop = true; audio.volume = volume
      audio.addEventListener('error', () => {
        if (audioRef.current === audio) setMusicError(true)
      }, { once: true })
      audioRef.current = audio
      setMusicTrackName(track.name)
      try { await audio.play(); setMusicOn(true) } catch { /* blocked */ }
    } else { setMusicError(true) }
    setMusicLoading(false)
  }

  const handleVolumeChange = (v: number) => {
    setVolume(v)
    if (audioRef.current) audioRef.current.volume = v
  }

  // ─── Reliable save ─────────────────────────────────────────────────────────

  const handleEndSession = async () => {
    if (!user || !userBook) { navigate('/home'); return }
    setSaving(true)
    setSaveError(false)

    const now = Date.now()
    const totalPausedMs = pausedMs.current + (pauseStartTs.current !== null ? now - pauseStartTs.current : 0)
    const effectiveSecs = sessionStartTs.current
      ? Math.max(0, Math.floor((now - sessionStartTs.current - totalPausedMs) / 1000))
      : secs

    const resolvedEndPage = endPage || page
    const pagesRead = Math.max(0, parseInt(resolvedEndPage) - parseInt(startPage))

    const sessionPayload: Record<string, unknown> = {
      user_id: user.id,
      book_id: userBook.book_id,
      started_at: sessionStartTs.current
        ? new Date(sessionStartTs.current).toISOString()
        : new Date().toISOString(),
      ended_at: new Date(now).toISOString(),
      duration_seconds: effectiveSecs,
      start_page: parseInt(startPage),
      end_page: parseInt(resolvedEndPage),
      pages_read: pagesRead,
      session_type: 'physical',
    }
    if (lastSentence.trim()) sessionPayload.last_sentence = lastSentence.trim()

    // Persist locally before network call — recovered on next visit if needed
    localStorage.setItem('pendingSession', JSON.stringify(sessionPayload))

    const sessionOk = await retrySupabase(() =>
      supabase.from('reading_sessions').insert(sessionPayload).then(r => r)
    )
    const pageOk = await retrySupabase(() =>
      supabase.from('user_books')
        .update({ current_page: parseInt(resolvedEndPage) })
        .eq('id', userBook.id)
        .then(r => r)
    )

    if (!sessionOk || !pageOk) {
      setSaving(false)
      setSaveError(true)
      return // keep modal open so user can retry
    }

    localStorage.removeItem('pendingSession')

    // Save last sentence as epub anchor so the ePub reader can position itself
    if (lastSentence.trim() && userBook.book_id) {
      const totalPagesForProgress = userBook?.custom_pages ?? (userBook?.book as any)?.pages_default ?? 0
      const endPageNum = parseInt(resolvedEndPage) || 0
      const progress = totalPagesForProgress > 0 ? endPageNum / totalPagesForProgress : 0
      const anchor = { sentence: lastSentence.trim(), chapter: '', cfi: '', progress }
      localStorage.setItem(`epub_anchor_${userBook.book_id}`, JSON.stringify(anchor))
    }

    // Await the note insert so it actually fires before navigation
    if (note.trim()) {
      await supabase.from('book_notes').insert({
        user_id: user.id,
        book_id: userBook.book_id,
        page_number: parseInt(resolvedEndPage) || null,
        content: note.trim(),
      })
    }

    setSaving(false)
    navigate('/home')
  }

  // ─── Recovery of pending session on mount ──────────────────────────────────

  useEffect(() => {
    if (!user) return
    const pending = localStorage.getItem('pendingSession')
    if (!pending) return
    try {
      const data = JSON.parse(pending)
      // Only recover if it belongs to the current user
      if (data.user_id === user.id) {
        supabase.from('reading_sessions').insert(data).then(({ error }) => {
          if (!error) localStorage.removeItem('pendingSession')
        })
      }
    } catch {
      localStorage.removeItem('pendingSession')
    }
  }, [user])

  const dark = theme.dark
  const bg = dark ? '#000000' : '#FFFFFF'
  const fg = dark ? '#FFFFFF' : '#0A0A0A'
  const muted = '#888888'

  return (
    <div style={{ minHeight: '100%', background: bg, display: 'flex', flexDirection: 'column', padding: '64px 28px 40px' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 36 }}>
        <button onClick={() => { setPlaying(false); setEndPage(page); setShowEndModal(true) }} style={{ width: 34, height: 34, borderRadius: '50%', background: dark ? '#1E1E1E' : '#F5F5F3', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1L11 11M11 1L1 11" stroke={fg} strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: muted }}>Focus Mode</span>
        {/* Music toggle button — starts/shows player */}
        <button
          onClick={toggleMusic}
          title={musicOn ? 'Pause music' : musicTrackName ? 'Resume music' : 'Start reading music'}
          style={{ width: 34, height: 34, borderRadius: '50%', background: (musicOn || musicTrackName) ? fg : (dark ? '#1E1E1E' : '#F5F5F3'), border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
        >
          {musicLoading
            ? <Spinner color={(musicOn || musicTrackName) ? bg : muted} />
            : musicOn
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="4" height="18" rx="1" fill={bg}/><rect x="15" y="3" width="4" height="18" rx="1" fill={bg}/></svg>
              : musicTrackName
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 4l14 8-14 8V4z" fill={bg}/></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l12-2v13" stroke={fg} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="6" cy="18" r="3" stroke={fg} strokeWidth="1.5"/><circle cx="18" cy="16" r="3" stroke={fg} strokeWidth="1.5"/></svg>
          }
        </button>
      </div>

      {/* ── Music player panel ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {(musicTrackName || musicLoading || musicError) && (
          <motion.div key="music-panel" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', marginTop: -20, marginBottom: 16 }}>
            <div style={{ background: dark ? '#141414' : '#F5F5F3', borderRadius: 14, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Track name + skip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Equalizer or pause bars */}
                <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 14, flexShrink: 0 }}>
                  {[0.5, 0.9, 0.6, 1, 0.7].map((h, i) => (
                    <motion.div key={i} style={{ width: 2.5, background: musicOn ? fg : muted, borderRadius: 1, height: `${h * 14}px` }}
                      animate={musicOn ? { scaleY: [h * 0.4, h, h * 0.3, h * 0.8, h * 0.4] } : { scaleY: 0.3 }}
                      transition={{ duration: 1.1 + i * 0.15, repeat: Infinity, ease: 'easeInOut' }} />
                  ))}
                </div>
                <span style={{ flex: 1, fontSize: 12, color: musicError ? '#FF6B6B' : muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {musicError ? 'Could not load music track' : (musicLoading ? 'Loading…' : (musicTrackName ?? ''))}
                </span>
                {!musicError && musicTrackName && (
                  <button onClick={skipTrack} disabled={musicLoading} title="Skip track"
                    style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', padding: '2px 4px', fontSize: 12, flexShrink: 0 }}>
                    ⏭
                  </button>
                )}
              </div>
              {/* Play / Pause + Volume */}
              {!musicError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Play / Pause big button */}
                  <button onClick={toggleMusic} disabled={musicLoading}
                    style={{ width: 40, height: 40, borderRadius: '50%', background: fg, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: musicLoading ? 'default' : 'pointer', opacity: musicLoading ? 0.5 : 1 }}>
                    {musicLoading
                      ? <Spinner color={bg} />
                      : musicOn
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="4" height="18" rx="1" fill={bg}/><rect x="15" y="3" width="4" height="18" rx="1" fill={bg}/></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 4l14 8-14 8V4z" fill={bg}/></svg>
                    }
                  </button>
                  {/* Volume slider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M11 5L6 9H2v6h4l5 4V5z" fill={muted}/></svg>
                    <input type="range" min="0" max="1" step="0.05" value={volume}
                      onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                      style={{ flex: 1, accentColor: fg, cursor: 'pointer' }} />
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M11 5L6 9H2v6h4l5 4V5z" fill={muted}/><path d="M15.54 8.46a5 5 0 010 7.07" stroke={muted} strokeWidth="1.5" strokeLinecap="round"/><path d="M19.07 4.93a10 10 0 010 14.14" stroke={muted} strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </div>
                </div>
              )}
              {musicError && (
                <button onClick={toggleMusic} style={{ padding: '7px', borderRadius: 8, background: fg, color: bg, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Try again
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ePub anchor banner — last-sentence bridge from previous virtual session */}
      {epubAnchor && anchorExpanded && (() => {
          const isPhysical = !epubAnchor.cfi && !epubAnchor.chapter && !epubAnchor.progress
          const totalPagesForAnchor = userBook?.custom_pages ?? (userBook?.book as any)?.pages_default ?? 0
          const estimatedPage = epubAnchor.progress > 0 ? Math.round(epubAnchor.progress * totalPagesForAnchor) : 0
          return (
        <div style={{ margin: '0 0 20px', padding: '14px 16px', background: dark ? '#1a1a1a' : '#f5f5f3', borderRadius: 14, border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: muted, marginBottom: 2 }}>
                {isPhysical ? 'Last physical position' : 'Last ePub sentence'}
              </div>
              {epubAnchor.chapter && <div style={{ fontSize: 11, color: muted }}>{epubAnchor.chapter}</div>}
            </div>
            <button onClick={() => setAnchorExpanded(false)} style={{ background: 'none', border: 'none', color: muted, fontSize: 18, lineHeight: 1, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ fontSize: 13, color: fg, fontStyle: 'italic', lineHeight: 1.55, marginBottom: 10 }}>
            "{epubAnchor.sentence}"
          </div>
          {estimatedPage > 0 && (
          <div style={{ fontSize: 12, color: muted, marginBottom: 10 }}>
            Estimated page: <strong style={{ color: fg }}>{estimatedPage}</strong>
            {' '}of {totalPagesForAnchor || '?'}
          </div>
          )}
          {!pageConfirmed ? (
            <div>
              <div style={{ fontSize: 11, color: muted, marginBottom: 6 }}>Found a different page? Correct it:</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  value={correctedPage}
                  onChange={e => setCorrectedPage(e.target.value)}
                  placeholder={String(Math.round(epubAnchor.progress * (userBook?.custom_pages ?? (userBook?.book as any)?.pages_default ?? 0)))}
                  style={{ flex: 1, padding: '8px 10px', background: dark ? '#0d0d0d' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'}`, borderRadius: 8, fontSize: 14, color: fg }}
                />
                <button
                  onClick={async () => {
                    if (!correctedPage || !userBook) {
                      setPageConfirmed(true)
                      setAnchorExpanded(false)
                      localStorage.removeItem(`epub_anchor_${userBook?.book_id}`)
                      return
                    }
                    const corrected = parseInt(correctedPage)
                    const est = Math.round(epubAnchor.progress * (userBook.custom_pages ?? (userBook.book as any)?.pages_default ?? 0))

                    // 1. Update current_page so this physical session starts from the right page
                    await supabase.from('user_books')
                      .update({ current_page: corrected })
                      .eq('id', userBook.id)

                    // 2. Recalibrate epub_page_ratio for future estimates
                    if (est > 0) {
                      await supabase.from('user_books')
                        .update({ epub_page_ratio: corrected / est })
                        .eq('id', userBook.id)
                    }

                    // 3. Retroactively fix end_page of the most recent epub session
                    const { data: lastEpub } = await supabase
                      .from('reading_sessions')
                      .select('id')
                      .eq('user_id', user!.id)
                      .eq('book_id', userBook.book_id)
                      .eq('session_type', 'epub')
                      .order('started_at', { ascending: false })
                      .limit(1)
                      .maybeSingle()
                    if (lastEpub) {
                      await supabase.from('reading_sessions')
                        .update({ end_page: corrected })
                        .eq('id', lastEpub.id)
                    }

                    setPageConfirmed(true)
                    setAnchorExpanded(false)
                    localStorage.removeItem(`epub_anchor_${userBook.book_id}`)
                  }}
                  style={{ padding: '8px 14px', background: fg, color: bg, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Confirm
                </button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#22C55E' }}>Page confirmed — starting from {correctedPage}</div>
          )}
        </div>
          )
        })()}

      {/* Book cover */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <BookCover index={0} width={100} height={152} coverUrl={userBook?.book?.cover_url} title={userBook?.book?.title} author={userBook?.book?.author} />
      </div>

      {/* Book info */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: fg, lineHeight: 1.25, letterSpacing: -0.5 }}>{userBook?.book?.title ?? 'Reading Session'}</div>
        <div style={{ fontSize: 13, color: muted, marginTop: 5 }}>{userBook?.book?.author ?? ''}</div>
      </div>

      {/* Timer */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <motion.div
          animate={playing ? { boxShadow: [`0 0 0px 0px ${fg}00`, `0 0 28px 6px ${fg}18`, `0 0 0px 0px ${fg}00`] } : {}}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ background: dark ? '#111111' : '#F5F5F3', borderRadius: 20, padding: '18px 28px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {fmt(secs).split('').map((char, i) => (
              char === ':' ? (
                <motion.span
                  key={`sep-${i}`}
                  animate={playing ? { opacity: [1, 0.3, 1] } : { opacity: 0.5 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ fontFamily: '"SF Mono", "Courier New", monospace', fontSize: 52, fontWeight: 200, color: fg, lineHeight: 1, width: 16, textAlign: 'center', display: 'inline-block' }}
                >:</motion.span>
              ) : (
                <div key={i} style={{ width: 32, height: 60, overflow: 'hidden', position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={`${i}-${char}`}
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 20, opacity: 0 }}
                      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                      style={{ position: 'absolute', fontFamily: '"SF Mono", "Courier New", monospace', fontSize: 52, fontWeight: 200, color: fg, lineHeight: 1 }}
                    >{char}</motion.span>
                  </AnimatePresence>
                </div>
              )
            ))}
          </div>
        </motion.div>
      </div>

      {/* Current page — static display; user sets final page in the End modal */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 40 }}>
        <span style={{ fontSize: 13, color: muted }}>Page</span>
        <span style={{ padding: '7px 10px', background: dark ? '#1A1A1A' : '#F5F5F3', borderRadius: 10, fontSize: 16, fontWeight: 500, color: fg }}>{page}</span>
        <span style={{ fontSize: 13, color: muted }}>/ {userBook?.custom_pages ?? userBook?.book?.pages_default ?? '?'}</span>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
        <button onClick={() => setPlaying(p => !p)} style={{ width: 76, height: 76, borderRadius: '50%', background: fg, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: dark ? '0 0 0 10px rgba(255,255,255,0.07)' : '0 0 0 10px rgba(0,0,0,0.05)' }}>
          {playing
            ? <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="5" y="4" width="4.5" height="14" rx="1.5" fill={bg}/><rect x="12.5" y="4" width="4.5" height="14" rx="1.5" fill={bg}/></svg>
            : <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M7 4.5L18 11L7 17.5V4.5Z" fill={bg}/></svg>
          }
        </button>
        <button onClick={() => { setPlaying(false); setEndPage(page); setShowEndModal(true) }} style={{ background: 'none', border: 'none', fontSize: 13, color: muted, letterSpacing: 0.2 }}>End Session</button>
      </div>

      {/* End session modal */}
      <AnimatePresence>
        {showEndModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }}>
            <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
              style={{ width: '100%', maxWidth: 500, background: bg, borderRadius: '24px 24px 0 0', padding: '28px 24px 48px' }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: fg, marginBottom: 6 }}>End Session</div>
              <div style={{ fontSize: 14, color: muted, marginBottom: 24 }}>You read for {fmt(secs)}</div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: muted, display: 'block', marginBottom: 8 }}>What page did you finish on?</label>
                <input value={endPage} onChange={e => setEndPage(e.target.value)} type="number" placeholder={page}
                  style={{ width: '100%', padding: '13px', background: dark ? '#1A1A1A' : '#F5F5F3', border: 'none', borderRadius: 10, fontSize: 16, color: fg }} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: muted, display: 'block', marginBottom: 8 }}>Quick note (optional)</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Any thoughts or highlights…" rows={3}
                  style={{ width: '100%', padding: '13px', background: dark ? '#1A1A1A' : '#F5F5F3', border: 'none', borderRadius: 10, fontSize: 14, color: fg, resize: 'none' }} />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: muted, display: 'block', marginBottom: 4 }}>Last sentence (optional)</label>
                <div style={{ fontSize: 12, color: muted, marginBottom: 8 }}>The ePub reader will open to this sentence next time.</div>
                <textarea value={lastSentence} onChange={e => setLastSentence(e.target.value)} placeholder="Type the last sentence you read…" rows={2}
                  style={{ width: '100%', padding: '13px', background: dark ? '#1A1A1A' : '#F5F5F3', border: 'none', borderRadius: 10, fontSize: 14, color: fg, resize: 'none', fontStyle: lastSentence ? 'italic' : 'normal' }} />
              </div>

              {saveError && (
                <div style={{ marginBottom: 14, padding: '12px 14px', background: '#FF3B3020', borderRadius: 10, fontSize: 13, color: '#FF3B30' }}>
                  Save failed. Check your connection and try again.
                </div>
              )}

              <button onClick={handleEndSession} disabled={saving} style={{ width: '100%', padding: 15, background: saveError ? '#FF3B30' : fg, color: bg, border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 500, opacity: saving ? 0.7 : 1 }}>
                {saving ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Spinner color={bg} />Saving…
                  </span>
                ) : saveError ? 'Retry Save' : 'Save & Finish'}
              </button>
              <button onClick={() => { setShowEndModal(false); setSaveError(false); setPlaying(true) }} style={{ width: '100%', padding: '12px', marginTop: 10, background: 'none', border: 'none', fontSize: 14, color: muted }}>
                Keep Reading
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
