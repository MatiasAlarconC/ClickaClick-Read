import React, { useEffect, useRef, useState, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { getReadingPersonality } from '../services/gemini'
import { ErrorBoundary } from '../components/UI'
import type { UserBook, ReadingSession } from '../types'
// @ts-ignore
import html2canvas from 'html2canvas'

// ─── Floating 3D books ───────────────────────────────────────────────────────
function FloatingBook({ position, coverUrl, delay }: { position: [number,number,number]; coverUrl: string | null; delay: number }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    if (!coverUrl) return
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(coverUrl, setTexture, undefined, () => {})
  }, [coverUrl])

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.elapsedTime + delay
    meshRef.current.rotation.y = t * 0.4
    meshRef.current.position.y = position[1] + Math.sin(t * 0.6) * 0.15
  })

  const mat = texture ? new THREE.MeshStandardMaterial({ map: texture }) : new THREE.MeshStandardMaterial({ color: '#0A0A0A' })
  return (
    <mesh ref={meshRef} position={position} material={[mat, new THREE.MeshStandardMaterial({ color: '#080808' }), new THREE.MeshStandardMaterial({ color: '#F0EBE0' }), new THREE.MeshStandardMaterial({ color: '#F0EBE0' }), mat, new THREE.MeshStandardMaterial({ color: '#1a1a1a' })]}>
      <boxGeometry args={[0.6, 0.9, 0.08]} />
    </mesh>
  )
}

function BooksScene({ covers }: { covers: (string|null)[] }) {
  const positions: [number,number,number][] = [[-1.2, 0, 0], [0, 0.3, -0.5], [1.2, -0.1, 0], [-0.5, -0.5, 0.3], [0.5, 0.6, -0.3]]
  return (
    <Canvas camera={{ position: [0, 0, 4], fov: 50 }} style={{ background: 'transparent' }} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 5]} intensity={1.2} />
      {positions.slice(0, covers.length).map((pos, i) => (
        <FloatingBook key={i} position={pos} coverUrl={covers[i] ?? null} delay={i * 1.2} />
      ))}
    </Canvas>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function YearInReviewScreen() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const dark = theme.dark

  const [loading, setLoading] = useState(true)
  const [personality, setPersonality] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [stats, setStats] = useState({
    booksFinished: 0, pagesRead: 0, totalMinutes: 0,
    topGenre: '—', longestStreak: 0, fastestBook: '—', mostNotesBook: '—',
  })
  const [covers, setCovers] = useState<(string|null)[]>([])

  useEffect(() => {
    if (!user) return
    const year = new Date().getFullYear()
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

      // Top genre
      const genreCount: Record<string, number> = {}
      for (const b of books) {
        for (const g of b.book?.genres ?? []) genreCount[g] = (genreCount[g] ?? 0) + 1
      }
      const topGenre = Object.entries(genreCount).sort((a,b) => b[1]-a[1])[0]?.[0] ?? '—'

      // Streak
      const sessionDates = new Set(sessions.map(s => new Date(s.started_at).toDateString()))
      let longest = 0, run = 0
      const sorted = [...sessionDates].sort()
      for (let i = 0; i < sorted.length; i++) {
        if (i === 0) { run = 1; longest = 1; continue }
        const prev = new Date(sorted[i-1]); const cur = new Date(sorted[i])
        if ((cur.getTime() - prev.getTime()) / 86400000 <= 1) { run++; longest = Math.max(longest, run) } else run = 1
      }

      // Most notes book
      const notesCount: Record<string, number> = {}
      for (const n of notes as Array<{book_id: string}>) notesCount[n.book_id] = (notesCount[n.book_id] ?? 0) + 1
      const mostNotesId = Object.entries(notesCount).sort((a,b) => b[1]-a[1])[0]?.[0]
      const mostNotesBook = books.find(b => b.book_id === mostNotesId)?.book?.title ?? '—'

      setStats({ booksFinished: books.length, pagesRead, totalMinutes: Math.round(totalSeconds / 60), topGenre, longestStreak: longest, fastestBook: books[0]?.book?.title ?? '—', mostNotesBook })
      setCovers(books.slice(0, 5).map(b => b.book?.cover_url ?? null))
      setLoading(false)

      // AI personality
      getReadingPersonality({ booksFinished: books.length, pagesRead, topGenre, longestStreak: longest, userId: user.id })
        .then(p => setPersonality(p))
    })
  }, [user])

  const handleShare = async () => {
    if (!containerRef.current) return
    setSharing(true)
    try {
      const canvas = await html2canvas(containerRef.current, { useCORS: true, scale: 2 })
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a'); a.href = url; a.download = 'reading-wrapped.png'; a.click()
    } catch { /* ignore */ }
    setSharing(false)
  }

  const bg = dark ? '#000' : '#0A0A0A'
  const fg = '#FFFFFF'
  const muted = 'rgba(255,255,255,0.6)'

  if (loading) {
    return (
      <div style={{ minHeight: '100%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 14, color: muted }}>Building your story…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100%', background: bg, position: 'relative', overflow: 'hidden' }}>
      {/* Back */}
      <button onClick={() => navigate('/stats')} style={{ position: 'absolute', top: 16, left: 16, zIndex: 20, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke={fg} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>

      <div ref={containerRef}>
        {/* 3D hero */}
        <div style={{ height: 280, position: 'relative' }}>
          <ErrorBoundary fallback={null}>
            <Suspense fallback={null}>
              <BooksScene covers={covers} />
            </Suspense>
          </ErrorBoundary>
          <div style={{ position: 'absolute', top: 60, left: 0, right: 0, textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: muted, marginBottom: 4 }}>{new Date().getFullYear()}</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 32, color: fg, lineHeight: 1.1 }}>Year in<br />Review</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ padding: '0 24px 40px' }}>
          {[
            { label: 'Books Finished', value: String(stats.booksFinished), emoji: '📚' },
            { label: 'Pages Read', value: stats.pagesRead.toLocaleString(), emoji: '📄' },
            { label: 'Hours Reading', value: String(Math.round(stats.totalMinutes / 60)), emoji: '⏱' },
            { label: 'Top Genre', value: stats.topGenre, emoji: '🎭' },
            { label: 'Longest Streak', value: `${stats.longestStreak} days`, emoji: '🔥' },
            { label: 'Most Annotated', value: stats.mostNotesBook, emoji: '✏️' },
          ].map((item, i) => (
            <motion.div key={item.label} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.1 }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>{item.emoji}</span>
                <span style={{ fontSize: 14, color: muted }}>{item.label}</span>
              </div>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: fg, maxWidth: 160, textAlign: 'right' }}>{item.value}</span>
            </motion.div>
          ))}

          {/* AI Personality */}
          {personality && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
              style={{ marginTop: 32, padding: '20px', background: 'rgba(255,255,255,0.06)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: muted, marginBottom: 10 }}>✨ Your Reading Personality</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: fg, lineHeight: 1.65 }}>{personality}</div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Share button */}
      <div style={{ padding: '0 24px 48px' }}>
        <button onClick={handleShare} disabled={sharing} style={{ width: '100%', padding: 15, background: '#FFFFFF', color: '#0A0A0A', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 500 }}>
          {sharing ? 'Saving…' : '📷 Save as Image'}
        </button>
      </div>
    </div>
  )
}
