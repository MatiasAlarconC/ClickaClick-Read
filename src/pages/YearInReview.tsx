import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { getReadingPersonality } from '../services/gemini'
import type { UserBook, ReadingSession } from '../types'

// ─── Gradient palettes per slide ─────────────────────────────────────────────
const SLIDE_PALETTES = [
  { bg: 'linear-gradient(160deg,#0A0A0A 0%,#1A0A2E 100%)', accent: '#A855F7', text: '#fff' },
  { bg: 'linear-gradient(160deg,#0D1F2D 0%,#0A3040 100%)', accent: '#22D3EE', text: '#fff' },
  { bg: 'linear-gradient(160deg,#1A0000 0%,#3D0000 100%)', accent: '#F87171', text: '#fff' },
  { bg: 'linear-gradient(160deg,#052E16 0%,#064E3B 100%)', accent: '#34D399', text: '#fff' },
  { bg: 'linear-gradient(160deg,#1C1300 0%,#3D2800 100%)', accent: '#FBBF24', text: '#fff' },
  { bg: 'linear-gradient(160deg,#0A0A0A 0%,#0A0014 100%)', accent: '#E879F9', text: '#fff' },
]

// ─── Animated count-up number ─────────────────────────────────────────────────
function CountUp({ to, suffix = '', duration = 1500 }: { to: number; suffix?: string; duration?: number }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (to === 0) { setVal(0); return }
    const start = performance.now()
    const step = (ts: number) => {
      const progress = Math.min(1, (ts - start) / duration)
      const ease = 1 - Math.pow(1 - progress, 3)
      setVal(Math.round(ease * to))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [to, duration])
  return <>{val.toLocaleString()}{suffix}</>
}

// ─── Slide components ─────────────────────────────────────────────────────────
function IntroSlide({ year, palette, username }: { year: number; palette: typeof SLIDE_PALETTES[0]; username: string }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 32px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)', width: 300, height: 300, borderRadius: '50%', background: `${palette.accent}25`, filter: 'blur(60px)', pointerEvents: 'none' }}/>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: `${palette.accent}bb`, marginBottom: 16 }}>Your Reading Year</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 72, fontWeight: 400, color: palette.text, lineHeight: 1, letterSpacing: -2, marginBottom: 16 }}>{year}</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: `${palette.text}cc`, lineHeight: 1.35 }}>
          Here's your<br/>reading story,{' '}
          <strong style={{ color: palette.accent }}>{username}</strong>
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
        style={{ position: 'absolute', bottom: 32, display: 'flex', alignItems: 'center', gap: 8, color: `${palette.text}55`, fontSize: 12 }}>
        <span>Swipe to continue</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
      </motion.div>
    </div>
  )
}

function StatSlide({ label, value, suffix = '', subtext, palette, icon }: {
  label: string; value: number; suffix?: string; subtext?: string; palette: typeof SLIDE_PALETTES[0]; icon: React.ReactNode
}) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 36px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: 280, height: 280, borderRadius: '50%', background: `${palette.accent}15`, filter: 'blur(50px)', pointerEvents: 'none' }}/>
      <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
        <div style={{ color: palette.accent, marginBottom: 16 }}>{icon}</div>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: `${palette.text}77`, marginBottom: 12 }}>{label}</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 80, fontWeight: 400, color: palette.text, lineHeight: 1, letterSpacing: -3, marginBottom: 12 }}>
          <CountUp to={value} suffix={suffix}/>
        </div>
        {subtext && <div style={{ fontSize: 16, color: `${palette.text}88`, fontFamily: 'Georgia, serif', lineHeight: 1.5 }}>{subtext}</div>}
      </motion.div>
    </div>
  )
}

function GenreSlide({ topGenre, bookCount, palette }: { topGenre: string; bookCount: number; palette: typeof SLIDE_PALETTES[0] }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 36px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-5%', left: '-5%', width: 250, height: 250, borderRadius: '50%', background: `${palette.accent}20`, filter: 'blur(60px)', pointerEvents: 'none' }}/>
      <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: `${palette.text}77`, marginBottom: 20 }}>Your top genre</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 54, color: palette.text, lineHeight: 1.1, letterSpacing: -2, marginBottom: 16 }}>{topGenre}</div>
        <div style={{ height: 3, width: 60, background: palette.accent, borderRadius: 2, marginBottom: 20 }}/>
        <div style={{ fontSize: 16, color: `${palette.text}88`, lineHeight: 1.5 }}>
          You read{' '}<span style={{ color: palette.accent, fontWeight: 600 }}>{bookCount}</span>{' '}
          {bookCount === 1 ? 'book' : 'books'} in this genre this year
        </div>
      </motion.div>
    </div>
  )
}

function StreakSlide({ streak, palette }: { streak: number; palette: typeof SLIDE_PALETTES[0] }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 36px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 350, height: 350, borderRadius: '50%', background: `${palette.accent}18`, filter: 'blur(70px)', pointerEvents: 'none' }}/>
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: `${palette.text}77`, marginBottom: 12 }}>Longest streak</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 16 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 88, fontWeight: 400, color: palette.text, lineHeight: 1, letterSpacing: -3 }}>
            <CountUp to={streak}/>
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: `${palette.text}77`, marginBottom: 12 }}>days</div>
        </div>
        <div style={{ fontSize: 16, color: `${palette.text}88`, lineHeight: 1.5 }}>
          {streak >= 30 ? 'A reading ritual. Truly dedicated.' :
           streak >= 14 ? 'Two solid weeks of consistency.' :
           streak >= 7  ? 'A full week streak. Keep going!' :
           streak > 0   ? 'Every streak starts with one day.' :
           'Start your streak tomorrow.'}
        </div>
      </motion.div>
    </div>
  )
}

function PersonalitySlide({ personality, palette }: { personality: string; palette: typeof SLIDE_PALETTES[0] }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 36px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 280, height: 280, borderRadius: '50%', background: `${palette.accent}20`, filter: 'blur(60px)', pointerEvents: 'none' }}/>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }}>
        <div style={{ width: 48, height: 48, borderRadius: 16, background: `${palette.accent}22`, border: `1.5px solid ${palette.accent}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L14.5 9.5H22L16 14L18.5 21.5L12 17L5.5 21.5L8 14L2 9.5H9.5L12 2Z" stroke={palette.accent} strokeWidth="1.5" strokeLinejoin="round"/></svg>
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: `${palette.text}77`, marginBottom: 16 }}>Your reading personality</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 19, color: palette.text, lineHeight: 1.7 }}>{personality}</div>
      </motion.div>
    </div>
  )
}

function OutroSlide({ booksFinished, pagesRead, hours, palette }: { booksFinished: number; pagesRead: number; hours: number; palette: typeof SLIDE_PALETTES[0] }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 36px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 400, height: 400, borderRadius: '50%', background: `${palette.accent}15`, filter: 'blur(80px)', pointerEvents: 'none' }}/>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 36, color: palette.text, lineHeight: 1.2, marginBottom: 32 }}>What a year<br/>of reading.</div>
        {([
          { label: 'Books finished', value: booksFinished },
          { label: 'Pages read', value: pagesRead },
          { label: 'Hours reading', value: hours },
        ] as const).map(({ label, value }, i) => (
          <motion.div key={label} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.1 }}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${palette.text}12` }}>
            <span style={{ fontSize: 14, color: `${palette.text}66` }}>{label}</span>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: palette.text }}>{value.toLocaleString()}</span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
// ─── Main screen ─────────────────────────────────────────────────────────────
export default function YearInReviewScreen() {
  const { user, profile } = useAuth()
  const { theme: _theme } = useTheme()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [slideIndex, setSlideIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [personality, setPersonality] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const touchStart = useRef<number | null>(null)

  const [yearStats, setYearStats] = useState({
    booksFinished: 0, pagesRead: 0, totalMinutes: 0,
    topGenre: 'Fiction', topGenreCount: 0, longestStreak: 0, mostNotesBook: '—',
  })

  const year = new Date().getFullYear()

  useEffect(() => {
    if (!user) return
    const startOfYear = new Date(year, 0, 1).toISOString()

    Promise.all([
      supabase.from('user_books').select('*, book:books(*)').eq('user_id', user.id).eq('status', 'finished').gte('finished_at', startOfYear),
      supabase.from('reading_sessions').select('*').eq('user_id', user.id).gte('started_at', startOfYear),
      supabase.from('book_notes').select('book_id').eq('user_id', user.id),
    ]).then(([booksRes, sessRes, notesRes]) => {
      const books = (booksRes.data ?? []) as UserBook[]
      const sessions = (sessRes.data ?? []) as ReadingSession[]
      const notes = notesRes.data ?? []

      const pagesRead = sessions.reduce((s, r) => s + (r.pages_read ?? 0), 0)
      const totalSeconds = sessions.reduce((s, r) => s + (r.duration_seconds ?? 0), 0)

      const genreCount: Record<string, number> = {}
      for (const b of books) for (const g of b.book?.genres ?? []) genreCount[g] = (genreCount[g] ?? 0) + 1
      const topEntry = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0]
      const topGenre = topEntry?.[0] ?? 'Fiction'
      const topGenreCount = topEntry?.[1] ?? 0

      const sessionDates = new Set(sessions.map(s => new Date(s.started_at).toDateString()))
      let longest = 0, run = 0
      const sorted = [...sessionDates].sort()
      for (let i = 0; i < sorted.length; i++) {
        if (i === 0) { run = 1; longest = 1; continue }
        const prev = new Date(sorted[i - 1]); const cur = new Date(sorted[i])
        if ((cur.getTime() - prev.getTime()) / 86400000 <= 1) { run++; longest = Math.max(longest, run) } else run = 1
      }

      const notesCount: Record<string, number> = {}
      for (const n of notes as Array<{ book_id: string }>) notesCount[n.book_id] = (notesCount[n.book_id] ?? 0) + 1
      const mostNotesId = Object.entries(notesCount).sort((a, b) => b[1] - a[1])[0]?.[0]
      const mostNotesBook = books.find(b => b.book_id === mostNotesId)?.book?.title ?? '—'

      setYearStats({ booksFinished: books.length, pagesRead, totalMinutes: Math.round(totalSeconds / 60), topGenre, topGenreCount, longestStreak: longest, mostNotesBook })
      setLoading(false)

      getReadingPersonality({ booksFinished: books.length, pagesRead, topGenre, longestStreak: longest, userId: user.id })
        .then(p => setPersonality(p))
    })
  }, [user])

  const hours = Math.round(yearStats.totalMinutes / 60)
  const username = profile?.username ?? 'Reader'

  const slides = [
    { id: 'intro', palette: SLIDE_PALETTES[0] },
    { id: 'books', palette: SLIDE_PALETTES[1] },
    { id: 'pages', palette: SLIDE_PALETTES[2] },
    { id: 'hours', palette: SLIDE_PALETTES[3] },
    { id: 'genre', palette: SLIDE_PALETTES[4] },
    { id: 'streak', palette: SLIDE_PALETTES[0] },
    ...(personality ? [{ id: 'personality', palette: SLIDE_PALETTES[5] }] : []),
    { id: 'outro', palette: SLIDE_PALETTES[1] },
  ]

  const goTo = useCallback((dir: number) => {
    const next = slideIndex + dir
    if (next < 0 || next >= slides.length) return
    setDirection(dir)
    setSlideIndex(next)
  }, [slideIndex, slides.length])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goTo(1)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goTo(-1)
      if (e.key === 'Escape') navigate('/stats')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goTo, navigate])

  const handleTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return
    const dx = touchStart.current - e.changedTouches[0].clientX
    if (Math.abs(dx) > 50) goTo(dx > 0 ? 1 : -1)
    touchStart.current = null
  }

  const handleShare = async () => {
    setSharing(true)
    try {
      // @ts-ignore
      const { default: html2canvas } = await import('html2canvas')
      const el = document.getElementById('wrapped-slide')
      if (!el) return
      const canvas = await html2canvas(el, { useCORS: true, scale: 2, backgroundColor: null })
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a'); a.href = url; a.download = `reading-wrapped-${year}.png`; a.click()
    } catch { /* ignore */ }
    setSharing(false)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100%', background: SLIDE_PALETTES[0].bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid rgba(168,85,247,0.4)', borderTopColor: '#A855F7', animation: 'spin 0.9s linear infinite' }}/>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>Building your story…</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const current = slides[slideIndex]

  const renderSlide = () => {
    switch (current.id) {
      case 'intro':
        return <IntroSlide year={year} palette={current.palette} username={username} />
      case 'books':
        return <StatSlide label="Books finished" value={yearStats.booksFinished} palette={current.palette}
          subtext={yearStats.booksFinished >= 12 ? 'More than a book a month.' : yearStats.booksFinished > 0 ? 'Every page counts.' : 'Start your reading journey.'}
          icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" strokeLinecap="round"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" strokeLinejoin="round"/></svg>} />
      case 'pages':
        return <StatSlide label="Pages read" value={yearStats.pagesRead} palette={current.palette}
          subtext={yearStats.pagesRead >= 10000 ? 'You\'ve read a small library.' : yearStats.pagesRead >= 1000 ? 'Over a thousand pages of worlds.' : 'Every page is a new world.'}
          icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="7" y1="8" x2="17" y2="8" strokeLinecap="round"/><line x1="7" y1="12" x2="17" y2="12" strokeLinecap="round"/><line x1="7" y1="16" x2="13" y2="16" strokeLinecap="round"/></svg>} />
      case 'hours':
        return <StatSlide label="Hours reading" value={hours} suffix=" hrs" palette={current.palette}
          subtext={hours >= 100 ? 'More than 100 hours in other worlds.' : hours >= 24 ? `${hours} hours of pure focus.` : 'Time well spent.'}
          icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7V12L15 15" strokeLinecap="round"/></svg>} />
      case 'genre':
        return <GenreSlide topGenre={yearStats.topGenre} bookCount={yearStats.topGenreCount} palette={current.palette} />
      case 'streak':
        return <StreakSlide streak={yearStats.longestStreak} palette={current.palette} />
      case 'personality':
        return personality ? <PersonalitySlide personality={personality} palette={current.palette} /> : null
      case 'outro':
        return <OutroSlide booksFinished={yearStats.booksFinished} pagesRead={yearStats.pagesRead} hours={hours} palette={current.palette} />
      default: return null
    }
  }

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:  (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
  }

  return (
    <div
      style={{ minHeight: '100%', position: 'relative', overflow: 'hidden', userSelect: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slide */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={current.id}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.38, ease: [0.32, 0, 0.67, 0] }}
          id="wrapped-slide"
          style={{ position: 'absolute', inset: 0, background: current.palette.bg, color: current.palette.text, minHeight: '100%' }}
        >
          {renderSlide()}
        </motion.div>
      </AnimatePresence>

      {/* Back button */}
      <button onClick={() => navigate('/stats')}
        style={{ position: 'fixed', top: 16, left: 16, zIndex: 50, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', cursor: 'pointer' }}>
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>

      {/* Progress dots */}
      <div style={{ position: 'fixed', top: 20, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 50 }}>
        {slides.map((_, i) => (
          <button key={i} onClick={() => { setDirection(i > slideIndex ? 1 : -1); setSlideIndex(i) }}
            style={{ width: i === slideIndex ? 20 : 6, height: 6, borderRadius: 3, background: i === slideIndex ? '#fff' : 'rgba(255,255,255,0.35)', border: 'none', padding: 0, cursor: 'pointer', transition: 'all 0.3s ease' }}/>
        ))}
      </div>

      {/* Prev arrow */}
      {slideIndex > 0 && (
        <button onClick={() => goTo(-1)}
          style={{ position: 'fixed', left: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 50, width: 38, height: 38, borderRadius: '50%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      )}
      {/* Next arrow */}
      {slideIndex < slides.length - 1 && (
        <button onClick={() => goTo(1)}
          style={{ position: 'fixed', right: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 50, width: 38, height: 38, borderRadius: '50%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1L6 6L1 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      )}

      {/* Share button on last slide */}
      {current.id === 'outro' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          style={{ position: 'fixed', bottom: 32, left: 24, right: 24, zIndex: 50 }}>
          <button onClick={handleShare} disabled={sharing}
            style={{ width: '100%', padding: '14px', background: 'rgba(255,255,255,0.95)', color: '#0A0A0A', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            {sharing ? 'Saving…' : 'Save as Image'}
          </button>
        </motion.div>
      )}
    </div>
  )
}
