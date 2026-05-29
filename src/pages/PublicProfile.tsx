import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BookCover } from '../components/UI'
import { useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { CHARACTERS } from '../components/AvatarCharacter'
import Character3D from '../components/Character3D'
import { ACHIEVEMENTS, TIER_COLORS, getUnlockedCharacters } from '../data/achievements'
import type { AchievementStats } from '../data/achievements'
import type { AvatarConfig } from '../types'

interface PublicProfile {
  id: string
  username: string | null
  avatar_url: string | null
  avatar_config: AvatarConfig | null
}

interface UserBookEntry {
  id: string
  status: string
  current_page: number | null
  rating: number | null
  book: {
    title: string
    author: string
    cover_url: string | null
    pages: number | null
    genres: string[] | null
  } | null
}

export default function PublicProfileScreen() {
  const { userId } = useParams<{ userId: string }>()
  const { theme } = useTheme()
  const navigate = useNavigate()

  const [profile, setProfile]   = useState<PublicProfile | null>(null)
  const [books, setBooks]       = useState<UserBookEntry[]>([])
  const [stats, setStats]       = useState<AchievementStats | null>(null)
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!userId) return

    const load = async () => {
      setLoading(true)

      // 1 – Fetch profile
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, avatar_config')
        .eq('id', userId)
        .single()

      if (!prof) { setNotFound(true); setLoading(false); return }
      setProfile(prof as PublicProfile)

      // 2 – Fetch books (reading + finished)
      const { data: ubs } = await supabase
        .from('user_books')
        .select('id, status, current_page, rating, book:books(title, author, cover_url, pages, genres)')
        .eq('user_id', userId)
        .in('status', ['reading', 'finished'])

      const bookList = (ubs ?? []) as unknown as UserBookEntry[]
      setBooks(bookList)

      // 3 – Compute achievement stats from books alone (no private sessions)
      const finished  = bookList.filter(b => b.status === 'finished')
      const genreCounts: Record<string, number> = {}
      let totalPages = 0

      for (const b of finished) {
        if (b.book?.pages) totalPages += b.book.pages
        for (const g of b.book?.genres ?? []) {
          const key = g.toLowerCase()
          genreCounts[key] = (genreCounts[key] ?? 0) + 1
        }
      }

      // Also fetch session count for stats
      const { data: sessions } = await supabase
        .from('reading_sessions')
        .select('duration_seconds')
        .eq('user_id', userId)

      const totalHours = (sessions ?? []).reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0) / 3600
      const sessionCount = (sessions ?? []).length

      setStats({
        booksFinished: finished.length,
        totalBooks: bookList.length,
        totalPages,
        totalHours,
        streak: 0,   // not computed — not public
        genreCounts,
        sessionCount,
        notesCount: 0,
      })

      setLoading(false)
    }

    load()
  }, [userId])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: theme.muted, fontSize: 14 }}>Loading…</div>
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ color: theme.fg, fontFamily: 'Georgia, serif', fontSize: 22 }}>Profile not found</div>
        <button onClick={() => navigate(-1)} style={{ padding: '9px 20px', background: theme.bgSecondary, border: `1px solid ${theme.border}`, borderRadius: 10, color: theme.muted, fontSize: 13, cursor: 'pointer' }}>← Go back</button>
      </div>
    )
  }

  const avatarCfg    = profile.avatar_config
  const char         = avatarCfg?.character    ?? 'lion'
  const primaryColor = avatarCfg?.primaryColor ?? CHARACTERS.find(c => c.id === char)!.defaultPrimary
  const secColor     = avatarCfg?.secondaryColor ?? CHARACTERS.find(c => c.id === char)!.defaultSecondary

  const unlockedChars  = stats ? getUnlockedCharacters(stats) : new Set([char])
  const earnedAchs     = stats ? ACHIEVEMENTS.filter(a => a.check(stats!)) : []
  const reading        = books.filter(b => b.status === 'reading')
  const finished       = books.filter(b => b.status === 'finished')

  const statChips = [
    { label: 'Read',    value: String(stats?.booksFinished ?? 0) },
    { label: 'Pages',   value: stats?.totalPages ? (stats.totalPages >= 1000 ? `${(stats.totalPages/1000).toFixed(1)}k` : String(stats.totalPages)) : '0' },
    { label: 'Hours',   value: stats?.totalHours ? `${Math.round(stats.totalHours)}h` : '0h' },
    { label: 'Chars',   value: String(unlockedChars.size) },
  ]

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, paddingBottom: 40 }}>
      {/* Back button */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10, padding: '52px 16px 0', pointerEvents: 'none' }}>
        <button onClick={() => navigate(-1)} style={{ pointerEvents: 'all', background: `${theme.bg}cc`, border: `1px solid ${theme.border}`, borderRadius: 99, padding: '7px 14px', fontSize: 13, color: theme.muted, cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
          ← Back
        </button>
      </div>

      {/* Hero */}
      <div style={{ position: 'relative', overflow: 'hidden', paddingTop: 80, paddingBottom: 28, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 80%, ${primaryColor}20 0%, transparent 70%)`, pointerEvents: 'none' }}/>

        <div style={{ textAlign: 'center', marginBottom: 10, zIndex: 1 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: theme.fg, letterSpacing: -0.5 }}>@{profile.username ?? 'Reader'}</div>
        </div>

        <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }} style={{ zIndex: 1 }}>
          <Character3D character={char} primaryColor={primaryColor} secondaryColor={secColor} size={170}/>
        </motion.div>

        {/* Stat chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 14, zIndex: 1 }}>
          {statChips.map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', background: theme.bgSecondary, borderRadius: 999, border: `1px solid ${primaryColor}30` }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: theme.fg }}>{s.value}</span>
              <span style={{ fontSize: 11, color: theme.muted }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Currently reading */}
        {reading.length > 0 && (
          <section>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 12 }}>Currently Reading</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reading.map((b, i) => (
                <div key={b.id} style={{ display: 'flex', gap: 12, padding: 14, background: theme.bgSecondary, borderRadius: 14, border: `1px solid ${theme.border}` }}>
                  <BookCover index={i} width={52} height={78} coverUrl={b.book?.cover_url ?? null} title={b.book?.title} author={b.book?.author} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: theme.fg, lineHeight: 1.3 }}>{b.book?.title ?? 'Unknown'}</div>
                    <div style={{ fontSize: 12, color: theme.muted }}>{b.book?.author ?? ''}</div>
                    {b.book?.pages && b.current_page ? (
                      <div style={{ fontSize: 11, color: theme.muted }}>Page {b.current_page} / {b.book.pages} — {Math.round((b.current_page / b.book.pages) * 100)}%</div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Achievements */}
        {earnedAchs.length > 0 && (
          <section>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 12 }}>Achievements ({earnedAchs.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {earnedAchs.map(a => (
                <div key={a.id} title={a.description} style={{ padding: '6px 12px', background: theme.bgSecondary, border: `1px solid ${TIER_COLORS[a.tier]}40`, borderRadius: 999, fontSize: 12, color: TIER_COLORS[a.tier], fontWeight: 500 }}>
                  {a.name}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Finished books */}
        {finished.length > 0 && (
          <section>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 12 }}>Books Read ({finished.length})</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {finished.slice(0, 24).map((b, i) => (
                <BookCover key={b.id} index={i} width={58} height={88} coverUrl={b.book?.cover_url ?? null} title={b.book?.title} author={b.book?.author} />
              ))}
            </div>
          </section>
        )}

        {reading.length === 0 && finished.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: theme.muted, fontSize: 14 }}>
            No books on the shelf yet.
          </div>
        )}
      </div>
    </div>
  )
}
