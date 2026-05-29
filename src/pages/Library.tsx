import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import { BookCover, TabBar, ProgressBar, Stars, Spinner } from '../components/UI'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { getRecommendations, isGeminiConfigured, type BookRecommendation } from '../services/gemini'
import { searchBooks } from '../services/books'
import type { UserBook } from '../types'

type BookTab = 'reading' | 'finished' | 'want_to_read'
type LibTab = BookTab | 'discover'

const TAB_LABELS: Record<LibTab, string> = {
  reading: 'Reading',
  finished: 'Finished',
  want_to_read: 'Want to Read',
  discover: '✦ For You',
}

const REC_CACHE_TTL = 24 * 60 * 60 * 1000 // 24h

export default function LibraryScreen() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<LibTab>('reading')
  const [books, setBooks] = useState<Record<BookTab, UserBook[]>>({ reading: [], finished: [], want_to_read: [] })
  const [loading, setLoading] = useState(true)

  // Discover tab state
  const [recs, setRecs] = useState<BookRecommendation[]>([])
  const [recLoading, setRecLoading] = useState(false)
  const [recError, setRecError] = useState(false)
  const [recErrorMsg, setRecErrorMsg] = useState('')
  const [recLoadingMore, setRecLoadingMore] = useState(false)
  const [noBooksForRecs, setNoBooksForRecs] = useState(false)

  const recCacheKey = `clickaclick_recs_v1_${user?.id ?? ''}`

  const loadDiscover = async (force = false) => {
    if (!user) return
    setRecError(false); setNoBooksForRecs(false)
    // Check localStorage cache
    if (!force) {
      try {
        const raw = localStorage.getItem(recCacheKey)
        if (raw) {
          const { ts, data } = JSON.parse(raw)
          if (Date.now() - ts < REC_CACHE_TTL && data?.length > 0) { setRecs(data); return }
        }
      } catch { /* ignore */ }
    }
    if (!isGeminiConfigured()) {
      setRecError(true)
      setRecErrorMsg('No API key configured. Add VITE_GEMINI_API_KEY in Vercel.')
      setRecLoading(false)
      return
    }
    setRecLoading(true)
    let { data: userBooks } = await supabase.from('user_books').select('*, book:books(*)').eq('user_id', user.id).eq('status', 'finished').limit(20)
    if (!userBooks?.length) {
      const { data: reading } = await supabase.from('user_books').select('*, book:books(*)').eq('user_id', user.id).eq('status', 'reading').limit(10)
      userBooks = reading
    }
    if (!userBooks?.length) {
      const { data: wantToRead } = await supabase.from('user_books').select('*, book:books(*)').eq('user_id', user.id).eq('status', 'want_to_read').limit(10)
      userBooks = wantToRead
    }
    if (!userBooks?.length) { setNoBooksForRecs(true); setRecLoading(false); return }
    const bookList = (userBooks as UserBook[]).map(b => ({ title: b.book?.title ?? '', author: b.book?.author ?? '', rating: b.user_rating, genres: b.book?.genres ?? [] }))
    try {
      const results = await getRecommendations({ finishedBooks: bookList, userId: user.id, count: 10 })
      const enriched = await enrichRecs(results)
      setRecs(enriched)
      try { localStorage.setItem(recCacheKey, JSON.stringify({ ts: Date.now(), data: enriched })) } catch { /* ignore */ }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setRecError(true)
      if (msg.includes('403')) setRecErrorMsg('Gemini API key is invalid or expired. Check Vercel environment variables.')
      else if (msg.includes('429')) setRecErrorMsg('Gemini API rate limit reached. Try again in a few minutes.')
      else if (msg.includes('No Gemini API key')) setRecErrorMsg('Add VITE_GEMINI_API_KEY to your Vercel environment variables.')
      else setRecErrorMsg(`Could not generate recommendations: ${msg}`)
    }
    setRecLoading(false)
  }

  const loadMoreDiscover = async () => {
    if (!user || recLoadingMore) return
    setRecLoadingMore(true)
    let { data: userBooks } = await supabase.from('user_books').select('*, book:books(*)').eq('user_id', user.id).eq('status', 'finished').limit(20)
    if (!userBooks?.length) {
      const { data: reading } = await supabase.from('user_books').select('*, book:books(*)').eq('user_id', user.id).eq('status', 'reading').limit(10)
      userBooks = reading
    }
    if (!userBooks?.length) { setRecLoadingMore(false); return }
    const bookList = (userBooks as UserBook[]).map(b => ({ title: b.book?.title ?? '', author: b.book?.author ?? '', rating: b.user_rating, genres: b.book?.genres ?? [] }))
    const exclude = recs.map(r => r.title)
    const results = await getRecommendations({ finishedBooks: bookList, userId: user.id, count: 10, exclude })
    if (!results.length) { setRecLoadingMore(false); return }
    const enriched = await enrichRecs(results)
    setRecs(prev => [...prev, ...enriched])
    setRecLoadingMore(false)
  }

  const enrichRecs = async (results: BookRecommendation[]) => {
    return Promise.all(results.map(async rec => {
      try {
        const { results: search } = await searchBooks(`${rec.title} ${rec.author}`)
        if (search[0]) return { ...rec, searchResult: search[0] }
      } catch { /* ignore */ }
      return rec
    }))
  }

  useEffect(() => {
    if (!user) return
    fetchBooks()
  }, [user])

  useEffect(() => {
    if (tab === 'discover' && recs.length === 0 && !recLoading) loadDiscover()
  }, [tab])

  const fetchBooks = async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('user_books').select('*, book:books(*)').eq('user_id', user.id).order('added_at', { ascending: false })
    if (data) {
      const grouped: Record<BookTab, UserBook[]> = { reading: [], finished: [], want_to_read: [] }
      for (const b of data as UserBook[]) {
        if (b.status in grouped) grouped[b.status as BookTab].push(b)
      }
      setBooks(grouped)
    }
    setLoading(false)
  }

  const totalBooks = books.reading.length + books.finished.length + books.want_to_read.length
  const isBookTab = tab !== 'discover'

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: theme.bg, position: 'relative', paddingBottom: 'calc(68px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ flex: 1, padding: '64px 22px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 400, color: theme.fg, letterSpacing: -1 }}>Library</div>
          <div style={{ fontSize: 12, color: theme.muted, paddingBottom: 4 }}>{totalBooks} books</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 7, marginBottom: 22, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {(Object.keys(TAB_LABELS) as LibTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 14px', borderRadius: 999, flexShrink: 0, background: tab === t ? theme.accent : theme.bgSecondary, color: tab === t ? theme.accentFg : theme.muted, border: 'none', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 500 }}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Discover tab */}
        {tab === 'discover' && (
          <div style={{ paddingBottom: 100 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: theme.muted }}>Based on your reading history · refreshes every 24h</div>
              <button onClick={() => loadDiscover(true)} disabled={recLoading} style={{ padding: '6px 12px', background: theme.bgSecondary, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 12, color: theme.muted, cursor: 'pointer' }}>↺ Refresh</button>
            </div>
            {recLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '48px 0' }}>
                <Spinner color={theme.muted} />
                <div style={{ fontSize: 13, color: theme.muted }}>Curating your picks…</div>
              </div>
            )}
            {noBooksForRecs && !recLoading && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: theme.muted, marginBottom: 8 }}>Nothing to work with yet</div>
                <div style={{ fontSize: 13, color: theme.muted }}>Add and read some books first so the AI can learn your taste.</div>
                <button onClick={() => navigate('/search')} style={{ marginTop: 16, padding: '10px 20px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500 }}>Find books</button>
              </div>
            )}
            {recError && !recLoading && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: 13, color: theme.muted, marginBottom: 8 }}>Could not load recommendations right now.</div>
                {recErrorMsg ? <div style={{ fontSize: 11, color: theme.muted, opacity: 0.7, marginBottom: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>{recErrorMsg}</div> : null}
                <button onClick={() => loadDiscover(true)} style={{ padding: '10px 20px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 14 }}>Try Again</button>
              </div>
            )}
            {!recLoading && recs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {recs.map((rec, i) => {
                  const sr = rec.searchResult as { cover_url?: string | null } | undefined
                  return (
                    <motion.div key={`${rec.title}-${i}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 9) * 0.07 }}
                      style={{ display: 'flex', gap: 14, padding: 16, background: theme.bgSecondary, borderRadius: 16 }}>
                      <BookCover index={i} width={58} height={88} coverUrl={sr?.cover_url ?? null} title={rec.title} author={rec.author} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: theme.fg, lineHeight: 1.3, marginBottom: 3 }}>{rec.title}</div>
                        <div style={{ fontSize: 12, color: theme.muted, marginBottom: 7 }}>{rec.author}</div>
                        <div style={{ fontSize: 13, color: theme.fgDim, lineHeight: 1.6 }}>{rec.reason}</div>
                        <button onClick={() => navigate('/search', { state: { prefillQuery: `${rec.title} ${rec.author}` } })} style={{ marginTop: 10, padding: '7px 14px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Search →</button>
                      </div>
                    </motion.div>
                  )
                })}
                <button onClick={loadMoreDiscover} disabled={recLoadingMore} style={{ padding: 15, background: 'none', border: `1.5px solid ${theme.border}`, borderRadius: 12, fontSize: 14, color: theme.muted, cursor: 'pointer' }}>
                  {recLoadingMore ? 'Loading…' : 'Load more recommendations'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Book list */}
        {isBookTab && (
        <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 100 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: theme.muted }}>Loading…</div>
          ) : books[tab as BookTab].length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ marginBottom: 8 }}><svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: theme.muted }}>Nothing here yet</div>
              <button onClick={() => navigate('/search')} style={{ marginTop: 16, padding: '10px 20px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500 }}>Find books</button>
            </div>
          ) : (
            books[tab as BookTab].map((book, i) => (
              <SwipeableBookRow key={book.id} book={book} index={i} total={books[tab as BookTab].length} tab={tab as BookTab} theme={theme} userId={user?.id ?? ''} onPress={() => navigate('/detail', { state: { book: book.book } })} onDelete={() => {
                setBooks(prev => ({
                  ...prev,
                  [tab]: prev[tab as BookTab].filter(b => b.id !== book.id)
                }))
                supabase.from('user_books').delete().eq('id', book.id)
              }} onFinish={() => {
                if (tab === 'reading') {
                  supabase.from('user_books').update({ status: 'finished', finished_at: new Date().toISOString() }).eq('id', book.id)
                  setBooks(prev => ({
                    reading: prev.reading.filter(b => b.id !== book.id),
                    finished: [{ ...book, status: 'finished' }, ...prev.finished],
                    want_to_read: prev.want_to_read,
                  }))
                }
              }} />
            ))
          )}
        </div>
        )}
      </div>

      <TabBar activeTab="library" onTabChange={t => navigate(`/${t === 'home' ? 'home' : t}`)} theme={theme} />
    </div>
  )
}

function SwipeableBookRow({ book, index, total, tab, theme, userId, onPress, onDelete, onFinish }: {
  book: UserBook; index: number; total: number; tab: LibTab; theme: import('../types').Theme; userId: string
  onPress: () => void; onDelete: () => void; onFinish: () => void
}) {
  const x = useMotionValue(0)
  const deleteOpacity = useTransform(x, [-100, -40], [1, 0])
  const finishOpacity = useTransform(x, [40, 100], [0, 1])

  const [editingPage, setEditingPage] = useState(false)
  const [pageInput, setPageInput] = useState(String(book.current_page ?? ''))

  const totalPages = book.custom_pages ?? book.book?.pages_default ?? 0
  const currentPage = book.current_page ?? 0
  const progress = tab === 'reading'
    ? (totalPages > 0 ? Math.min(currentPage / totalPages, 1) : 0)
    : 1

  const saveCurrentPage = async () => {
    setEditingPage(false)
    const p = pageInput ? parseInt(pageInput) : null
    if (p === book.current_page) return
    await supabase.from('user_books').update({ current_page: p }).eq('id', book.id)
    // Log a manual reading session so Stats picks it up
    const oldPage = book.current_page ?? 0
    if (p !== null && p > oldPage && userId) {
      const now = new Date().toISOString()
      await supabase.from('reading_sessions').insert({
        user_id: userId,
        book_id: book.book_id,
        started_at: now,
        ended_at: now,
        duration_seconds: null,
        start_page: oldPage,
        end_page: p,
        pages_read: p - oldPage,
        is_manual: true,
      })
    }
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Swipe actions */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px' }}>
        <motion.div style={{ opacity: finishOpacity }}>
          <div style={{ background: '#22c55e', padding: '8px 14px', borderRadius: 10, fontSize: 12, color: '#FFF', fontWeight: 600 }}>Done</div>
        </motion.div>
        <motion.div style={{ opacity: deleteOpacity }}>
          <div style={{ background: '#ef4444', padding: '8px 14px', borderRadius: 10, fontSize: 12, color: '#FFF', fontWeight: 600 }}>🗑 Remove</div>
        </motion.div>
      </div>

      <motion.button drag="x" dragConstraints={{ left: 0, right: 0 }} style={{ x, display: 'flex', gap: 14, padding: '14px 0', background: theme.bg, border: 'none', textAlign: 'left', borderBottom: index < total - 1 ? `1px solid ${theme.border}` : 'none', cursor: 'pointer', width: '100%', position: 'relative', zIndex: 1 }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -80) onDelete()
          if (info.offset.x > 80 && tab === 'reading') onFinish()
        }}
        onClick={onPress}
        whileTap={{ scale: 0.98 }}>
        <BookCover index={index} width={60} height={90} coverUrl={book.book?.cover_url} title={book.book?.title} author={book.book?.author} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: 2, paddingBottom: 2 }}>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: theme.fg, lineHeight: 1.3, marginBottom: 3 }}>{book.book?.title ?? 'Unknown'}</div>
            <div style={{ fontSize: 12.5, color: theme.muted }}>{book.book?.author ?? ''}</div>
          </div>
          {tab === 'reading' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <button
                  onClick={e => { e.stopPropagation(); setEditingPage(true) }}
                  style={{ background: theme.bgSecondary, border: `1px solid ${theme.border}`, padding: '3px 9px', borderRadius: 8, fontSize: 11, color: theme.fg, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {editingPage ? (
                    <input
                      autoFocus
                      value={pageInput}
                      onChange={e => setPageInput(e.target.value)}
                      onBlur={saveCurrentPage}
                      onKeyDown={e => e.key === 'Enter' && saveCurrentPage()}
                      onClick={e => e.stopPropagation()}
                      type="number"
                      style={{ width: 52, padding: '2px 4px', background: 'none', border: 'none', fontSize: 11, color: theme.fg, outline: 'none' }}
                    />
                  ) : (
                    <>
                      <span>p. {book.current_page ?? '?'} of {totalPages || '?'}</span>
                      <span style={{ fontSize: 10, color: theme.muted }}>✎</span>
                    </>
                  )}
                </button>
                <span style={{ fontSize: 11, color: theme.fg, fontWeight: 600 }}>{Math.round(progress * 100)}%</span>
              </div>
              <ProgressBar progress={progress} theme={theme} height={3} />
            </div>
          )}
          {tab === 'finished' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Stars filled={book.user_rating ?? 0} count={5} size={13} color={theme.fg} />
              <span style={{ fontSize: 11, color: theme.muted }}>{book.finished_at ? new Date(book.finished_at).toLocaleDateString() : ''}</span>
            </div>
          )}
          {tab === 'want_to_read' && (
            <span style={{ fontSize: 11, color: theme.muted, background: theme.bgSecondary, padding: '3px 9px', borderRadius: 999, display: 'inline-block' }}>Want to Read</span>
          )}
        </div>
      </motion.button>
    </div>
  )
}
