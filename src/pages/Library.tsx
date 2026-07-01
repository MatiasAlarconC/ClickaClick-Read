import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import { BookCover, TabBar, ProgressBar, Stars, Spinner } from '../components/UI'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { getRecommendations, isGeminiConfigured, type BookRecommendation } from '../services/gemini'
import { searchBooks } from '../services/books'
import VirtualShelf from '../components/VirtualShelf'
import SpineCaptureCamera from '../components/SpineCaptureCamera'
import type { UserBook } from '../types'

type BookTab = 'reading' | 'finished' | 'want_to_read' | 'dropped'
type LibTab = BookTab | 'discover' | 'summaries' | 'shelf'

interface SavedSummary {
  bookId: string; bookTitle: string; bookAuthor: string
  summary: string; pageRange: { from: number | null; to: number | null }; savedAt: string
}

const TAB_LABELS: Record<LibTab, string> = {
  reading: 'Reading',
  finished: 'Finished',
  want_to_read: 'Want to Read',
  dropped: 'Dropped',
  summaries: 'Summaries',
  discover: '✦ For You',
  shelf: 'Shelf',
}

const REC_CACHE_TTL = 24 * 60 * 60 * 1000 // 24h

export default function LibraryScreen() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [mainSection, setMainSection] = useState<'books' | 'shelf' | 'discover'>('books')
  const [bookSubTab, setBookSubTab] = useState<'reading' | 'finished' | 'want_to_read' | 'dropped' | 'summaries'>('reading')
  const tab: LibTab = mainSection === 'shelf' ? 'shelf' : mainSection === 'discover' ? 'discover' : (bookSubTab as LibTab)
  const [books, setBooks] = useState<Record<BookTab, UserBook[]>>({ reading: [], finished: [], want_to_read: [], dropped: [] })
  const [loading, setLoading] = useState(true)
  const [spineTarget, setSpineTarget] = useState<{ userBookId: string; title: string } | null>(null)
  const [spineSaving, setSpineSaving] = useState(false)
  type SessionItem = { book_id: string; pages_read: number | null; started_at: string }
  const [sessionsByBook, setSessionsByBook] = useState<Record<string, SessionItem[]>>({})

  // Discover tab state
  const [recs, setRecs] = useState<BookRecommendation[]>([])
  const [recLoading, setRecLoading] = useState(false)
  const [recError, setRecError] = useState(false)
  const [recErrorMsg, setRecErrorMsg] = useState('')
  const [recLoadingMore, setRecLoadingMore] = useState(false)
  const [noBooksForRecs, setNoBooksForRecs] = useState(false)

  const recCacheKey = `clickaclick_recs_v1_${user?.id ?? ''}`

  const saveRecsCache = (data: BookRecommendation[]) => {
    const ts = Date.now()
    try { localStorage.setItem(recCacheKey, JSON.stringify({ ts, data })) } catch { /* ignore */ }
    if (user) {
      supabase.from('user_recs_cache').upsert(
        { user_id: user.id, recs: data, generated_at: new Date(ts).toISOString() },
        { onConflict: 'user_id' }
      ).then(() => {})
    }
  }

  // Silently pre-loads recs from localStorage or Supabase cache (no Gemini call).
  // Called in background after books load so the For You tab is ready instantly.
  const preloadRecsFromCache = async () => {
    if (!user || recs.length > 0) return
    // localStorage first (fastest)
    try {
      const raw = localStorage.getItem(recCacheKey)
      if (raw) {
        const { ts, data } = JSON.parse(raw)
        if (Date.now() - ts < REC_CACHE_TTL && data?.length > 0) { setRecs(data); return }
      }
    } catch { /* ignore */ }
    // Supabase cache (cross-device sync)
    try {
      const { data: cached } = await supabase
        .from('user_recs_cache').select('recs, generated_at').eq('user_id', user.id).single()
      if (cached?.recs && Array.isArray(cached.recs) && cached.recs.length > 0) {
        const genMs = new Date(cached.generated_at).getTime()
        if (Date.now() - genMs < REC_CACHE_TTL) {
          setRecs(cached.recs as BookRecommendation[])
          try { localStorage.setItem(recCacheKey, JSON.stringify({ ts: genMs, data: cached.recs })) } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }

  const loadDiscover = async (force = false) => {
    if (!user) return
    setRecError(false); setNoBooksForRecs(false)
    // 1. Check localStorage
    if (!force) {
      try {
        const raw = localStorage.getItem(recCacheKey)
        if (raw) {
          const { ts, data } = JSON.parse(raw)
          if (Date.now() - ts < REC_CACHE_TTL && data?.length > 0) { setRecs(data); return }
        }
      } catch { /* ignore */ }
    }
    // 2. Check Supabase cache (cross-device sync)
    if (!force) {
      try {
        const { data: cached } = await supabase
          .from('user_recs_cache').select('recs, generated_at').eq('user_id', user.id).single()
        if (cached?.recs && Array.isArray(cached.recs) && cached.recs.length > 0) {
          const genMs = new Date(cached.generated_at).getTime()
          if (Date.now() - genMs < REC_CACHE_TTL) {
            setRecs(cached.recs as BookRecommendation[])
            try { localStorage.setItem(recCacheKey, JSON.stringify({ ts: genMs, data: cached.recs })) } catch { /* ignore */ }
            return
          }
        }
      } catch { /* ignore */ }
    }
    // 3. Generate via Gemini
    if (!isGeminiConfigured()) {
      setRecError(true)
      setRecErrorMsg('No API key configured. Add VITE_GEMINI_API_KEY in Vercel.')
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
      saveRecsCache(enriched)
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
    const merged = [...recs, ...enriched]
    setRecs(merged)
    saveRecsCache(merged)
    setRecLoadingMore(false)
  }

  const enrichRecs = async (results: BookRecommendation[]) => {
    // Use Google Books only (faster — skip Open Library) with a 4s timeout per book
    return Promise.all(results.map(async rec => {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 4000)
        const params = new URLSearchParams({ q: `intitle:${rec.title} inauthor:${rec.author}`, startIndex: '0' })
        const res = await fetch(`/api/books?${params}`, { signal: controller.signal })
        clearTimeout(timer)
        if (!res.ok) return rec
        const data = await res.json()
        const item = data.items?.[0]
        if (item) {
          const info = item.volumeInfo
          return {
            ...rec, searchResult: {
              id: item.id,
              title: info.title ?? rec.title,
              author: (info.authors ?? [rec.author]).join(', '),
              cover_url: (info.imageLinks?.extraLarge ?? info.imageLinks?.large ?? info.imageLinks?.thumbnail)?.replace('http:', 'https:') ?? null,
            }
          }
        }
      } catch { /* timeout or network error — skip enrichment */ }
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
    // Show cached books instantly for perceived speed
    const cacheKey = `cc_library_cache_${user.id}`
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) { setBooks(JSON.parse(cached)); setLoading(false) }
    } catch { /* ignore */ }

    const { data } = await supabase.from('user_books').select('*, book:books(*)').eq('user_id', user.id).order('added_at', { ascending: false })
    if (data) {
      const grouped: Record<BookTab, UserBook[]> = { reading: [], finished: [], want_to_read: [], dropped: [] }
      for (const b of data as UserBook[]) {
        if (b.status in grouped) grouped[b.status as BookTab].push(b)
      }
      setBooks(grouped)
      setLoading(false)
      // Cache fresh data for next visit
      try { localStorage.setItem(cacheKey, JSON.stringify(grouped)) } catch { /* ignore */ }

      // Pre-load or generate recommendations in background so Discover is ready instantly
      loadDiscover()

      // Load sessions in background — doesn't block book display
      const readingIds = grouped.reading.map(b => b.book_id)
      if (readingIds.length > 0) {
        const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()
        supabase
          .from('reading_sessions')
          .select('book_id, pages_read, started_at')
          .in('book_id', readingIds)
          .gte('started_at', cutoff)
          .neq('is_manual', true)
          .gt('pages_read', 0)
          .then(({ data: sess }) => {
            const byBook: Record<string, SessionItem[]> = {}
            for (const s of (sess ?? []) as SessionItem[]) {
              if (!byBook[s.book_id]) byBook[s.book_id] = []
              byBook[s.book_id].push(s)
            }
            setSessionsByBook(byBook)
          })
      }
    } else {
      setLoading(false)
    }
  }

  const totalBooks = books.reading.length + books.finished.length + books.want_to_read.length
  const isBookTab = mainSection === 'books' && bookSubTab !== 'summaries'
  const [finishedSearch, setFinishedSearch] = useState('')
  const [finishedYear, setFinishedYear] = useState<string>('')
  const [finishedGenre, setFinishedGenre] = useState<string>('')
  const [showFinishedFilters, setShowFinishedFilters] = useState(false)
  const [dbSummaries, setDbSummaries] = useState<SavedSummary[]>([])

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      try {
        const { data } = await supabase.from('user_books')
          .select('book_id, note_summary, note_summary_range, book:books(title, author)')
          .eq('user_id', user.id)
          .not('note_summary', 'is', null)
        if (!data) return
        const list: SavedSummary[] = data.map((row: any) => ({
          bookId: row.book_id,
          bookTitle: row.book?.title ?? 'Unknown',
          bookAuthor: row.book?.author ?? 'Unknown',
          summary: row.note_summary,
          pageRange: row.note_summary_range ?? { from: null, to: null },
          savedAt: new Date().toISOString(),
        }))
        setDbSummaries(list)
      } catch {
        setDbSummaries([])
      }
    })()
  }, [user?.id])

  const localSummaries: SavedSummary[] = (() => {
    if (!user?.id) return []
    try { return JSON.parse(localStorage.getItem(`cc_summaries_${user.id}`) ?? '[]') } catch { return [] }
  })()

  const summaries = dbSummaries.length > 0 ? dbSummaries : localSummaries

  const handleSpineCaptured = async (dataUrl: string) => {
    if (!spineTarget || !user) return
    setSpineTarget(null)
    setSpineSaving(true)
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const path = `${user.id}/${spineTarget.userBookId}.jpg`
      const { error } = await supabase.storage
        .from('book-spines')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (!error) {
        const spineUrl = supabase.storage.from('book-spines').getPublicUrl(path).data.publicUrl
        await supabase.from('user_books').update({ spine_url: spineUrl }).eq('id', spineTarget.userBookId)
      }
    } finally {
      setSpineSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: theme.bg, position: 'relative', paddingBottom: 'calc(68px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ flex: 1, padding: '22px 22px 0', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 400, color: theme.fg, letterSpacing: -1 }}>Library</div>
          <div style={{ fontSize: 12, color: theme.muted, paddingBottom: 4 }}>{totalBooks} books</div>
        </div>

        {/* Main section selector */}
        <div style={{ display: 'flex', background: theme.bgSecondary, borderRadius: 12, padding: 3, marginBottom: 14 }}>
          {([['books', 'My Books'], ['shelf', 'Shelf'], ['discover', '✦ Discover']] as [string, string][]).map(([s, label]) => (
            <button key={s} onClick={() => setMainSection(s as 'books' | 'shelf' | 'discover')}
              style={{ flex: 1, padding: '9px 0', borderRadius: 10, background: mainSection === s ? theme.bg : 'none', color: mainSection === s ? theme.fg : theme.muted, border: 'none', fontSize: 13, fontWeight: mainSection === s ? 600 : 400, cursor: 'pointer', fontFamily: '-apple-system,system-ui,sans-serif', whiteSpace: 'nowrap' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Status chips — only inside My Books */}
        {mainSection === 'books' && (
          <div style={{ display: 'flex', gap: 7, marginBottom: 20, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
            {([['reading', 'Reading'], ['finished', 'Finished'], ['want_to_read', 'Want'], ['dropped', 'Dropped'], ['summaries', 'Notes']] as [string, string][]).map(([t, label]) => (
              <button key={t} onClick={() => setBookSubTab(t as any)}
                style={{ padding: '6px 13px', borderRadius: 999, flexShrink: 0, background: bookSubTab === t ? theme.accent : theme.bgSecondary, color: bookSubTab === t ? theme.accentFg : theme.muted, border: 'none', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Notes / Summaries tab */}
        {mainSection === 'books' && bookSubTab === 'summaries' && (
          <div style={{ paddingBottom: 100 }}>
            {summaries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: theme.muted, marginBottom: 8 }}>No notes yet</div>
                <div style={{ fontSize: 13, color: theme.muted, opacity: 0.7 }}>Generate an AI summary on a finished book and it will appear here.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {summaries.map((s, i) => (
                  <div key={`${s.bookId}-${i}`} style={{ padding: 16, background: theme.bgSecondary, borderRadius: 16, border: `1px solid ${theme.border}` }}>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: theme.fg, marginBottom: 3 }}>{s.bookTitle}</div>
                    <div style={{ fontSize: 12, color: theme.muted, marginBottom: 12 }}>
                      {s.bookAuthor}
                      {s.pageRange.from || s.pageRange.to ? ` · pp. ${s.pageRange.from ?? '?'}–${s.pageRange.to ?? '?'}` : ''}
                      {' · '}{new Date(s.savedAt).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: 13, color: theme.fgDim, lineHeight: 1.7 }}>{s.summary}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Discover tab */}
        {mainSection === 'discover' && (
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

        {/* Virtual shelf — full-bleed */}
        {mainSection === 'shelf' && (
          <div style={{ flex: 1, margin: '0 -22px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <VirtualShelf />
          </div>
        )}

        {/* Book list */}
        {isBookTab && (
        <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 100 }}>
          {/* Search + filter bar for finished books */}
          {tab === 'finished' && !loading && books.finished.length > 0 && (() => {
            const activeFilters = [finishedYear, finishedGenre].filter(Boolean).length
            return (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: showFinishedFilters ? 12 : 0 }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                      <circle cx="11" cy="11" r="8" stroke={theme.muted} strokeWidth="2"/>
                      <path d="M21 21l-4.35-4.35" stroke={theme.muted} strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <input
                      type="text"
                      value={finishedSearch}
                      onChange={e => setFinishedSearch(e.target.value)}
                      placeholder="Search finished books…"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 34px', background: theme.bgSecondary, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 13, color: theme.fg, outline: 'none' }}
                    />
                    {finishedSearch && (
                      <button onClick={() => setFinishedSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: theme.muted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}>×</button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowFinishedFilters(s => !s)}
                    style={{ flexShrink: 0, padding: '0 14px', background: activeFilters > 0 ? theme.fg : theme.bgSecondary, border: `1px solid ${activeFilters > 0 ? theme.fg : theme.border}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', color: activeFilters > 0 ? theme.bg : theme.muted, fontSize: 13, fontWeight: 500 }}>
                    <svg width="13" height="12" viewBox="0 0 16 14" fill="none"><path d="M1 2h14M4 7h8M7 12h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                    {activeFilters > 0 ? `${activeFilters}` : 'Filter'}
                  </button>
                </div>
              </div>
            )
          })()}

          {/* Filter sheet for finished books */}
          {showFinishedFilters && tab === 'finished' && (() => {
            const years = Array.from(new Set(
              books.finished.map(b => b.finished_at ? new Date(b.finished_at).getFullYear().toString() : null).filter(Boolean) as string[]
            )).sort((a, b) => Number(b) - Number(a))
            const genres = Array.from(new Set(
              books.finished.flatMap(b => b.book?.genres ?? [])
            )).filter(g => g.length < 22).sort()
            const filteredCount = books.finished.filter(b => {
              if (finishedSearch) { const q = finishedSearch.toLowerCase(); if (!(b.book?.title ?? '').toLowerCase().includes(q) && !(b.book?.author ?? '').toLowerCase().includes(q)) return false }
              if (finishedYear && b.finished_at && new Date(b.finished_at).getFullYear().toString() !== finishedYear) return false
              if (finishedGenre && !(b.book?.genres ?? []).includes(finishedGenre)) return false
              return true
            }).length
            return (
              <div style={{ position: 'fixed', inset: 0, zIndex: 400 }}>
                <div onClick={() => setShowFinishedFilters(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
                <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: theme.bg, borderRadius: '20px 20px 0 0', maxHeight: '78%', display: 'flex', flexDirection: 'column', boxShadow: '0 -10px 40px rgba(0,0,0,0.4)' }}>
                  {/* Sheet header */}
                  <div style={{ padding: '14px 20px 12px', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div style={{ width: 38, height: 4, borderRadius: 999, background: theme.border, position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)' }} />
                    <div style={{ fontSize: 15, fontWeight: 600, color: theme.fg, marginTop: 6 }}>
                      Filters {(finishedYear || finishedGenre) ? <span style={{ fontSize: 12, fontWeight: 400, color: theme.muted }}>· {[finishedYear, finishedGenre].filter(Boolean).length} active</span> : ''}
                    </div>
                    <button onClick={() => { setFinishedYear(''); setFinishedGenre('') }} style={{ background: 'none', border: 'none', color: theme.muted, fontSize: 13, cursor: 'pointer', padding: '4px 0', marginTop: 6 }}>Clear</button>
                  </div>
                  {/* Scrollable content */}
                  <div style={{ overflowY: 'auto', flex: 1, padding: '20px 20px 8px' }}>
                    {/* Year section */}
                    {years.length > 0 && (
                      <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 12 }}>Year finished</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {years.map(y => (
                            <button key={y} onClick={() => setFinishedYear(y === finishedYear ? '' : y)}
                              style={{ padding: '8px 16px', borderRadius: 8, background: finishedYear === y ? theme.fg : theme.bgSecondary, color: finishedYear === y ? theme.bg : theme.fg, border: `1px solid ${finishedYear === y ? theme.fg : theme.border}`, fontSize: 14, cursor: 'pointer', fontWeight: finishedYear === y ? 600 : 400 }}>
                              {y}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Genre section */}
                    {genres.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 12 }}>Genre</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {genres.map(g => (
                            <button key={g} onClick={() => setFinishedGenre(g === finishedGenre ? '' : g)}
                              style={{ padding: '8px 16px', borderRadius: 8, background: finishedGenre === g ? theme.fg : theme.bgSecondary, color: finishedGenre === g ? theme.bg : theme.fg, border: `1px solid ${finishedGenre === g ? theme.fg : theme.border}`, fontSize: 14, cursor: 'pointer', fontWeight: finishedGenre === g ? 600 : 400 }}>
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Footer CTA */}
                  <div style={{ padding: '12px 20px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom,0px))', borderTop: `1px solid ${theme.border}`, flexShrink: 0 }}>
                    <button onClick={() => setShowFinishedFilters(false)}
                      style={{ width: '100%', padding: '14px 0', background: theme.fg, color: theme.bg, border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                      Show results ({filteredCount})
                    </button>
                  </div>
                </div>
              </div>
            )
          })()}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: theme.muted }}>Loading…</div>
          ) : books[tab as BookTab].length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ marginBottom: 8 }}><svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: theme.muted }}>Nothing here yet</div>
              <button onClick={() => navigate('/search')} style={{ marginTop: 16, padding: '10px 20px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500 }}>Find books</button>
            </div>
          ) : tab === 'finished'
            ? renderFinishedGrouped(
                books.finished.filter(b => {
                  if (finishedSearch) {
                    const q = finishedSearch.toLowerCase()
                    if (!(b.book?.title ?? '').toLowerCase().includes(q) && !(b.book?.author ?? '').toLowerCase().includes(q)) return false
                  }
                  if (finishedYear && b.finished_at) {
                    if (new Date(b.finished_at).getFullYear().toString() !== finishedYear) return false
                  }
                  if (finishedGenre && !(b.book?.genres ?? []).includes(finishedGenre)) return false
                  return true
                }),
                theme, navigate, sessionsByBook, user?.id ?? '', setBooks, supabase,
                (userBookId, title) => setSpineTarget({ userBookId, title }),
              )
            : books[tab as BookTab].map((book) => (
              <div key={book.id} style={{ marginBottom: 14, border: `1px solid ${theme.border}`, borderRadius: 16, overflow: 'hidden' }}>
              <SwipeableBookRow book={book} index={0} total={1} tab={tab as BookTab} theme={theme} userId={user?.id ?? ''}
                sessions={sessionsByBook[book.book_id] ?? []}
                onPress={() => navigate('/detail', { state: { book: book.book } })}
                onDelete={() => {
                  setBooks(prev => ({ ...prev, [tab]: prev[tab as BookTab].filter(b => b.id !== book.id) }))
                  supabase.from('user_books').delete().eq('id', book.id)
                }}
                onFinish={() => {
                  if (tab === 'reading') {
                    supabase.from('user_books').update({ status: 'finished', finished_at: new Date().toISOString() }).eq('id', book.id)
                    setBooks(prev => ({
                      ...prev,
                      reading: prev.reading.filter(b => b.id !== book.id),
                      finished: [{ ...book, status: 'finished' as const }, ...prev.finished],
                    }))
                  }
                }}
                onCaptureSpine={() => setSpineTarget({ userBookId: book.id, title: book.book?.title ?? '' })}
              />
              </div>
            ))
          }
        </div>
        )}
      </div>

      <TabBar activeTab="library" onTabChange={t => navigate(`/${t === 'home' ? 'home' : t}`)} theme={theme} />

      {/* Spine capture camera */}
      {spineTarget && (
        <SpineCaptureCamera
          bookTitle={spineTarget.title}
          onCapture={handleSpineCaptured}
          onClose={() => setSpineTarget(null)}
        />
      )}

      {/* Saving toast */}
      {spineSaving && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: theme.fg, color: theme.bg, borderRadius: 999, padding: '8px 20px', fontSize: 13, fontWeight: 500, zIndex: 600, whiteSpace: 'nowrap' }}>
          Saving spine photo…
        </div>
      )}
    </div>
  )
}

// Extract series grouping key from a book title ("X and the Y" → "x")
function seriesKeyOf(title: string, author: string): string | null {
  const m = title.match(/^(.+?)\s+and\s+the\s+/i)
  if (m) return `${author.toLowerCase().trim()}::${m[1].toLowerCase().trim()}`
  return null
}

function seriesLabelFrom(title: string): string {
  return title.match(/^(.+?)\s+and\s+the\s+/i)?.[1] ?? title
}

function renderFinishedGrouped(
  finishedBooks: UserBook[],
  theme: import('../types').Theme,
  navigate: ReturnType<typeof import('react-router-dom').useNavigate>,
  sessionsByBook: Record<string, { book_id: string; pages_read: number | null; started_at: string }[]>,
  userId: string,
  setBooks: React.Dispatch<React.SetStateAction<Record<BookTab, UserBook[]>>>,
  sb: typeof import('../lib/supabase').supabase,
  onCaptureSpine?: (userBookId: string, title: string) => void,
) {
  // Group books by series key, preserving first-appearance order
  const groupMap = new Map<string, UserBook[]>()
  const order: string[] = []

  for (const b of finishedBooks) {
    const key = seriesKeyOf(b.book?.title ?? '', b.book?.author ?? '') ?? `__solo__${b.id}`
    if (!groupMap.has(key)) { groupMap.set(key, []); order.push(key) }
    groupMap.get(key)!.push(b)
  }

  const elements: React.ReactNode[] = []

  for (const key of order) {
    const group = groupMap.get(key)!
    if (group.length < 2 || key.startsWith('__solo__')) {
      // Standalone book
      const b = group[0]
      elements.push(
        <div key={b.id} style={{ marginBottom: 14, border: `1px solid ${theme.border}`, borderRadius: 16, overflow: 'hidden' }}>
          <SwipeableBookRow book={b} index={0} total={1} tab="finished" theme={theme} userId={userId}
            sessions={sessionsByBook[b.book_id] ?? []}
            onPress={() => navigate('/detail', { state: { book: b.book } })}
            onDelete={() => { setBooks(prev => ({ ...prev, finished: prev.finished.filter(x => x.id !== b.id) })); sb.from('user_books').delete().eq('id', b.id) }}
            onFinish={() => {}}
            onCaptureSpine={onCaptureSpine ? () => onCaptureSpine(b.id, b.book?.title ?? '') : undefined}
          />
        </div>
      )
    } else {
      // Series group card
      const label = seriesLabelFrom(group[0].book?.title ?? '')
      elements.push(
        <div key={key} style={{ marginBottom: 14, border: `1px solid ${theme.border}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '11px 14px 10px', background: theme.bgSecondary, borderBottom: `1px solid ${theme.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 2 }}>Series</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: theme.fg }}>{label} <span style={{ fontSize: 12, color: theme.muted, fontFamily: 'inherit', fontWeight: 400 }}>· {group.length} books</span></div>
          </div>
          {group.map((b, i) => (
            <div key={b.id} style={{ background: theme.bg }}>
              <SwipeableBookRow book={b} index={i} total={group.length} tab="finished" theme={theme} userId={userId}
                sessions={sessionsByBook[b.book_id] ?? []}
                onPress={() => navigate('/detail', { state: { book: b.book } })}
                onDelete={() => { setBooks(prev => ({ ...prev, finished: prev.finished.filter(x => x.id !== b.id) })); sb.from('user_books').delete().eq('id', b.id) }}
                onFinish={() => {}}
                onCaptureSpine={onCaptureSpine ? () => onCaptureSpine(b.id, b.book?.title ?? '') : undefined}
              />
            </div>
          ))}
        </div>
      )
    }
  }

  return <>{elements}</>
}

function computePrediction(sessions: { book_id: string; pages_read: number | null; started_at: string }[], currentPage: number, totalPages: number): { label: string } | null {
  if (!sessions.length || totalPages <= 0 || currentPage >= totalPages) return null
  const byDay: Record<string, number> = {}
  for (const s of sessions) {
    const day = s.started_at.slice(0, 10)
    byDay[day] = (byDay[day] ?? 0) + (s.pages_read ?? 0)
  }
  const days = Object.values(byDay)
  if (!days.length) return null
  const avgPerDay = days.reduce((a, b) => a + b, 0) / days.length
  if (avgPerDay <= 0) return null
  const pagesLeft = totalPages - currentPage
  const daysLeft = Math.ceil(pagesLeft / avgPerDay)
  const finish = new Date()
  finish.setDate(finish.getDate() + daysLeft)
  const now = new Date()
  const diffDays = Math.round((finish.getTime() - now.getTime()) / 86400000)
  let label: string
  if (diffDays <= 0) label = 'Finish today'
  else if (diffDays === 1) label = 'Finish tomorrow'
  else if (diffDays <= 7) label = `Finish in ${diffDays} days`
  else if (diffDays <= 14) label = `Finish next week`
  else {
    label = `Finish ${finish.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }
  return { label }
}

function SwipeableBookRow({ book, index, total, tab, theme, userId, onPress, onDelete, onFinish, onCaptureSpine, sessions }: {
  book: UserBook; index: number; total: number; tab: LibTab; theme: import('../types').Theme; userId: string
  onPress: () => void; onDelete: () => void; onFinish: () => void; onCaptureSpine?: () => void
  sessions?: { book_id: string; pages_read: number | null; started_at: string }[]
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
  const prediction = tab === 'reading' ? computePrediction(sessions ?? [], currentPage, totalPages) : null

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

      <motion.button drag="x" dragConstraints={{ left: 0, right: 0 }} style={{ x, display: 'flex', gap: 14, padding: '14px 16px', background: theme.bg, border: 'none', textAlign: 'left', borderBottom: index < total - 1 ? `1px solid ${theme.border}` : 'none', cursor: 'pointer', width: '100%', position: 'relative', zIndex: 1 }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -80) onDelete()
          if (info.offset.x > 80 && tab === 'reading') onFinish()
        }}
        onClick={onPress}
        whileTap={{ scale: 0.98 }}>
        <BookCover index={index} width={60} height={90} coverUrl={book.book?.cover_url} title={book.book?.title} author={book.book?.author} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: 2, paddingBottom: 2 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: theme.fg, lineHeight: 1.3, marginBottom: 3 }}>{book.book?.title ?? 'Unknown'}</div>
              <div style={{ fontSize: 12.5, color: theme.muted }}>{book.book?.author ?? ''}</div>
            </div>
            {onCaptureSpine && (
              <button
                onClick={e => { e.stopPropagation(); onCaptureSpine() }}
                title="Add spine photo"
                style={{ flexShrink: 0, background: 'none', border: `1px solid ${theme.border}`, borderRadius: 7, padding: '5px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center', marginTop: 1 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke={theme.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="13" r="4" stroke={theme.muted} strokeWidth="2"/>
                </svg>
              </button>
            )}
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
              {prediction && (
                <div style={{ marginTop: 5 }}>
                  <span style={{ fontSize: 10, color: theme.muted }}>{prediction.label}</span>
                </div>
              )}
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
