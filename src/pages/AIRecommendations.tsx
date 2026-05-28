import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BookCover, Spinner } from '../components/UI'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { getRecommendations, type BookRecommendation } from '../services/gemini'
import { searchBooks } from '../services/books'
import type { UserBook } from '../types'

export default function AIRecommendationsScreen() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [recs, setRecs] = useState<BookRecommendation[]>([])
  const [unavailable, setUnavailable] = useState(false)
  const [noBooksInLib, setNoBooksInLib] = useState(false)
  const [error, setError] = useState(false)

  const fetchRecs = async () => {
    if (!user) return
    setLoading(true); setError(false); setUnavailable(false); setNoBooksInLib(false)

    // Use finished books first; fall back to currently-reading books
    let { data: userBooks } = await supabase.from('user_books').select('*, book:books(*)').eq('user_id', user.id).eq('status', 'finished').limit(20)
    if (!userBooks?.length) {
      const { data: readingBooks } = await supabase.from('user_books').select('*, book:books(*)').eq('user_id', user.id).eq('status', 'reading').limit(10)
      userBooks = readingBooks
    }
    if (!userBooks?.length) {
      setNoBooksInLib(true); setUnavailable(true); setLoading(false); return
    }

    const finishedBooks = (userBooks as UserBook[]).map(b => ({
      title: b.book?.title ?? '', author: b.book?.author ?? '',
      rating: b.user_rating, genres: b.book?.genres ?? [],
    }))

    const results = await getRecommendations({ finishedBooks, userId: user.id })

    if (results.length === 0) {
      setUnavailable(true); setLoading(false); return
    }

    // Enrich with cover images from API
    const enriched = await Promise.all(results.map(async (rec) => {
      try {
        const search = await searchBooks(`${rec.title} ${rec.author}`)
        if (search[0]) return { ...rec, searchResult: search[0] }
      } catch { /* ignore */ }
      return rec
    }))

    setRecs(enriched); setLoading(false)
  }

  useEffect(() => { fetchRecs() }, [user])

  return (
    <div style={{ minHeight: '100%', background: theme.bg, position: 'relative' }}>
      {/* Back */}
      <button onClick={() => navigate('/stats')} style={{ position: 'absolute', top: 16, left: 16, zIndex: 20, width: 36, height: 36, borderRadius: '50%', background: theme.bgElevated, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke={theme.fg} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>

      <div style={{ padding: '64px 22px 40px' }}>
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.muted }}>Powered by AI</div>
        </div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 400, color: theme.fg, letterSpacing: -1, marginBottom: 28, lineHeight: 1.15 }}>What should<br />you read next?</div>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 0' }}>
            <Spinner color={theme.muted} />
            <div style={{ fontSize: 14, color: theme.muted }}>Analyzing your reading taste…</div>
          </div>
        )}

        {unavailable && (
          <div style={{ padding: '24px', background: theme.bgSecondary, borderRadius: 16, textAlign: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ marginBottom: 10, opacity: 0.4 }}>
              <circle cx="20" cy="20" r="18" stroke={theme.muted} strokeWidth="2"/>
              <circle cx="13" cy="15" r="3" fill={theme.muted}/><circle cx="27" cy="15" r="3" fill={theme.muted}/>
              <path d="M12 27c2-3 6-5 8-5s6 2 8 5" stroke={theme.muted} strokeWidth="2" strokeLinecap="round"/>
              <path d="M8 8L32 32" stroke={theme.muted} strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: theme.fg, marginBottom: 6 }}>Recommendations unavailable</div>
            <div style={{ fontSize: 13, color: theme.muted, lineHeight: 1.6 }}>
              {noBooksInLib
                ? 'Add at least one book to your library first'
                : 'AI could not generate recommendations right now. This may be a temporary issue.'}
            </div>
            {!noBooksInLib && (
              <button onClick={fetchRecs} style={{ marginTop: 14, padding: '10px 22px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 14, cursor: 'pointer' }}>Try Again</button>
            )}
          </div>
        )}

        {error && (
          <div style={{ padding: '24px', background: theme.bgSecondary, borderRadius: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: theme.muted }}>Something went wrong. Please try again.</div>
            <button onClick={fetchRecs} style={{ marginTop: 12, padding: '10px 20px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 14 }}>Retry</button>
          </div>
        )}

        {!loading && recs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {recs.map((rec, i) => {
              const sr = rec.searchResult as { cover_url?: string | null } | undefined
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }}
                  style={{ display: 'flex', gap: 14, padding: 16, background: theme.bgSecondary, borderRadius: 16 }}>
                  <BookCover index={i} width={60} height={90} coverUrl={sr?.cover_url ?? null} title={rec.title} author={rec.author} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: theme.fg, lineHeight: 1.3, marginBottom: 3 }}>{rec.title}</div>
                    <div style={{ fontSize: 12, color: theme.muted, marginBottom: 8 }}>{rec.author}</div>
                    <div style={{ fontSize: 13, color: theme.fgDim, lineHeight: 1.6 }}>{rec.reason}</div>
                    <button onClick={() => navigate('/search', { state: { prefillQuery: `${rec.title} ${rec.author}` } })} style={{ marginTop: 10, padding: '7px 14px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500 }}>
                      Search →
                    </button>
                  </div>
                </motion.div>
              )
            })}

            <button onClick={fetchRecs} style={{ marginTop: 8, padding: 15, background: 'none', border: `1.5px solid ${theme.border}`, borderRadius: 12, fontSize: 14, color: theme.muted }}>
              Get new recommendations
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
