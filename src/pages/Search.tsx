import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BookCover, TabBar, Stars, Spinner } from '../components/UI'
import { useTheme } from '../context/AppContext'
import { searchBooks } from '../services/books'
import type { SearchResult } from '../types'

const GENRES = ['All', 'Fiction', 'Non-Fiction', 'Science', 'History', 'Philosophy', 'Biography', 'Fantasy', 'Mystery']

export default function SearchScreen() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState('All')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return }
    setLoading(true); setSearched(true)
    try {
      const data = await searchBooks(q)
      setResults(data)
    } catch {
      setResults([])
    }
    setLoading(false)
  }, [])

  const handleQueryChange = (val: string) => {
    setQuery(val)
    if (!val) { setResults([]); setSearched(false) }
  }

  const filtered = results.filter(b => {
    if (genre === 'All') return true
    return b.genres.some(g => g.toLowerCase().includes(genre.toLowerCase()))
  })

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <div style={{ flex: 1, padding: '64px 22px 0' }}>

        <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 400, color: theme.fg, letterSpacing: -1, marginBottom: 18 }}>Discover</div>

        {/* Search bar */}
        <div style={{ background: theme.bgSecondary, borderRadius: 14, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
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
            <button onClick={() => { setQuery(''); setResults([]); setSearched(false) }} style={{ background: 'none', border: 'none', color: theme.muted, fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
          )}
        </div>

        {/* Search button */}
        {query && !loading && (
          <button onClick={() => handleSearch(query)} style={{ width: '100%', padding: '11px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500, marginBottom: 14 }}>
            Search
          </button>
        )}

        {/* Genre pills */}
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', marginBottom: 20, WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
          {GENRES.map(g => (
            <button key={g} onClick={() => setGenre(g)} style={{ padding: '7px 14px', borderRadius: 999, flexShrink: 0, background: g === genre ? theme.accent : theme.bgSecondary, color: g === genre ? theme.accentFg : theme.muted, border: 'none', whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: 500 }}>
              {g}
            </button>
          ))}
        </div>

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
              <BookCover index={i} width={50} height={76} coverUrl={book.cover_url} />
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
              <div style={{ fontSize: 13, marginTop: 6 }}>Try a different search term</div>
            </div>
          )}

          {!searched && (
            <div style={{ textAlign: 'center', padding: '60px 0 24px', color: theme.muted }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📖</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, marginBottom: 6, color: theme.fg }}>Find your next read</div>
              <div style={{ fontSize: 14 }}>Search by title, author, or genre</div>
            </div>
          )}
        </div>
      </div>

      <TabBar activeTab="search" onTabChange={t => navigate(`/${t === 'home' ? 'home' : t}`)} theme={theme} />
    </div>
  )
}
