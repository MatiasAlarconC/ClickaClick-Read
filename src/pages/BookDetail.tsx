import React, { Suspense, useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Stars, ProgressBar, BackButton, Spinner, ErrorBoundary } from '../components/UI'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { getProgressiveSummary } from '../services/gemini'
import type { SearchResult, UserBook, BookNote, ReadingSession } from '../types'

const Book3D = React.lazy(() => import('../components/Book3D'))

type DetailTab = 'overview' | 'details' | 'notes' | 'sessions'

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
  const [sessions, setSessions] = useState<ReadingSession[]>([])
  const [newNote, setNewNote] = useState('')
  const [newNotePage, setNewNotePage] = useState('')
  const [addingToLib, setAddingToLib] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(false)
  const [customPages, setCustomPages] = useState<string>('')
  const [pagesSaved, setPagesSaved] = useState(false)
  const [bookDbId, setBookDbId] = useState<string | null>(null)
  // synopsis may come from nav state OR the DB books record — prefer DB
  const [synopsis, setSynopsis] = useState<string | null>(book?.synopsis ?? null)

  useEffect(() => {
    if (!user || !book) return

    const externalId = book.google_books_id ?? book.id

    // First find the book's UUID in the DB, then load user data
    supabase.from('books').select('id, synopsis')
      .eq('google_books_id', externalId)
      .maybeSingle()
      .then(({ data: bookRow }) => {
        // Update synopsis from DB book record if available
        if (bookRow?.synopsis) setSynopsis(bookRow.synopsis)

        if (!bookRow) return
        const dbId = bookRow.id
        setBookDbId(dbId)

        // Check if book is in user's library (with book join so Session gets cover/title)
        supabase.from('user_books').select('*, book:books(*)')
          .eq('user_id', user.id)
          .eq('book_id', dbId)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setUserBook(data as UserBook)
              setRating(data.user_rating ?? 0)
              setCustomPages(String(data.custom_pages ?? book.pages ?? ''))
              // Update synopsis from DB if the nav state didn't have one
              if (!synopsis && data.book?.synopsis) setSynopsis(data.book.synopsis)
            }
          })

        // Load notes for this specific book
        supabase.from('book_notes').select('*')
          .eq('user_id', user.id)
          .eq('book_id', dbId)
          .order('page_number', { ascending: true })
          .then(({ data }) => { if (data) setNotes(data as BookNote[]) })

        // Load reading sessions for this book
        supabase.from('reading_sessions').select('*')
          .eq('user_id', user.id)
          .eq('book_id', dbId)
          .order('started_at', { ascending: false })
          .then(({ data }) => { if (data) setSessions(data as ReadingSession[]) })
      })

    // Fetch synopsis from Google Books if not already available
    const googleId = book.google_books_id ?? book.id
    if (!book.synopsis && googleId && !googleId.startsWith('OL')) {
      fetch(`https://www.googleapis.com/books/v1/volumes/${googleId}`)
        .then(r => r.json())
        .then(data => {
          const desc = data.volumeInfo?.description
          if (desc) setSynopsis(desc)
        })
        .catch(() => { /* ignore — synopsis just stays null */ })
    }
  }, [user, book])

  const ensureBookInDb = async (): Promise<string | null> => {
    if (!book || !user) return null

    // Return cached UUID if we already looked it up
    if (bookDbId) return bookDbId

    const externalId = book.google_books_id ?? book.id

    // Check if the book already exists in DB
    const { data: existing } = await supabase.from('books').select('id')
      .eq('google_books_id', externalId)
      .maybeSingle()

    if (existing) {
      setBookDbId(existing.id)
      return existing.id
    }

    // Insert new book record; DB auto-generates the UUID
    const { data, error } = await supabase.from('books').insert({
      google_books_id: externalId,
      open_library_id: book.open_library_id ?? null,
      title: book.title,
      author: book.author,
      synopsis: book.synopsis ?? null,
      cover_url: book.cover_url ?? null,
      pages_default: book.pages ?? null,
      genres: book.genres ?? [],
      published_year: book.published_year ?? null,
      isbn: book.isbn ?? null,
    }).select('id').single()

    if (error) {
      // Race condition: another request may have inserted it first
      const { data: retry } = await supabase.from('books').select('id')
        .eq('google_books_id', externalId)
        .maybeSingle()
      if (retry) { setBookDbId(retry.id); return retry.id }
      return null
    }

    setBookDbId(data.id)
    return data.id
  }

  const addToLibrary = async (status: 'reading' | 'finished' | 'want_to_read') => {
    if (!user || !book) return
    setAddingToLib(true)
    const bookId = await ensureBookInDb()
    if (!bookId) { setAddingToLib(false); return }

    await supabase.from('user_books').upsert({
      user_id: user.id, book_id: bookId, status,
      added_at: new Date().toISOString(),
      custom_pages: customPages ? parseInt(customPages) : null,
      started_at: status === 'reading' ? new Date().toISOString() : null,
      finished_at: status === 'finished' ? new Date().toISOString() : null,
    }, { onConflict: 'user_id,book_id' })

    // Refetch with book join so Session screen gets cover/title
    const { data: fresh } = await supabase.from('user_books').select('*, book:books(*)')
      .eq('user_id', user.id).eq('book_id', bookId).maybeSingle()
    if (fresh) setUserBook(fresh as UserBook)
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

  const saveCustomPages = async () => {
    if (!userBook) return
    const pages = customPages ? parseInt(customPages) : null
    await supabase.from('user_books').update({ custom_pages: pages }).eq('id', userBook.id)
    setPagesSaved(true)
    setTimeout(() => setPagesSaved(false), 2000)
  }

  const fetchAiSummary = async () => {
    if (!book || !user) return
    setAiLoading(true); setAiError(false)
    // Use the user's actual current reading position
    const currentPage = userBook?.current_page ?? (parseInt(customPages) || Math.floor((book.pages ?? 200) / 2))
    const result = await getProgressiveSummary({
      title: book.title, author: book.author,
      synopsis: synopsis,
      currentPage,
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
          {/* Only show add-to-library buttons when book is NOT already in library */}
          {!userBook && (
            <>
              <button onClick={() => addToLibrary('reading')} disabled={addingToLib} style={{ padding: '8px 14px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500 }}>
                {addingToLib ? '…' : '📖 Start Reading'}
              </button>
              <button onClick={() => addToLibrary('want_to_read')} disabled={addingToLib} style={{ padding: '8px 14px', background: theme.bgSecondary, color: theme.fg, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 13 }}>
                🔖 Want to Read
              </button>
            </>
          )}
          {/* Book is in library — show contextual actions */}
          {userBook?.status === 'reading' && (
            <button onClick={() => navigate('/session', { state: { book: userBook } })} style={{ padding: '8px 14px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500 }}>
              ▶ Start Session
            </button>
          )}
          {userBook?.status === 'want_to_read' && (
            <button onClick={() => addToLibrary('reading')} disabled={addingToLib} style={{ padding: '8px 14px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500 }}>
              {addingToLib ? '…' : '📖 Start Reading'}
            </button>
          )}
          {userBook?.status === 'reading' && (
            <button onClick={() => addToLibrary('finished')} disabled={addingToLib} style={{ padding: '8px 14px', background: theme.bgSecondary, color: theme.fg, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 13 }}>
              {addingToLib ? '…' : '✅ Mark Finished'}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${theme.border}`, marginBottom: 22 }}>
          {(['overview','details','notes','sessions'] as DetailTab[]).map(tab => {
            const isActive = tab === activeTab
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '10px 0', background: 'none', border: 'none', borderBottom: isActive ? `2px solid ${theme.fg}` : '2px solid transparent', marginBottom: -1, fontSize: 13.5, color: isActive ? theme.fg : theme.muted, fontWeight: isActive ? 600 : 400, textTransform: 'capitalize' }}>{tab}</button>
            )
          })}
        </div>

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div style={{ paddingBottom: 40 }}>
            {synopsis ? (
              <p style={{ fontSize: 14, color: theme.fgDim, lineHeight: 1.75, marginBottom: 22 }}>{synopsis}</p>
            ) : (
              <p style={{ fontSize: 14, color: theme.muted, lineHeight: 1.75, marginBottom: 22, fontStyle: 'italic' }}>No description available for this book.</p>
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
                <div style={{ marginTop: 12, padding: '12px 16px', background: theme.bgSecondary, borderRadius: 12, fontSize: 13, color: theme.muted, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span>AI summary unavailable — the service may be temporarily down.</span>
                  <button onClick={fetchAiSummary} style={{ padding: '6px 14px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 12, color: theme.fg, cursor: 'pointer', flexShrink: 0 }}>Retry</button>
                </div>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input value={customPages} onChange={e => { setCustomPages(e.target.value); setPagesSaved(false) }} onBlur={saveCustomPages} style={{ textAlign: 'right', background: 'none', border: 'none', fontSize: 14, color: theme.fg, fontWeight: 500, width: 80 }} placeholder={row.value} />
                    {pagesSaved && <span style={{ fontSize: 11, color: '#22C55E' }}>✓ Saved</span>}
                  </div>
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

        {/* Sessions tab */}
        {activeTab === 'sessions' && (
          <div style={{ paddingBottom: 40 }}>
            {sessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: theme.muted, fontSize: 14 }}>No reading sessions yet</div>
            ) : (
              <>
                {/* Summary row */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                  {[
                    { label: 'Sessions', value: sessions.filter(s => !s.is_manual).length },
                    { label: 'Total pages', value: sessions.reduce((sum, s) => sum + (s.pages_read ?? 0), 0) },
                    { label: 'Hours read', value: (sessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0) / 3600).toFixed(1) },
                  ].map(stat => (
                    <div key={stat.label} style={{ flex: 1, padding: '12px 10px', background: theme.bgSecondary, borderRadius: 12, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 600, color: theme.fg }}>{stat.value}</div>
                      <div style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Session list */}
                {sessions.map((s, i) => {
                  const date = new Date(s.started_at)
                  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                  const dur = s.duration_seconds
                    ? `${Math.floor(s.duration_seconds / 60)}m`
                    : null
                  const isManual = s.is_manual
                  return (
                    <div key={s.id} style={{ padding: '14px 0', borderBottom: i < sessions.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: theme.fg }}>{dateStr}</div>
                          <div style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>{isManual ? 'Manual update' : timeStr}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {(s.pages_read ?? 0) > 0 && (
                            <div style={{ fontSize: 14, fontWeight: 500, color: theme.fg }}>+{s.pages_read} pages</div>
                          )}
                          {dur && <div style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>{dur}</div>}
                          {s.start_page != null && s.end_page != null && (
                            <div style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>p.{s.start_page}–{s.end_page}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
