import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { BookCover, TabBar, Stars, Spinner } from '../components/UI'
import { useTheme } from '../context/AppContext'
import { searchBooks } from '../services/books'
import type { SearchResult } from '../types'

const GENRES = ['All', 'Fiction', 'Non-Fiction', 'Science', 'History', 'Philosophy', 'Biography', 'Fantasy', 'Mystery', 'Thriller', 'Romance', 'Horror']

const SS_KEY = 'clickaclick_search_state'

interface SavedSearch {
  query: string; genre: string; results: SearchResult[]
  authorFilter: string; yearFrom: string; yearTo: string
}

export default function SearchScreen() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  // Restore state from sessionStorage on mount
  const saved: SavedSearch | null = (() => {
    try { return JSON.parse(sessionStorage.getItem(SS_KEY) ?? 'null') } catch { return null }
  })()

  const [query, setQuery] = useState(saved?.query ?? '')
  const [genre, setGenre] = useState(saved?.genre ?? 'All')
  const [results, setResults] = useState<SearchResult[]>(saved?.results ?? [])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState((saved?.results?.length ?? 0) > 0 || (saved?.query ?? '').length > 0)

  // Advanced filter state
  const [showFilters, setShowFilters] = useState(false)
  const [authorFilter, setAuthorFilter] = useState(saved?.authorFilter ?? '')
  const [yearFrom, setYearFrom] = useState(saved?.yearFrom ?? '')
  const [yearTo, setYearTo] = useState(saved?.yearTo ?? '')

  // Manual book entry state
  const [showManual, setShowManual] = useState(false)
  const [manualTitle, setManualTitle] = useState('')
  const [manualAuthor, setManualAuthor] = useState('')
  const [manualPages, setManualPages] = useState('')
  const [manualCover, setManualCover] = useState('')
  const [manualYear, setManualYear] = useState('')

  const persistState = useCallback((q: string, g: string, r: SearchResult[], af: string, yf: string, yt: string) => {
    sessionStorage.setItem(SS_KEY, JSON.stringify({ query: q, genre: g, results: r, authorFilter: af, yearFrom: yf, yearTo: yt }))
  }, [])

  const handleSearch = useCallback(async (q: string, af?: string, g?: string) => {
    const effectiveGenre = g ?? genre
    const effectiveQuery = q.trim() || (effectiveGenre !== 'All' ? effectiveGenre : '')
    if (!effectiveQuery) { setResults([]); setSearched(false); return }
    setLoading(true); setSearched(true)
    try {
      const authorTerm = (af ?? authorFilter).trim()
      const fullQuery = authorTerm ? `${effectiveQuery} inauthor:${authorTerm}` : effectiveQuery
      const data = await searchBooks(fullQuery)
      setResults(data)
      persistState(q, effectiveGenre, data, af ?? authorFilter, yearFrom, yearTo)
    } catch {
      setResults([])
    }
    setLoading(false)
  }, [genre, authorFilter, yearFrom, yearTo, persistState])

  const handleQueryChange = (val: string) => {
    setQuery(val)
    if (!val) { setResults([]); setSearched(false); sessionStorage.removeItem(SS_KEY) }
  }

  const handleManualSubmit = () => {
    if (!manualTitle.trim()) return
    const book: SearchResult = {
      id: `manual-${Date.now()}`,
      google_books_id: `manual-${Date.now()}`,
      title: manualTitle.trim(),
      author: manualAuthor.trim() || 'Unknown Author',
      cover_url: manualCover.trim() || null,
      synopsis: null,
      pages: manualPages ? parseInt(manualPages) : null,
      genres: [],
      published_year: manualYear ? parseInt(manualYear) : null,
      isbn: null,
      source: 'manual',
    }
    setShowManual(false)
    setManualTitle(''); setManualAuthor(''); setManualPages(''); setManualCover(''); setManualYear('')
    navigate('/detail', { state: { book } })
  }

  const activeFilterCount = [authorFilter, yearFrom, yearTo].filter(Boolean).length + (genre !== 'All' ? 1 : 0)

  const filtered = results.filter(b => {
    if (genre !== 'All' && !b.genres.some(g => g.toLowerCase().includes(genre.toLowerCase()))) return false
    if (yearFrom && b.published_year && b.published_year < parseInt(yearFrom)) return false
    if (yearTo && b.published_year && b.published_year > parseInt(yearTo)) return false
    return true
  })

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: theme.bg, paddingBottom: 'calc(68px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ flex: 1, padding: '64px 22px 0' }}>

        <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 400, color: theme.fg, letterSpacing: -1, marginBottom: 18 }}>Discover</div>

        {/* Search bar */}
        <div style={{ background: theme.bgSecondary, borderRadius: 14, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="6.5" cy="6.5" r="5" stroke={theme.muted} strokeWidth="1.4"/>
            <line x1="10.5" y1="10.5" x2="14" y2="14" stroke={theme.muted} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input value={query} onChange={e => handleQueryChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch(query)}
            placeholder="Search titles, authors..."
            style={{ flex: 1, background: 'none', border: 'none', fontSize: 15, color: theme.fg }}/>
          {loading && <Spinner color={theme.muted} />}
          {!loading && query && (
            <button onClick={() => { setQuery(''); setResults([]); setSearched(false); sessionStorage.removeItem(SS_KEY) }} style={{ background: 'none', border: 'none', color: theme.muted, fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
          )}
          {/* Filter toggle */}
          <button onClick={() => setShowFilters(f => !f)} style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M3 5H21M6 12H18M10 19H14" stroke={showFilters || activeFilterCount > 0 ? theme.accent : theme.muted} strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {activeFilterCount > 0 && (
              <span style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: theme.accent, color: theme.accentFg, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilterCount}</span>
            )}
          </button>
        </div>

        {/* Advanced filters panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ background: theme.bgSecondary, borderRadius: 12, padding: '14px 14px 10px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 12 }}>Filters</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Genre */}
                  <div>
                    <div style={{ fontSize: 11, color: theme.muted, marginBottom: 7 }}>Genre</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {GENRES.map(g => (
                        <button key={g} onClick={() => setGenre(g)} style={{ padding: '6px 12px', borderRadius: 999, background: g === genre ? theme.accent : theme.bg, color: g === genre ? theme.accentFg : theme.muted, border: `1px solid ${g === genre ? theme.accent : theme.border}`, whiteSpace: 'nowrap', fontSize: 12, fontWeight: 500 }}>{g}</button>
                      ))}
                    </div>
                  </div>
                  {/* Author */}
                  <div>
                    <div style={{ fontSize: 11, color: theme.muted, marginBottom: 5 }}>Author</div>
                    <input value={authorFilter} onChange={e => setAuthorFilter(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearch(query)}
                      placeholder="e.g. Jules Verne"
                      style={{ width: '100%', padding: '8px 11px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 14, color: theme.fg, boxSizing: 'border-box' }}/>
                  </div>
                  {/* Year range */}
                  <div>
                    <div style={{ fontSize: 11, color: theme.muted, marginBottom: 5 }}>Published year</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input value={yearFrom} onChange={e => setYearFrom(e.target.value)} placeholder="From" type="number" min="1000" max="2030"
                        style={{ flex: 1, padding: '8px 11px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 14, color: theme.fg }}/>
                      <span style={{ color: theme.muted, fontSize: 12 }}>–</span>
                      <input value={yearTo} onChange={e => setYearTo(e.target.value)} placeholder="To" type="number" min="1000" max="2030"
                        style={{ flex: 1, padding: '8px 11px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 14, color: theme.fg }}/>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setShowFilters(false); handleSearch(query) }} style={{ flex: 1, padding: '9px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Apply</button>
                    <button onClick={() => { setAuthorFilter(''); setYearFrom(''); setYearTo(''); setGenre('All') }} style={{ padding: '9px 14px', background: theme.bg, color: theme.muted, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13 }}>Clear</button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search button */}
        {query && !loading && (
          <button onClick={() => handleSearch(query)} style={{ width: '100%', padding: '11px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500, marginBottom: 14 }}>
            Search
          </button>
        )}

        {/* Genre pills — removed from here, now inside filter panel */}

        {/* Result count */}
        {searched && !loading && (
          <div style={{ fontSize: 12, color: theme.muted, marginBottom: 4 }}>
            {filtered.length} {filtered.length === 1 ? 'book' : 'books'}
          </div>
        )}

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 24 }}>
          {filtered.map((book, i) => (
            <motion.button key={book.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => navigate('/detail', { state: { book } })}
              style={{ display: 'flex', gap: 14, padding: '13px 0', background: 'none', border: 'none', textAlign: 'left', borderBottom: i < filtered.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
              <BookCover index={i} width={50} height={76} coverUrl={book.cover_url} title={book.title} author={book.author} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5 }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 15.5, color: theme.fg, lineHeight: 1.3 }}>{book.title}</div>
                <div style={{ fontSize: 12, color: theme.muted }}>{book.author}{book.published_year ? ` · ${book.published_year}` : ''}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Stars filled={0} count={5} size={11} color={theme.muted} />
                  {book.genres[0] && (
                    <span style={{ fontSize: 10.5, color: theme.muted, background: theme.bgSecondary, padding: '2px 7px', borderRadius: 999 }}>{book.genres[0]}</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <svg width="6" height="11" viewBox="0 0 6 11" fill="none"><path d="M1 1L5 5.5L1 10" stroke={theme.muted} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </motion.button>
          ))}

          {!loading && searched && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: theme.muted }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 18 }}>No results found</div>
              <div style={{ fontSize: 13, marginTop: 6, marginBottom: 20 }}>Try a different search term</div>
              <button onClick={() => setShowManual(true)} style={{ padding: '11px 22px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500 }}>
                + Add book manually
              </button>
            </div>
          )}

          {!searched && (
            <div style={{ textAlign: 'center', padding: '60px 0 24px', color: theme.muted }}>
              <div style={{ marginBottom: 12 }}><svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, marginBottom: 6, color: theme.fg }}>Find your next read</div>
              <div style={{ fontSize: 14 }}>Search by title, author, or genre</div>
              <button onClick={() => setShowManual(true)} style={{ marginTop: 24, padding: '11px 22px', background: theme.bgSecondary, color: theme.fg, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 14, fontWeight: 500 }}>
                + Add book manually
              </button>
            </div>
          )}
        </div>
      </div>

      <TabBar activeTab="search" onTabChange={t => navigate(`/${t === 'home' ? 'home' : t}`)} theme={theme} />

      {/* Manual book entry modal */}
      {showManual && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) setShowManual(false) }}>
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ width: '100%', background: theme.bg, borderRadius: '20px 20px 0 0', padding: '24px 22px', paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: theme.fg }}>Add a book</div>
              <button onClick={() => setShowManual(false)} style={{ background: 'none', border: 'none', color: theme.muted, fontSize: 24, padding: 0, lineHeight: 1 }}>×</button>
            </div>

            {[
              { label: 'Title *', value: manualTitle, setter: setManualTitle, placeholder: 'Book title', type: 'text' },
              { label: 'Author', value: manualAuthor, setter: setManualAuthor, placeholder: 'Author name', type: 'text' },
              { label: 'Pages', value: manualPages, setter: setManualPages, placeholder: 'Number of pages', type: 'number' },
              { label: 'Published Year', value: manualYear, setter: setManualYear, placeholder: 'e.g. 2023', type: 'number' },
              { label: 'Cover URL', value: manualCover, setter: setManualCover, placeholder: 'https://...', type: 'url' },
            ].map(field => (
              <div key={field.label} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: theme.muted, marginBottom: 5, fontWeight: 500 }}>{field.label}</div>
                <input
                  value={field.value}
                  onChange={e => field.setter(e.target.value)}
                  placeholder={field.placeholder}
                  type={field.type}
                  style={{ width: '100%', padding: '11px 14px', background: theme.bgSecondary, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 15, color: theme.fg, boxSizing: 'border-box' }}
                />
              </div>
            ))}

            <button
              onClick={handleManualSubmit}
              disabled={!manualTitle.trim()}
              style={{ width: '100%', padding: 14, background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 500, marginTop: 6, opacity: manualTitle.trim() ? 1 : 0.5 }}>
              Add Book
            </button>
          </motion.div>
        </div>
      )}
    </div>
  )
}
