import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { getReadingPersonality } from '../services/gemini'
import type { UserBook, ReadingSession } from '../types'

const PALETTES = [
  { bg: '#06010F', grad: 'radial-gradient(ellipse at 60% 30%,#2D0A6A 0%,#06010F 65%)', accent: '#A855F7', accent2: '#EC4899', text: '#fff' },
  { bg: '#010B1A', grad: 'radial-gradient(ellipse at 40% 70%,#082040 0%,#010B1A 65%)', accent: '#22D3EE', accent2: '#6EE7B7', text: '#fff' },
  { bg: '#110005', grad: 'radial-gradient(ellipse at 70% 40%,#3D0010 0%,#110005 65%)', accent: '#F87171', accent2: '#FCA5A5', text: '#fff' },
  { bg: '#010E05', grad: 'radial-gradient(ellipse at 30% 60%,#073D1A 0%,#010E05 65%)', accent: '#34D399', accent2: '#A7F3D0', text: '#fff' },
  { bg: '#0D0800', grad: 'radial-gradient(ellipse at 50% 30%,#3D2200 0%,#0D0800 65%)', accent: '#FBBF24', accent2: '#FDE68A', text: '#fff' },
  { bg: '#06000D', grad: 'radial-gradient(ellipse at 50% 50%,#2A0052 0%,#06000D 65%)', accent: '#E879F9', accent2: '#C084FC', text: '#fff' },
]

const GRAIN_STYLE = `@keyframes grain{0%,100%{transform:translate(0,0)}10%{transform:translate(-2%,-2%)}30%{transform:translate(2%,-1%)}50%{transform:translate(-1%,2%)}70%{transform:translate(1%,1%)}90%{transform:translate(-1%,-1%)}}.yr-grain::after{content:'';position:absolute;inset:-50%;width:200%;height:200%;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");opacity:0.04;animation:grain 0.4s steps(1) infinite;pointer-events:none;z-index:2;}`

function StarField({ accent }: { accent: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width = window.innerWidth; canvas.height = window.innerHeight
    const stars = Array.from({ length: 130 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3, speed: Math.random() * 0.3 + 0.05,
      tw: Math.random() * Math.PI * 2, color: Math.random() > 0.85 ? accent : '#ffffff',
    }))
    let raf = 0
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const s of stars) {
        s.tw += s.speed * 0.04
        const alpha = 0.25 + 0.75 * Math.abs(Math.sin(s.tw))
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = s.color + Math.round(alpha * 255).toString(16).padStart(2, '0')
        ctx.fill()
        s.y -= s.speed * 0.12
        if (s.y < -2) s.y = canvas.height + 2
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [accent])
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }} />
}

function Confetti({ accent }: { accent: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width = window.innerWidth; canvas.height = window.innerHeight
    const colors = [accent, '#fff', '#FDE68A', '#C084FC', '#6EE7B7', '#F87171']
    const pieces = Array.from({ length: 90 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 9 + 4, h: Math.random() * 5 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 2.5, vy: Math.random() * 3.5 + 1.5,
      rot: Math.random() * Math.PI * 2, rotV: (Math.random() - 0.5) * 0.13, alpha: 1,
    }))
    let raf = 0
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let alive = false
      for (const p of pieces) {
        p.x += p.vx; p.y += p.vy; p.rot += p.rotV
        if (p.y > canvas.height + 20) p.alpha = Math.max(0, p.alpha - 0.025)
        if (p.alpha <= 0) continue; alive = true
        ctx.save(); ctx.globalAlpha = p.alpha; ctx.translate(p.x, p.y); ctx.rotate(p.rot)
        ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore()
      }
      if (alive) raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [accent])
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }} />
}

function CountUp({ to, suffix = '', accent, duration = 1800 }: { to: number; suffix?: string; accent: string; duration?: number }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (to === 0) { setVal(0); return }
    const start = performance.now()
    const step = (ts: number) => {
      const p = Math.min(1, (ts - start) / duration)
      setVal(Math.round((1 - Math.pow(1 - p, 4)) * to))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [to, duration])
  return (
    <span style={{ background: `linear-gradient(135deg,#fff 30%,${accent})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
      {val.toLocaleString()}{suffix}
    </span>
  )
}

function FloatingPills({ items, accent }: { items: string[]; accent: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {items.map((item, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 0 }} animate={{ opacity: [0, 0.55, 0], y: -90 }}
          transition={{ delay: i * 0.8 + 0.6, duration: 4, repeat: Infinity, repeatDelay: items.length * 0.8 }}
          style={{ position: 'absolute', left: `${8 + (i * 26) % 70}%`, bottom: `${14 + (i * 19) % 38}%`, background: `${accent}1A`, border: `1px solid ${accent}44`, borderRadius: 999, padding: '4px 11px', fontSize: 12, color: `${accent}cc`, whiteSpace: 'nowrap' }}>
          {item}
        </motion.div>
      ))}
    </div>
  )
}

function IntroSlide({ year, p, username }: { year: number; p: typeof PALETTES[0]; username: string }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 32px', position: 'relative' }}>
      <StarField accent={p.accent} />
      <FloatingPills items={['📚 reading', '✨ growth', '🔥 streak', '🌍 worlds', '💡 insight']} accent={p.accent} />
      <motion.div animate={{ scale: [1, 1.14, 1], opacity: [0.35, 0.65, 0.35] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: '26%', left: '50%', transform: 'translateX(-50%)', width: 280, height: 280, borderRadius: '50%', background: `radial-gradient(circle,${p.accent}55 0%,transparent 70%)`, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 3 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', color: `${p.accent}bb`, marginBottom: 20 }}>Your Reading Year</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.65 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35, duration: 0.85, ease: [0.34, 1.56, 0.64, 1] }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 100, fontWeight: 400, lineHeight: 1, letterSpacing: -4, marginBottom: 22,
            background: `linear-gradient(135deg,#fff 40%,${p.accent})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            filter: `drop-shadow(0 0 40px ${p.accent}88)` }}>
            {year}
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85, duration: 0.6 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: `${p.text}cc`, lineHeight: 1.5 }}>
            Here's your story,{' '}
            <span style={{ background: `linear-gradient(90deg,${p.accent},${p.accent2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontWeight: 700 }}>{username}</span>
          </div>
        </motion.div>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}
        style={{ position: 'absolute', bottom: 38, zIndex: 3, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Swipe →</motion.div>
    </div>
  )
}

function StatSlide({ label, value, suffix = '', subtext, p, icon }: { label: string; value: number; suffix?: string; subtext?: string; p: typeof PALETTES[0]; icon: React.ReactNode }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 36px', position: 'relative' }}>
      <StarField accent={p.accent} />
      <motion.div animate={{ opacity: [0.25, 0.55, 0.25], scale: [1, 1.12, 1] }} transition={{ duration: 2.8, repeat: Infinity }}
        style={{ position: 'absolute', bottom: '15%', right: '-12%', width: 320, height: 320, borderRadius: '50%', background: `radial-gradient(circle,${p.accent}45 0%,transparent 65%)`, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 3 }}>
        <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55 }}>
          <motion.div animate={{ rotate: [0, 10, -5, 0] }} transition={{ delay: 0.7, duration: 1.6 }}
            style={{ color: p.accent, marginBottom: 22, display: 'inline-block' }}>{icon}</motion.div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: `${p.text}55`, marginBottom: 18 }}>{label}</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 90, fontWeight: 400, lineHeight: 1, letterSpacing: -4, marginBottom: 20, filter: `drop-shadow(0 0 35px ${p.accent}88)` }}>
            <CountUp to={value} suffix={suffix} accent={p.accent} />
          </div>
        </motion.div>
        {subtext && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}>
            <div style={{ width: 50, height: 2, background: `linear-gradient(90deg,${p.accent},transparent)`, borderRadius: 2, marginBottom: 16 }} />
            <div style={{ fontSize: 17, color: `${p.text}88`, fontFamily: 'Georgia, serif', lineHeight: 1.65 }}>{subtext}</div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

function GenreSlide({ topGenre, bookCount, p }: { topGenre: string; bookCount: number; p: typeof PALETTES[0] }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 36px', position: 'relative' }}>
      <StarField accent={p.accent} />
      <motion.div animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 3, repeat: Infinity }}
        style={{ position: 'absolute', top: '-8%', left: '-12%', width: 280, height: 280, borderRadius: '50%', background: `radial-gradient(circle,${p.accent}50 0%,transparent 65%)`, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 3 }}>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: `${p.text}55`, marginBottom: 26 }}>Your top genre</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.72 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 60, lineHeight: 1.1, letterSpacing: -2, marginBottom: 22,
            background: `linear-gradient(135deg,#fff 30%,${p.accent})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', filter: `drop-shadow(0 0 25px ${p.accent}66)` }}>
            {topGenre}
          </div>
        </motion.div>
        <motion.div initial={{ width: 0 }} animate={{ width: 68 }} transition={{ delay: 0.55, duration: 0.6 }}
          style={{ height: 3, background: `linear-gradient(90deg,${p.accent},${p.accent2})`, borderRadius: 2, marginBottom: 24 }} />
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.5 }}>
          <div style={{ fontSize: 17, color: `${p.text}88`, fontFamily: 'Georgia, serif', lineHeight: 1.65 }}>
            You read{' '}
            <span style={{ background: `linear-gradient(90deg,${p.accent},${p.accent2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontWeight: 700 }}>
              {bookCount} {bookCount === 1 ? 'book' : 'books'}
            </span>
            {' '}in this genre this year.
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function StreakSlide({ streak, p }: { streak: number; p: typeof PALETTES[0] }) {
  const bars = Array.from({ length: 7 }, (_, i) => i < Math.min(streak, 7))
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 36px', position: 'relative' }}>
      <StarField accent={p.accent} />
      <motion.div animate={{ scale: [1, 1.18, 1], opacity: [0.22, 0.5, 0.22] }} transition={{ duration: 2.2, repeat: Infinity }}
        style={{ position: 'absolute', top: '44%', left: '44%', transform: 'translate(-50%,-50%)', width: 380, height: 380, borderRadius: '50%', background: `radial-gradient(circle,${p.accent}45 0%,transparent 60%)`, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 3 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: `${p.text}55`, marginBottom: 18 }}>Longest streak</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.55 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.75, ease: [0.34, 1.56, 0.64, 1] }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 22 }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 104, fontWeight: 400, lineHeight: 1, letterSpacing: -4, filter: `drop-shadow(0 0 45px ${p.accent})` }}>
              <CountUp to={streak} accent={p.accent} />
            </div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, color: `${p.text}66`, marginBottom: 16 }}>days</div>
          </div>
        </motion.div>
        <div style={{ display: 'flex', gap: 7, marginBottom: 22 }}>
          {bars.map((active, i) => (
            <motion.div key={i} initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }}
              transition={{ delay: 0.3 + i * 0.08, duration: 0.4, ease: 'backOut' }}
              style={{ width: 30, height: 30, borderRadius: 9, background: active ? `linear-gradient(180deg,${p.accent},${p.accent2})` : `${p.text}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
              {active ? '🔥' : ''}
            </motion.div>
          ))}
        </div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
          <div style={{ fontSize: 17, color: `${p.text}88`, fontFamily: 'Georgia, serif', lineHeight: 1.65 }}>
            {streak >= 30 ? 'A reading ritual. Truly dedicated.' : streak >= 14 ? 'Two solid weeks of consistency.' : streak >= 7 ? 'A full week streak. Keep going!' : streak > 0 ? 'Every streak starts with one day.' : 'Start your streak tomorrow.'}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function PersonalitySlide({ personality, p }: { personality: string; p: typeof PALETTES[0] }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 36px', position: 'relative' }}>
      <StarField accent={p.accent} />
      <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
        style={{ position: 'absolute', bottom: '4%', right: '-16%', width: 360, height: 360, borderRadius: '50%', border: `1px solid ${p.accent}22`, pointerEvents: 'none', zIndex: 0 }} />
      <motion.div animate={{ rotate: [360, 0] }} transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
        style={{ position: 'absolute', bottom: '10%', right: '-8%', width: 230, height: 230, borderRadius: '50%', border: `1px solid ${p.accent}38`, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 3 }}>
        <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.65, ease: [0.34, 1.56, 0.64, 1] }}>
          <div style={{ width: 58, height: 58, borderRadius: 18, background: `linear-gradient(135deg,${p.accent}33,${p.accent2}22)`, border: `1.5px solid ${p.accent}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 26, fontSize: 28 }}>✨</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: `${p.text}55`, marginBottom: 22 }}>Your reading personality</div>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55, duration: 1 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 19, color: p.text, lineHeight: 1.85 }}>{personality}</div>
        </motion.div>
      </div>
    </div>
  )
}

function OutroSlide({ booksFinished, pagesRead, hours, p }: { booksFinished: number; pagesRead: number; hours: number; p: typeof PALETTES[0] }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 36px 96px', position: 'relative' }}>
      <StarField accent={p.accent} />
      <Confetti accent={p.accent} />
      <motion.div animate={{ scale: [1, 1.22, 1], opacity: [0.28, 0.58, 0.28] }} transition={{ duration: 3.2, repeat: Infinity }}
        style={{ position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%,-50%)', width: 460, height: 460, borderRadius: '50%', background: `radial-gradient(circle,${p.accent}32 0%,transparent 62%)`, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 3 }}>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 44, lineHeight: 1.2, marginBottom: 38,
            background: `linear-gradient(135deg,#fff 40%,${p.accent})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            What a year<br/>of reading.
          </div>
        </motion.div>
        {[{ label: 'Books finished', value: booksFinished, emoji: '📚' }, { label: 'Pages read', value: pagesRead, emoji: '📄' }, { label: 'Hours reading', value: hours, emoji: '⏱' }].map(({ label, value, emoji }, i) => (
          <motion.div key={label} initial={{ opacity: 0, x: -26 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 + i * 0.13, duration: 0.5 }}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: `1px solid ${p.text}13` }}>
            <span style={{ fontSize: 15, color: `${p.text}77` }}>{emoji} {label}</span>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 24, background: `linear-gradient(90deg,#fff,${p.accent})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{value.toLocaleString()}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export default function YearInReviewScreen() {
  const { user, profile } = useAuth()
  const { theme: _t } = useTheme()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [slideIndex, setSlideIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [personality, setPersonality] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [musicOn, setMusicOn] = useState(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [yearStats, setYearStats] = useState({ booksFinished: 0, pagesRead: 0, totalMinutes: 0, topGenre: 'Fiction', topGenreCount: 0, longestStreak: 0 })
  const year = new Date().getFullYear()

  useEffect(() => {
    if (!user) return
    const startOfYear = new Date(year, 0, 1).toISOString()
    Promise.all([
      supabase.from('user_books').select('*, book:books(*)').eq('user_id', user.id).eq('status', 'finished').gte('finished_at', startOfYear),
      supabase.from('reading_sessions').select('*').eq('user_id', user.id).gte('started_at', startOfYear),
    ]).then(([booksRes, sessRes]) => {
      const books = (booksRes.data ?? []) as UserBook[]
      const sessions = (sessRes.data ?? []) as ReadingSession[]
      const pagesRead = sessions.reduce((s, r) => s + (r.pages_read ?? 0), 0)
      const totalSeconds = sessions.reduce((s, r) => s + (r.duration_seconds ?? 0), 0)
      const genreCount: Record<string, number> = {}
      for (const b of books) for (const g of b.book?.genres ?? []) genreCount[g] = (genreCount[g] ?? 0) + 1
      const topEntry = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0]
      const sessionDates = new Set(sessions.map(s => new Date(s.started_at).toDateString()))
      let longest = 0, run = 0
      const sorted = [...sessionDates].sort()
      for (let i = 0; i < sorted.length; i++) {
        if (i === 0) { run = 1; longest = 1; continue }
        const prev = new Date(sorted[i - 1]), cur = new Date(sorted[i])
        if ((cur.getTime() - prev.getTime()) / 86400000 <= 1) { run++; longest = Math.max(longest, run) } else run = 1
      }
      setYearStats({ booksFinished: books.length, pagesRead, totalMinutes: Math.round(totalSeconds / 60), topGenre: topEntry?.[0] ?? 'Fiction', topGenreCount: topEntry?.[1] ?? 0, longestStreak: longest })
      setLoading(false)
      getReadingPersonality({ booksFinished: books.length, pagesRead, topGenre: topEntry?.[0] ?? 'Fiction', longestStreak: longest, userId: user.id }).then(p => setPersonality(p))
    })
  }, [user])

  useEffect(() => {
    fetch('/api/music?tag=ambient').then(r => r.json()).then(data => {
      const valid = (data.results ?? []).filter((t: { audio?: string }) => t.audio)
      if (!valid.length) return
      const pick = valid[Math.floor(Math.random() * valid.length)]
      const audio = new Audio(pick.audio); audio.loop = true; audio.volume = 0.18
      audioRef.current = audio
    }).catch(() => {})
    return () => { audioRef.current?.pause(); audioRef.current = null }
  }, [])

  const toggleMusic = () => {
    if (!audioRef.current) return
    if (musicOn) { audioRef.current.pause(); setMusicOn(false) }
    else { audioRef.current.play().then(() => setMusicOn(true)).catch(() => {}) }
  }

  const hours = Math.round(yearStats.totalMinutes / 60)
  const username = profile?.username ?? 'Reader'
  const slides = [
    { id: 'intro', p: PALETTES[0] }, { id: 'books', p: PALETTES[1] }, { id: 'pages', p: PALETTES[2] },
    { id: 'hours', p: PALETTES[3] }, { id: 'genre', p: PALETTES[4] }, { id: 'streak', p: PALETTES[0] },
    ...(personality ? [{ id: 'personality', p: PALETTES[5] }] : []),
    { id: 'outro', p: PALETTES[1] },
  ]

  const goTo = useCallback((dir: number) => {
    const next = slideIndex + dir
    if (next < 0 || next >= slides.length) return
    setDirection(dir); setSlideIndex(next)
  }, [slideIndex, slides.length])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goTo(1)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goTo(-1)
      if (e.key === 'Escape') navigate('/stats')
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [goTo, navigate])

  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const dx = touchStart.current.x - e.changedTouches[0].clientX
    const dy = touchStart.current.y - e.changedTouches[0].clientY
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 44) goTo(dx > 0 ? 1 : -1)
    touchStart.current = null
  }

  const handleShare = async () => {
    setSharing(true)
    try {
      const { default: html2canvas } = await import('html2canvas') as any
      const el = document.getElementById('wrapped-slide'); if (!el) return
      const canvas = await html2canvas(el, { useCORS: true, scale: 2, backgroundColor: null })
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a'); a.href = url; a.download = `reading-wrapped-${year}.png`; a.click()
    } catch { /* ignore */ }
    setSharing(false)
  }

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: PALETTES[0].bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
        <StarField accent={PALETTES[0].accent} />
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
          style={{ position: 'relative', zIndex: 3, width: 46, height: 46, borderRadius: '50%', border: `2px solid ${PALETTES[0].accent}44`, borderTopColor: PALETTES[0].accent }} />
        <div style={{ position: 'relative', zIndex: 3, fontSize: 14, color: 'rgba(255,255,255,0.4)', fontFamily: 'Georgia, serif' }}>Building your story…</div>
      </div>
    )
  }

  const cur = slides[slideIndex]

  const renderSlide = () => {
    switch (cur.id) {
      case 'intro': return <IntroSlide year={year} p={cur.p} username={username} />
      case 'books': return <StatSlide label="Books finished" value={yearStats.booksFinished} p={cur.p}
        subtext={yearStats.booksFinished >= 12 ? 'More than a book a month.' : yearStats.booksFinished > 0 ? 'Every page counts.' : 'Start your reading journey.'}
        icon={<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" strokeLinecap="round"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" strokeLinejoin="round"/></svg>} />
      case 'pages': return <StatSlide label="Pages read" value={yearStats.pagesRead} p={cur.p}
        subtext={yearStats.pagesRead >= 10000 ? "You've read a small library." : yearStats.pagesRead >= 1000 ? 'Over a thousand pages of worlds.' : 'Every page is a new world.'}
        icon={<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="7" y1="8" x2="17" y2="8" strokeLinecap="round"/><line x1="7" y1="12" x2="17" y2="12" strokeLinecap="round"/><line x1="7" y1="16" x2="13" y2="16" strokeLinecap="round"/></svg>} />
      case 'hours': return <StatSlide label="Hours reading" value={hours} suffix="h" p={cur.p}
        subtext={hours >= 100 ? 'More than 100 hours in other worlds.' : hours >= 24 ? `${hours} hours of pure focus.` : 'Time well spent.'}
        icon={<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7V12L15 15" strokeLinecap="round"/></svg>} />
      case 'genre': return <GenreSlide topGenre={yearStats.topGenre} bookCount={yearStats.topGenreCount} p={cur.p} />
      case 'streak': return <StreakSlide streak={yearStats.longestStreak} p={cur.p} />
      case 'personality': return personality ? <PersonalitySlide personality={personality} p={cur.p} /> : null
      case 'outro': return <OutroSlide booksFinished={yearStats.booksFinished} pagesRead={yearStats.pagesRead} hours={hours} p={cur.p} />
      default: return null
    }
  }

  const variants = {
    enter:  (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0, scale: 0.94 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit:   (dir: number) => ({ x: dir > 0 ? '-55%' : '55%', opacity: 0, scale: 0.88 }),
  }

  return (
    <>
      <style>{GRAIN_STYLE}</style>
      <div className="yr-grain" style={{ position: 'fixed', inset: 0, overflow: 'hidden', userSelect: 'none' }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div key={cur.id} custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.48, ease: [0.32, 0, 0.67, 0] }}
            id="wrapped-slide"
            style={{ position: 'absolute', inset: 0, background: cur.p.grad, color: cur.p.text }}>
            {renderSlide()}
          </motion.div>
        </AnimatePresence>

        {/* Cinematic vignette */}
        <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(0,0,0,0.55) 100%)', pointerEvents: 'none', zIndex: 5 }} />
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 56, background: 'linear-gradient(to bottom,rgba(0,0,0,0.65),transparent)', pointerEvents: 'none', zIndex: 5 }} />
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 90, background: 'linear-gradient(to top,rgba(0,0,0,0.65),transparent)', pointerEvents: 'none', zIndex: 5 }} />

        {/* Top bar */}
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
          <button onClick={() => navigate('/stats')} style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', cursor: 'pointer' }}>
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {slides.map((_, i) => (
              <motion.button key={i} onClick={() => { setDirection(i > slideIndex ? 1 : -1); setSlideIndex(i) }}
                animate={{ width: i === slideIndex ? 20 : 6, background: i === slideIndex ? '#ffffff' : 'rgba(255,255,255,0.3)' }}
                style={{ height: 6, borderRadius: 3, border: 'none', padding: 0, cursor: 'pointer' }} />
            ))}
          </div>
          <button onClick={toggleMusic} style={{ width: 34, height: 34, borderRadius: '50%', background: musicOn ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', cursor: 'pointer' }}>
            {musicOn
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="4" height="18" rx="1" fill="white"/><rect x="15" y="3" width="4" height="18" rx="1" fill="white"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l12-2v13" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="6" cy="18" r="3" stroke="white" strokeWidth="1.5"/><circle cx="18" cy="16" r="3" stroke="white" strokeWidth="1.5"/></svg>
            }
          </button>
        </div>

        {/* Side arrows */}
        {slideIndex > 0 && (
          <button onClick={() => goTo(-1)} style={{ position: 'fixed', left: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 20, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.38)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
        {slideIndex < slides.length - 1 && (
          <button onClick={() => goTo(1)} style={{ position: 'fixed', right: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 20, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.38)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1L6 6L1 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}

        {cur.id === 'outro' && (
          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
            style={{ position: 'fixed', bottom: 24, left: 22, right: 22, zIndex: 20 }}>
            <button onClick={handleShare} disabled={sharing}
              style={{ width: '100%', padding: '15px', background: 'rgba(255,255,255,0.95)', color: '#0A0A0A', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
              {sharing ? 'Saving…' : '📸 Save as Image'}
            </button>
          </motion.div>
        )}
      </div>
    </>
  )
}
