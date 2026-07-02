import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { getReadingPersonality } from '../services/gemini'
import type { UserBook, ReadingSession } from '../types'

// Nothing OS monochromatic palettes — pure black, single accent per slide
const PALETTES = [
  { bg: '#000000', grad: '#000000', accent: '#FFFFFF', accent2: '#888888', text: '#fff' },
  { bg: '#000000', grad: '#000000', accent: '#3DFF8F', accent2: '#2BCE6E', text: '#fff' },
  { bg: '#000000', grad: '#000000', accent: '#FF3D6E', accent2: '#CC2952', text: '#fff' },
  { bg: '#000000', grad: '#000000', accent: '#3D9EFF', accent2: '#2272CC', text: '#fff' },
  { bg: '#000000', grad: '#000000', accent: '#FFD03D', accent2: '#CCA422', text: '#fff' },
  { bg: '#000000', grad: '#000000', accent: '#CC3DFF', accent2: '#9922CC', text: '#fff' },
]

const MONTHS_FULL = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const GRAIN_STYLE = `@keyframes grain{0%,100%{transform:translate(0,0)}10%{transform:translate(-2%,-2%)}30%{transform:translate(2%,-1%)}50%{transform:translate(-1%,2%)}70%{transform:translate(1%,1%)}90%{transform:translate(-1%,-1%)}}.yr-grain::after{content:'';position:absolute;inset:-50%;width:200%;height:200%;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");opacity:0.04;animation:grain 0.4s steps(1) infinite;pointer-events:none;z-index:2;}`

type Palette = typeof PALETTES[0]

interface MonthData { month: string; sessions: number; pages: number }

interface YearStats {
  booksFinished: number
  pagesRead: number
  totalMinutes: number
  topGenre: string
  topGenreCount: number
  longestStreak: number
  topAuthor: string
  topAuthorCount: number
  uniqueAuthors: number
  monthlyData: MonthData[]
  bestMonth: string
  bookCovers: string[]
}

// Nothing OS-style glyph ring — thin concentric circles with tick marks
function GlyphRing({ size, color, style }: { size: number; color: string; style?: React.CSSProperties }) {
  const r = size / 2
  const ticks = [0, 45, 90, 135, 180, 225, 270, 315]
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none"
      style={{ position: 'absolute', pointerEvents: 'none', opacity: 0.11, ...style }}>
      <circle cx={r} cy={r} r={r * 0.98} stroke={color} strokeWidth="0.8"/>
      <circle cx={r} cy={r} r={r * 0.72} stroke={color} strokeWidth="0.5"/>
      <circle cx={r} cy={r} r={r * 0.46} stroke={color} strokeWidth="0.5"/>
      <circle cx={r} cy={r} r={r * 0.22} stroke={color} strokeWidth="0.5"/>
      {ticks.map(a => {
        const rad = (a * Math.PI) / 180
        return <line key={a}
          x1={r + Math.cos(rad) * r * 0.72} y1={r + Math.sin(rad) * r * 0.72}
          x2={r + Math.cos(rad) * r * 0.86} y2={r + Math.sin(rad) * r * 0.86}
          stroke={color} strokeWidth="0.8" />
      })}
    </svg>
  )
}

// Shared background for all slides — dot grid + glyph rings
function NothingBg({ accent }: { accent: string }) {
  return (
    <>
      <DotGrid color={accent} />
      <GlyphRing size={380} color={accent} style={{ top: -120, right: -100, zIndex: 0 }} />
      <GlyphRing size={220} color={accent} style={{ bottom: 80, left: -80, zIndex: 0 }} />
    </>
  )
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
    <span style={{ color: '#ffffff' }}>
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

function IntroSlide({ year, p, username }: { year: number; p: Palette; username: string }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 32px', position: 'relative' }}>
      <NothingBg accent={p.accent} />
      <div style={{ position: 'relative', zIndex: 3 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', color: `${p.accent}99`, marginBottom: 16 }}>Your Reading Year</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35, duration: 0.7 }}>
          <div style={{ fontFamily: '"SF Mono", "Courier New", monospace', fontSize: 96, fontWeight: 300, lineHeight: 1, letterSpacing: -3, marginBottom: 16, color: p.text }}>
            {year}
          </div>
        </motion.div>
        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.55, duration: 0.5 }}
          style={{ height: 2, background: p.accent, width: 48, borderRadius: 1, marginBottom: 20, transformOrigin: 'left' }} />
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.6 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: `${p.text}88`, lineHeight: 1.5 }}>
            Here's your story,{' '}
            <span style={{ color: p.text, fontWeight: 600 }}>{username}</span>
          </div>
        </motion.div>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}
        style={{ position: 'absolute', bottom: 38, zIndex: 3, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Swipe</motion.div>
    </div>
  )
}

function StatSlide({ label, value, suffix = '', subtext, p, icon }: { label: string; value: number; suffix?: string; subtext?: string; p: Palette; icon: React.ReactNode }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 36px', position: 'relative' }}>
      <NothingBg accent={p.accent} />
      <div style={{ position: 'relative', zIndex: 3 }}>
        <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55 }}>
          <div style={{ color: p.accent, marginBottom: 18, display: 'inline-block', opacity: 0.8 }}>{icon}</div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3.5, textTransform: 'uppercase', color: `${p.text}44`, marginBottom: 14 }}>{label}</div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: '"SF Mono", "Courier New", monospace', fontSize: 88, fontWeight: 200, lineHeight: 1, letterSpacing: -2, color: p.text }}>
              <CountUp to={value} suffix={suffix} accent={p.accent} />
            </div>
          </div>
        </motion.div>
        {subtext && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}>
            <div style={{ width: 36, height: 2, background: p.accent, borderRadius: 1, marginBottom: 14, opacity: 0.7 }} />
            <div style={{ fontSize: 17, color: `${p.text}66`, fontFamily: 'Georgia, serif', lineHeight: 1.65 }}>{subtext}</div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

function TopAuthorSlide({ topAuthor, topAuthorCount, p }: { topAuthor: string; topAuthorCount: number; p: Palette }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 36px', position: 'relative' }}>
      <NothingBg accent={p.accent} />
      <div style={{ position: 'relative', zIndex: 3 }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.55 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3.5, textTransform: 'uppercase', color: `${p.text}44`, marginBottom: 14 }}>You loved this author</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, duration: 0.6 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 46, lineHeight: 1.15, letterSpacing: -1.5, marginBottom: 16, color: p.text }}>
            {topAuthor}
          </div>
        </motion.div>
        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.55, duration: 0.5 }}
          style={{ height: 2, background: p.accent, width: 48, borderRadius: 1, marginBottom: 20, transformOrigin: 'left', opacity: 0.7 }} />
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.5 }}>
          <div style={{ fontSize: 17, color: `${p.text}66`, fontFamily: 'Georgia, serif', lineHeight: 1.65 }}>
            You read{' '}
            <span style={{ color: p.accent, fontWeight: 700 }}>
              {topAuthorCount} {topAuthorCount === 1 ? 'book' : 'books'}
            </span>
            {' '}by this author this year.
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function MonthlySlide({ monthlyData, bestMonth, p }: { monthlyData: MonthData[]; bestMonth: string; p: Palette }) {
  const maxSessions = Math.max(...monthlyData.map(m => m.sessions), 1)
  const CHART_HEIGHT = 90

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 28px', position: 'relative' }}>
      <NothingBg accent={p.accent} />
      <div style={{ position: 'relative', zIndex: 3 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3.5, textTransform: 'uppercase', color: `${p.text}44`, marginBottom: 8 }}>Your Reading Rhythm</div>
          <div style={{ fontSize: 16, color: `${p.text}66`, fontFamily: 'Georgia, serif', marginBottom: 28 }}>
            Best month:{' '}
            <span style={{ color: p.accent, fontWeight: 700 }}>{bestMonth}</span>
          </div>
        </motion.div>

        {/* Bar chart */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: CHART_HEIGHT + 24, paddingBottom: 24 }}>
          {monthlyData.map((m, i) => {
            const isBest = m.month === bestMonth
            const barH = maxSessions > 0 ? Math.max(4, Math.round((m.sessions / maxSessions) * CHART_HEIGHT)) : 4
            return (
              <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <motion.div
                  initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                  transition={{ delay: 0.05 * i, duration: 0.35, ease: 'backOut' }}
                  style={{
                    width: '100%', height: barH, borderRadius: 4,
                    background: isBest ? p.accent : `${p.text}18`,
                    boxShadow: 'none',
                    transformOrigin: 'bottom',
                  }}
                />
                <div style={{ fontSize: 8, color: isBest ? p.accent : `${p.text}44`, fontWeight: isBest ? 700 : 400, letterSpacing: 0.2 }}>
                  {m.month.slice(0, 1)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MosaicSlide({ bookCovers, p }: { bookCovers: string[]; p: Palette }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 28px', position: 'relative' }}>
      <NothingBg accent={p.accent} />
      <div style={{ position: 'relative', zIndex: 3 }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: `${p.text}55`, marginBottom: 6 }}>Your Year in Books</div>
          <div style={{ fontSize: 14, color: `${p.text}66`, fontFamily: 'Georgia, serif', marginBottom: 22 }}>
            {bookCovers.length} cover{bookCovers.length !== 1 ? 's' : ''} from your reading year
          </div>
        </motion.div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {bookCovers.slice(0, 24).map((url, i) => (
            <motion.img
              key={i}
              src={url}
              alt=""
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.03 * i, duration: 0.3 }}
              style={{ width: 55, height: 82, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function GenreSlide({ topGenre, bookCount, p }: { topGenre: string; bookCount: number; p: Palette }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 36px', position: 'relative' }}>
      <NothingBg accent={p.accent} />
      <div style={{ position: 'relative', zIndex: 3 }}>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3.5, textTransform: 'uppercase', color: `${p.text}44`, marginBottom: 20 }}>Your top genre</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, duration: 0.6 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 58, lineHeight: 1.1, letterSpacing: -2, marginBottom: 16, color: p.text }}>
            {topGenre}
          </div>
        </motion.div>
        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.55, duration: 0.5 }}
          style={{ height: 2, background: p.accent, width: 48, borderRadius: 1, marginBottom: 20, transformOrigin: 'left', opacity: 0.7 }} />
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.5 }}>
          <div style={{ fontSize: 17, color: `${p.text}66`, fontFamily: 'Georgia, serif', lineHeight: 1.65 }}>
            You read{' '}
            <span style={{ color: p.accent, fontWeight: 700 }}>
              {bookCount} {bookCount === 1 ? 'book' : 'books'}
            </span>
            {' '}in this genre this year.
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function StreakSlide({ streak, p }: { streak: number; p: Palette }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 36px', position: 'relative' }}>
      <NothingBg accent={p.accent} />
      <div style={{ position: 'relative', zIndex: 3 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3.5, textTransform: 'uppercase', color: `${p.text}44`, marginBottom: 14 }}>Longest streak</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1, duration: 0.6 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 16 }}>
            <div style={{ fontFamily: '"SF Mono", "Courier New", monospace', fontSize: 100, fontWeight: 200, lineHeight: 1, letterSpacing: -3, color: p.text }}>
              <CountUp to={streak} accent={p.accent} />
            </div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: `${p.text}55`, marginBottom: 12 }}>days</div>
          </div>
        </motion.div>
        <div style={{ display: 'flex', gap: 5, marginBottom: 20 }}>
          {Array.from({ length: Math.min(streak, 7) }).map((_, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }}
              transition={{ delay: 0.3 + i * 0.07, duration: 0.35, ease: 'backOut' }}
              style={{ width: 28, height: 28, borderRadius: 8, background: i === Math.min(streak, 7) - 1 ? p.accent : `${p.accent}40`, border: `1px solid ${p.accent}60`, transformOrigin: 'bottom' }} />
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

function PersonalitySlide({ personality, p }: { personality: string; p: Palette }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 36px', position: 'relative' }}>
      <NothingBg accent={p.accent} />
      <div style={{ position: 'relative', zIndex: 3 }}>
        <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.65, ease: [0.34, 1.56, 0.64, 1] }}>
          <div style={{ width: 58, height: 58, borderRadius: 18, background: `linear-gradient(135deg,${p.accent}33,${p.accent2}22)`, border: `1.5px solid ${p.accent}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 26 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" stroke={p.accent} strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M19 15L19.9 17.1L22 18L19.9 18.9L19 21L18.1 18.9L16 18L18.1 17.1L19 15Z" fill={p.accent} opacity="0.7"/>
            </svg>
          </div>
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

function DotGrid({ color }: { color: string }) {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.07 }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="dotgrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.5" fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dotgrid)" />
    </svg>
  )
}

function OutroSlide({ booksFinished, pagesRead, hours, bookCovers, p, year }: { booksFinished: number; pagesRead: number; hours: number; bookCovers: string[]; p: Palette; year: number }) {
  const covers = bookCovers.slice(0, 5)
  const hasCovers = covers.length > 0

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <NothingBg accent={p.accent} />

      {/* Accent glow */}
      <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)', width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${p.accent}28 0%, transparent 65%)`, pointerEvents: 'none', zIndex: 0 }} />

      {/* Book covers strip */}
      {hasCovers && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 6, paddingTop: 80, paddingBottom: 0 }}>
          {covers.map((url, i) => {
            const isMid = i === Math.floor(covers.length / 2)
            const rotation = (i - Math.floor(covers.length / 2)) * 6
            const yOffset = isMid ? -10 : Math.abs(i - Math.floor(covers.length / 2)) * 6
            return (
              <motion.div key={i}
                initial={{ opacity: 0, y: 30, rotate: rotation * 1.5, scale: 0.8 }}
                animate={{ opacity: 1, y: yOffset, rotate: rotation, scale: isMid ? 1.08 : 1 }}
                transition={{ delay: 0.12 * i, duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
                style={{ flexShrink: 0, borderRadius: 6, overflow: 'hidden', boxShadow: `0 8px 28px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)`, border: isMid ? `1.5px solid ${p.accent}88` : 'none' }}
              >
                <img src={url} alt="" style={{ width: 62, height: 90, objectFit: 'cover', display: 'block' }} crossOrigin="anonymous" />
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* Main content */}
      <div style={{ position: 'relative', zIndex: 3, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 28px', paddingTop: hasCovers ? 16 : 90 }}>

        {/* Nothing OS style divider */}
        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.35, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          style={{ height: 1, background: `linear-gradient(90deg, transparent, ${p.accent}88, transparent)`, marginBottom: 20, transformOrigin: 'left' }} />

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.65 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3.5, textTransform: 'uppercase', color: `${p.text}55`, marginBottom: 10 }}>
            {year} · Reading Wrapped
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 40, lineHeight: 1.15, letterSpacing: -1,
            background: `linear-gradient(135deg,#fff 30%,${p.accent})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: 24 }}>
            What a year<br/>of reading.
          </div>
        </motion.div>

        {/* Big number block — Nothing OS style */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[
            { value: booksFinished.toLocaleString(), label: 'books' },
            { value: pagesRead.toLocaleString(), label: 'pages' },
            { value: hours + 'h', label: 'reading' },
          ].map(({ value, label }, i) => (
            <motion.div key={label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 + i * 0.1, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
              style={{ flex: 1, background: `rgba(255,255,255,0.05)`, border: `1px solid ${p.text}14`, borderRadius: 14, padding: '14px 10px', textAlign: 'center', backdropFilter: 'blur(4px)' }}
            >
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 400, color: p.text, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: `${p.text}55`, marginTop: 5 }}>{label}</div>
            </motion.div>
          ))}
        </div>

        {/* Nothing OS style bottom divider */}
        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.85, duration: 0.5 }}
          style={{ height: 1, background: `linear-gradient(90deg, transparent, ${p.accent}44, transparent)`, transformOrigin: 'left' }} />

        {/* ClickaClick branding */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.95, duration: 0.5 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 }}>
          <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill={p.accent} opacity="0.5"/><circle cx="5" cy="5" r="2" fill={p.accent}/></svg>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: `${p.text}44` }}>ClickaClick</span>
        </motion.div>
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
  const [yearStats, setYearStats] = useState<YearStats>({
    booksFinished: 0, pagesRead: 0, totalMinutes: 0, topGenre: 'Fiction', topGenreCount: 0, longestStreak: 0,
    topAuthor: '', topAuthorCount: 0, uniqueAuthors: 0,
    monthlyData: MONTHS_FULL.map(month => ({ month, sessions: 0, pages: 0 })),
    bestMonth: 'Jan', bookCovers: [],
  })
  const year = new Date().getFullYear()

  useEffect(() => {
    if (!user) return
    const startOfYear = new Date(year, 0, 1).toISOString()
    Promise.all([
      supabase.from('user_books').select('*, book:books(*)').eq('user_id', user.id).eq('status', 'finished').gte('finished_at', startOfYear),
      supabase.from('reading_sessions').select('*').eq('user_id', user.id),
    ]).then(([booksRes, sessRes]) => {
      const books = (booksRes.data ?? []) as UserBook[]
      const sessions = (sessRes.data ?? []) as ReadingSession[]
      const yearSessions = sessions.filter(s => new Date(s.started_at) >= new Date(startOfYear))

      // All-time stats (matching Stats screen)
      const pagesRead = sessions.reduce((s, r) => s + ((r as any).pages_read ?? 0), 0)
      const totalSeconds = sessions.filter(s => !(s as any).is_manual).reduce((s, r) => s + ((r as any).duration_seconds ?? 0), 0)

      // Genre (from year's finished books)
      const genreCount: Record<string, number> = {}
      for (const b of books) for (const g of (b.book as any)?.genres ?? []) genreCount[g] = (genreCount[g] ?? 0) + 1
      const topGenreEntry = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0]

      // Streak — use year sessions, filter out manual sessions, sort by date
      const sessionDates = new Set(yearSessions.filter(s => !(s as any).is_manual).map(s => new Date(s.started_at).toDateString()))
      const sorted = [...sessionDates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

      let longest = 0, run = 0
      for (let i = 0; i < sorted.length; i++) {
        if (i === 0) { run = 1; longest = 1; continue }
        const prev = new Date(sorted[i - 1]), cur = new Date(sorted[i])
        if ((cur.getTime() - prev.getTime()) / 86400000 <= 1) { run++; longest = Math.max(longest, run) } else run = 1
      }

      // topAuthor
      const authorCount: Record<string, number> = {}
      for (const b of books) {
        const a = (b.book as any)?.author ?? 'Unknown'
        authorCount[a] = (authorCount[a] ?? 0) + 1
      }
      const topAuthorEntry = Object.entries(authorCount).sort((a, b) => b[1] - a[1])[0]
      const topAuthor = topAuthorEntry?.[0] ?? ''
      const topAuthorCount = topAuthorEntry?.[1] ?? 0
      const uniqueAuthors = Object.keys(authorCount).length

      // monthlyData — uses yearSessions
      const monthMap: Record<number, { sessions: number; pages: number }> = {}
      for (let i = 0; i < 12; i++) monthMap[i] = { sessions: 0, pages: 0 }
      for (const s of yearSessions) {
        const m = new Date(s.started_at).getMonth()
        monthMap[m].sessions++
        monthMap[m].pages += (s as any).pages_read ?? 0
      }
      const monthlyData: MonthData[] = MONTHS_FULL.map((month, i) => ({ month, ...monthMap[i] }))
      const bestMonthIdx = monthlyData.reduce((best, m, i) => m.sessions > monthlyData[best].sessions ? i : best, 0)
      const bestMonth = MONTHS_FULL[bestMonthIdx]

      // bookCovers
      const bookCovers = books.map(b => (b.book as any)?.cover_url).filter((u: unknown): u is string => typeof u === 'string' && !!u).slice(0, 24)

      setYearStats({
        booksFinished: books.length, pagesRead, totalMinutes: Math.round(totalSeconds / 60),
        topGenre: topGenreEntry?.[0] ?? 'Fiction', topGenreCount: topGenreEntry?.[1] ?? 0,
        longestStreak: longest, topAuthor, topAuthorCount, uniqueAuthors, monthlyData, bestMonth, bookCovers,
      })
      setLoading(false)
      getReadingPersonality({ booksFinished: books.length, pagesRead, topGenre: topGenreEntry?.[0] ?? 'Fiction', longestStreak: longest, userId: user.id }).then(p => setPersonality(p))
    })
  }, [user, year])

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
    { id: 'intro', p: PALETTES[0] },
    { id: 'books', p: PALETTES[1] },
    ...(yearStats.topAuthorCount >= 2 ? [{ id: 'author', p: PALETTES[5] }] : []),
    { id: 'pages', p: PALETTES[2] },
    { id: 'monthly', p: PALETTES[3] },
    ...(yearStats.bookCovers.length >= 4 ? [{ id: 'mosaic', p: PALETTES[4] }] : []),
    { id: 'hours', p: PALETTES[0] },
    { id: 'genre', p: PALETTES[1] },
    { id: 'streak', p: PALETTES[2] },
    ...(personality ? [{ id: 'personality', p: PALETTES[5] }] : []),
    { id: 'outro', p: PALETTES[3] },
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
        <NothingBg accent={PALETTES[0].accent} />
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
      case 'author': return <TopAuthorSlide topAuthor={yearStats.topAuthor} topAuthorCount={yearStats.topAuthorCount} p={cur.p} />
      case 'pages': return <StatSlide label="Pages read" value={yearStats.pagesRead} p={cur.p}
        subtext={yearStats.pagesRead >= 1000 ? `That's like reading ${Math.round(yearStats.pagesRead / 300)} full-length novels back to back` : yearStats.pagesRead > 0 ? 'Every page is a new world.' : 'Start reading today.'}
        icon={<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="7" y1="8" x2="17" y2="8" strokeLinecap="round"/><line x1="7" y1="12" x2="17" y2="12" strokeLinecap="round"/><line x1="7" y1="16" x2="13" y2="16" strokeLinecap="round"/></svg>} />
      case 'monthly': return <MonthlySlide monthlyData={yearStats.monthlyData} bestMonth={yearStats.bestMonth} p={cur.p} />
      case 'mosaic': return <MosaicSlide bookCovers={yearStats.bookCovers} p={cur.p} />
      case 'hours': return <StatSlide label="Hours reading" value={hours} suffix="h" p={cur.p}
        subtext={hours >= 100 ? 'More than 100 hours in other worlds.' : hours >= 24 ? `${hours} hours of pure focus.` : 'Time well spent.'}
        icon={<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7V12L15 15" strokeLinecap="round"/></svg>} />
      case 'genre': return <GenreSlide topGenre={yearStats.topGenre} bookCount={yearStats.topGenreCount} p={cur.p} />
      case 'streak': return <StreakSlide streak={yearStats.longestStreak} p={cur.p} />
      case 'personality': return personality ? <PersonalitySlide personality={personality} p={cur.p} /> : null
      case 'outro': return <OutroSlide booksFinished={yearStats.booksFinished} pagesRead={yearStats.pagesRead} hours={hours} bookCovers={yearStats.bookCovers} year={year} p={cur.p} />
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
              style={{ width: '100%', padding: '15px', background: 'rgba(255,255,255,0.95)', color: '#0A0A0A', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <svg width="16" height="14" viewBox="0 0 24 20" fill="none">
                <path d="M9 2L7.17 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4H16.83L15 2H9Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              {sharing ? 'Saving…' : 'Save as Image'}
            </button>
          </motion.div>
        )}
      </div>
    </>
  )
}
