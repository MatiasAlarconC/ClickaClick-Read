import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { BookCover, Spinner } from '../components/UI'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import type { UserBook } from '../types'

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
  const [saving, setSaving] = useState(false)
  const startTime = useRef<Date>(new Date())
  const wakeLock = useRef<WakeLockSentinel | null>(null)

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

  // Timer
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [playing])

  const fmt = (s: number) => {
    const hh = String(Math.floor(s / 3600)).padStart(2, '0')
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
    const ss = String(s % 60).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  }

  const handleEndSession = async () => {
    if (!user || !userBook) { navigate('/home'); return }
    setSaving(true)

    const endedAt = new Date()
    const pagesRead = endPage ? Math.max(0, parseInt(endPage) - parseInt(startPage)) : 0

    await supabase.from('reading_sessions').insert({
      user_id: user.id,
      book_id: userBook.book_id,
      started_at: startTime.current.toISOString(),
      ended_at: endedAt.toISOString(),
      duration_seconds: secs,
      start_page: parseInt(startPage),
      end_page: endPage ? parseInt(endPage) : null,
      pages_read: pagesRead,
    })

    // Update current page so Library shows real progress
    if (endPage) {
      await supabase.from('user_books').update({ current_page: parseInt(endPage) }).eq('id', userBook.id)
    }

    // Save note if provided
    if (note.trim() && endPage) {
      await supabase.from('book_notes').insert({
        user_id: user.id, book_id: userBook.book_id,
        page_number: parseInt(endPage), content: note.trim(),
      })
    }

    setSaving(false)
    navigate('/home')
  }

  const dark = theme.dark
  const bg = dark ? '#000000' : '#FFFFFF'
  const fg = dark ? '#FFFFFF' : '#0A0A0A'
  const muted = '#888888'

  return (
    <div style={{ minHeight: '100%', background: bg, display: 'flex', flexDirection: 'column', padding: '64px 28px 40px' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 36 }}>
        <button onClick={() => { setPlaying(false); setShowEndModal(true) }} style={{ width: 34, height: 34, borderRadius: '50%', background: dark ? '#1E1E1E' : '#F5F5F3', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1L11 11M11 1L1 11" stroke={fg} strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: muted }}>Focus Mode</span>
        <div style={{ width: 34 }} />
      </div>

      {/* Book cover */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <BookCover index={0} width={120} height={182} coverUrl={userBook?.book?.cover_url} />
      </div>

      {/* Book info */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 19, color: fg, lineHeight: 1.3 }}>{userBook?.book?.title ?? 'Reading Session'}</div>
        <div style={{ fontSize: 13, color: muted, marginTop: 3 }}>{userBook?.book?.author ?? ''}</div>
      </div>

      {/* Timer */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontFamily: '"SF Mono", "Courier New", monospace', fontSize: 48, fontWeight: 200, color: fg, letterSpacing: 3, lineHeight: 1 }}>{fmt(secs)}</div>
      </div>

      {/* Current page */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 40 }}>
        <span style={{ fontSize: 13, color: muted }}>Page</span>
        <input value={page} onChange={e => setPage(e.target.value)} type="number"
          style={{ width: 64, textAlign: 'center', padding: '7px 10px', background: dark ? '#1A1A1A' : '#F5F5F3', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 500, color: fg }} />
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
        <button onClick={() => { setPlaying(false); setShowEndModal(true) }} style={{ background: 'none', border: 'none', fontSize: 13, color: muted, letterSpacing: 0.2 }}>End Session</button>
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

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: muted, display: 'block', marginBottom: 8 }}>Quick note (optional)</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Any thoughts or highlights…" rows={3}
                  style={{ width: '100%', padding: '13px', background: dark ? '#1A1A1A' : '#F5F5F3', border: 'none', borderRadius: 10, fontSize: 14, color: fg, resize: 'none' }} />
              </div>

              <button onClick={handleEndSession} disabled={saving} style={{ width: '100%', padding: 15, background: fg, color: bg, border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 500 }}>
                {saving ? 'Saving…' : 'Save & Finish'}
              </button>
              <button onClick={() => { setShowEndModal(false); setPlaying(true) }} style={{ width: '100%', padding: '12px', marginTop: 10, background: 'none', border: 'none', fontSize: 14, color: muted }}>
                Keep Reading
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
