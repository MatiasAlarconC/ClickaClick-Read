import React, { Suspense, useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Stars, ProgressBar, BackButton, Spinner, ErrorBoundary } from '../components/UI'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { getProgressiveSummary } from '../services/gemini'
import type { SearchResult, UserBook, BookNote } from '../types'

const Book3D = React.lazy(() => import('../components/Book3D'))

type DetailTab = 'overview' | 'details' | 'notes'

export default function BookDetailScreen() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const book: SearchResult | null = state?.book ?? null

  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [rating, setRating] = useState(0)
  const [userBook, setUserBook] = useState<UserBook | null>(null)
  const [notes, setNotes] = useState<BookNote[]>([])
  const [newNote, setNewNote] = useState('')
  const [newNotePage, setNewNotePage] = useState('')
  const [addingToLib, setAddingToLib] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(false)
  const [customPages, setCustomPages] = useState<string>('')

  useEffect(() => {
    if (!user || !book) return

    // Check if book is in user's library
    supabase.from('user_books').select('*').eq('user_id', user.id)
      .or(`book_id.eq.${book.id}`)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setUserBook(data as UserBook)
          setRating(data.user_rating ?? 0)
          setCustomPages(String(data.custom_pages ?? book.pages ?? ''))
        }
      })

    // Load notes
    supabase.from('book_notes').select('*').eq('user_id', user.id).order('page_number', { ascending: true })
      .then(({ data }) => { if (data) setNotes(data as BookNote[]) })
  }, [user, book])

  const ensureBookInDb = async (): Promise<string | null> => {
    if (!book || !user) return null
    // Upsert book to books table
    const bookData = {
      id: book.id,
      google_books_id: book.google_books_id ?? null,
      open_library_id: book.open_library_id ?? null,
      title: book.title,
      author: book.author,
      cover_url: book.cover_url,
      synopsis: book.synopsis,
      pages_default: book.pages,
      genres: book.genres,
      published_year: book.published_year,
      isbn: book.isbn,
    }
    const { error } = await supabase.from('books').upsert(bookData, { onConflict: 'id' })
    if (error) return null
    return book.id
  }

  const addToLibrary = async (status: 'reading' | 'finished' | 'want_to_read') => {
    if (!user || !book) return
    setAddingToLib(true)
    const bookId = await ensureBookInDb()
    if (!bookId) { setAddingToLib(false); return }

    const { data } = await supabase.from('user_books').upsert({
      user_id: user.id, book_id: bookId, status,
      added_at: new Date().toISOString(),
      custom_pages: customPages ? parseInt(customPages) : null,
      started_at: status === 'reading' ? new Date().toISOString() : null,
      finished_at: status === 'finished' ? new Date().toISOString() : null,
    }, { onConflict: 'user_id,book_id' }).select().single()

    if (data) setUserBook(data as UserBook)
    setAddingToLib(false)
  }

  const saveRating = async (r: number) => {
    setRating(r)
    if (!user || !userBook) return
    await supabase.from('user_books').update({ user_rating: r }).eq('id', userBook.id)
  }

  const addNote = async () => {
    if (!user || !book || !newNote.trim()) return
    const bookId = await ensureBookInDb()
    if (!bookId) return

    const { data } = await supabase.from('book_notes').insert({
      user_id: user.id, book_id: bookId,
      page_number: newNotePage ? parseInt(newNotePage) : null,
      content: newNote.trim(),
    }).select().single()

    if (data) {
      setNotes(prev => [...prev, data as BookNote])
      setNewNote(''); setNewNotePage('')
    }
  }

  const fetchAiSummary = async () => {
    if (!book || !user) return
    setAiLoading(true); setAiError(false)
    const result = await getProgressiveSummary({
      title: book.title, author: book.author,
      synopsis: book.synopsis,
      currentPage: parseInt(customPages) || Math.floor((book.pages ?? 200) / 2),
      totalPages: book.pages ?? 200,
      userId: user.id,
    })
    setAiLoading(false)
    if (result) setAiSummary(result)
    else setAiError(true)
  }

  if (!book) {
    return (
      <div style={{ minHeight: '100%', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
          <div style={{ color: theme.muted, fontSize: 14 }}>No book selected</div>
          <button onClick={() => navigate('/search')} style={{ marginTop: 16, padding: '10px 20px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 14 }}>Search Books</button>
        </div>
      </div>
    )
  }

  const statusLabel = userBook ? {
    reading: '📖 Reading', finished: '✅ Finished', want_to_read: '🔖 Want to Read'
  }[userBook.status] : null

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ minHeight: '100%', background: theme.bg, position: 'relative' }}>
      {/* Back */}
      <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: 16, left: 16, zIndex: 20, width: 36, height: 36, borderRadius: '50%', background: theme.bgElevated, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke={theme.fg} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>

      {/* 3D cover hero */}
      <div style={{ background: theme.bgSecondary, paddingTop: 56, paddingBottom: 16 }}>
        <ErrorBoundary fallback={null}>
          <Suspense fallback={<div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner color={theme.muted} /></div>}>
            <Book3D coverUrl={book.cover_url} theme={theme} />
          </Suspense>
        </ErrorBoundary>
      </div>

      {/* Meta */}
      <div style={{ padding: '22px 22px 0' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 400, color: theme.fg, lineHeight: 1.2, letterSpacing: -0.5, marginBottom: 4 }}>{book.title}</div>
        <div style={{ fontSize: 14, color: theme.muted, marginBottom: 14 }}>{book.author}{book.published_year ? ` · ${book.published_year}` : ''}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Stars filled={rating} count={5} size={20} color={theme.fg} onClick={saveRating} />
          {rating > 0 && <span style={{ fontSize: 12, color: theme.muted }}>{rating} / 5</span>}
        </div>

        {/* Library status / add buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
          {statusLabel ? (
            <div style={{ padding: '8px 14px', background: theme.bgSecondary, borderRadius: 10, fontSize: 13, color: theme.fg, fontWeight: 500 }}>{statusLabel}</div>
          ) : null}
          {!userBook || userBook.status !== 'reading' ? (
            <button onClick={() => addToLibrary('reading')} disabled={addingToLib} style={{ padding: '8px 14px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500 }}>
              {addingToLib ? '…' : '📖 Start Reading'}
            </button>
          ) : null}
          {!userBook || userBook.status !== 'want_to_read' ? (
            <button onClick={() => addToLibrary('want_to_read')} disabled={addingToLib} style={{ padding: '8px 14px', background: theme.bgSecondary, color: theme.fg, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 13 }}>
              🔖 Want to Read
            </button>
          ) : null}
          {userBook?.status === 'reading' ? (
            <button onClick={() => navigate('/session', { state: { book: userBook } })} style={{ padding: '8px 14px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500 }}>
              ▶ Start Session
            </button>
          ) : null}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${theme.border}`, marginBottom: 22 }}>
          {(['overview','details','notes'] as DetailTab[]).map(tab => {
            const isActive = tab === activeTab
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '10px 0', background: 'none', border: 'none', borderBottom: isActive ? `2px solid ${theme.fg}` : '2px solid transparent', marginBottom: -1, fontSize: 13.5, color: isActive ? theme.fg : theme.muted, fontWeight: isActive ? 600 : 400, textTransform: 'capitalize' }}>{tab}</button>
            )
          })}
        </div>

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div style={{ paddingBottom: 40 }}>
            {book.synopsis && (
              <p style={{ fontSize: 14, color: theme.fgDim, lineHeight: 1.75, marginBottom: 22 }}>{book.synopsis}</p>
            )}

            {book.genres.length > 0 && (
              <>
                <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 12 }}>Genres</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
                  {book.genres.map(tag => (
                    <span key={tag} style={{ padding: '6px 13px', borderRadius: 999, background: theme.bgSecondary, border: `1px solid ${theme.border}`, fontSize: 12.5, color: theme.fgDim }}>{tag}</span>
                  ))}
                </div>
              </>
            )}

            {/* AI Summary */}
            <div style={{ marginTop: 8 }}>
              <button onClick={fetchAiSummary} disabled={aiLoading} style={{ padding: '10px 18px', background: theme.bgSecondary, border: `1px solid ${theme.border}`, borderRadius: 12, fontSize: 13, color: theme.fg, display: 'flex', alignItems: 'center', gap: 8 }}>
                {aiLoading ? <><Spinner color={theme.muted} />Loading…</> : '✨ Refresh my memory'}
              </button>
              {aiSummary && (
                <div style={{ marginTop: 12, padding: '14px 16px', background: theme.bgSecondary, borderRadius: 12, fontSize: 14, color: theme.fgDim, lineHeight: 1.7 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 8 }}>AI Summary</div>
                  {aiSummary}
                </div>
              )}
              {aiError && (
                <div style={{ marginTop: 12, padding: '12px 16px', background: theme.bgSecondary, borderRadius: 12, fontSize: 13, color: theme.muted }}>AI summary unavailable</div>
              )}
            </div>
          </div>
        )}

        {/* Details tab */}
        {activeTab === 'details' && (
          <div style={{ paddingBottom: 40 }}>
            {[
              { label: 'Pages', value: book.pages?.toString() ?? '—', editable: true },
              { label: 'Language', value: 'English', editable: true },
              { label: 'Published', value: book.published_year?.toString() ?? '—' },
              { label: 'ISBN', value: book.isbn ?? '—' },
              { label: 'Source', value: book.source === 'google' ? 'Google Books' : 'Open Library' },
            ].map((row, i, arr) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: i < arr.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
                <span style={{ fontSize: 14, color: theme.muted }}>{row.label}</span>
                {row.editable && row.label === 'Pages' ? (
                  <input value={customPages} onChange={e => setCustomPages(e.target.value)} style={{ textAlign: 'right', background: 'none', border: 'none', fontSize: 14, color: theme.fg, fontWeight: 500, width: 80 }} placeholder={row.value} />
                ) : (
                  <span style={{ fontSize: 14, color: theme.fg, fontWeight: 500 }}>{row.value}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Notes tab */}
        {activeTab === 'notes' && (
          <div style={{ paddingBottom: 40 }}>
            {/* Add note */}
            <div style={{ background: theme.bgSecondary, borderRadius: 14, padding: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input value={newNotePage} onChange={e => setNewNotePage(e.target.value)} placeholder="Page #" type="number" style={{ width: 72, padding: '8px 10px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 14, color: theme.fg }} />
              </div>
              <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Write a note…" rows={3} style={{ width: '100%', padding: '10px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 14, color: theme.fg, resize: 'none' }} />
              <button onClick={addNote} disabled={!newNote.trim()} style={{ marginTop: 10, padding: '10px 20px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, opacity: newNote.trim() ? 1 : 0.5 }}>Add Note</button>
            </div>

            {notes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: theme.muted, fontSize: 14 }}>No notes yet</div>
            ) : (
              notes.map(note => (
                <div key={note.id} style={{ padding: '14px 0', borderBottom: `1px solid ${theme.border}` }}>
                  {note.page_number && <div style={{ fontSize: 11, color: theme.muted, marginBottom: 4 }}>Page {note.page_number}</div>}
                  <div style={{ fontSize: 14, color: theme.fg, lineHeight: 1.6 }}>{note.content}</div>
                  <div style={{ fontSize: 11, color: theme.muted, marginTop: 6 }}>{new Date(note.created_at).toLocaleDateString()}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
