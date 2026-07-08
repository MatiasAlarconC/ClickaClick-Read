import React, { Suspense, useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Stars, ProgressBar, BackButton, Spinner, ErrorBoundary } from '../components/UI'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { summarizeNotes, detectBookSeries } from '../services/gemini'
import type { SeriesInfo } from '../services/gemini'
import { searchBooks } from '../services/books'
import type { SearchResult, UserBook, BookNote, ReadingSession } from '../types'
import SpineCaptureCamera from '../components/SpineCaptureCamera'

function computeFinishPrediction(
  sessions: ReadingSession[],
  currentPage: number,
  totalPages: number,
): { finishDate: Date; pagesPerDay: number } | null {
  const remaining = totalPages - currentPage
  if (remaining <= 0 || !totalPages) return null
  const cutoff = Date.now() - 90 * 24 * 3600 * 1000
  const recent = sessions.filter(
    s => !s.is_manual && (s.pages_read ?? 0) > 0 && new Date(s.started_at).getTime() > cutoff
  )
  if (recent.length === 0) return null
  const byDay: Record<string, number> = {}
  for (const s of recent) {
    // Use UTC date string (same as Library.tsx) so both predictions stay in sync
    const day = s.started_at.slice(0, 10)
    byDay[day] = (byDay[day] ?? 0) + (s.pages_read ?? 0)
  }
  const daysActive = Object.keys(byDay).length
  const totalPagesInSessions = Object.values(byDay).reduce((a, b) => a + b, 0)
  const pagesPerDay = totalPagesInSessions / daysActive
  if (pagesPerDay <= 0) return null
  const daysToFinish = Math.ceil(remaining / pagesPerDay)
  const finishDate = new Date()
  finishDate.setDate(finishDate.getDate() + daysToFinish)
  return { finishDate, pagesPerDay: Math.round(pagesPerDay * 10) / 10 }
}

/** Strip HTML tags from Google Books / Open Library descriptions */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n').trim()
}

const Book3D = React.lazy(() => import('../components/Book3D'))

type DetailTab = 'overview' | 'details' | 'notes' | 'sessions'

// Loads and displays the summary for the previous book in a series from Supabase
function PrevSeriesSummary({ userId, prevTitle, position, theme }: {
  userId: string; prevTitle: string; position: number; theme: import('../types').Theme
}) {
  const [summary, setSummary] = useState<string | null>(null)
  useEffect(() => {
    supabase.from('books').select('id').ilike('title', prevTitle).maybeSingle()
      .then(({ data: b }) => {
        if (!b?.id) return
        supabase.from('user_books').select('note_summary')
          .eq('user_id', userId).eq('book_id', b.id).maybeSingle()
          .then(({ data: ub }) => { if (ub?.note_summary) setSummary(ub.note_summary as string) })
      })
  }, [userId, prevTitle])
  if (!summary) return null
  return (
    <div style={{ marginBottom: 20, padding: 14, background: theme.bgSecondary, borderRadius: 14, border: `1px solid ${theme.border}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 6 }}>
        Book {position - 1} recap · {prevTitle}
      </div>
      <div style={{ fontSize: 13, color: theme.fgDim, lineHeight: 1.7 }}>{summary}</div>
    </div>
  )
}

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
  const [notesSummary, setNotesSummary] = useState<string | null>(null)
  const [summaryPageRange, setSummaryPageRange] = useState<{ from: number | null; to: number | null } | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const [summaryError, setSummaryError] = useState(false)
  const [customPages, setCustomPages] = useState<string>('')
  const [pagesSaved, setPagesSaved] = useState(false)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editEndPage, setEditEndPage] = useState('')
  const [editingStartPageId, setEditingStartPageId] = useState<string | null>(null)
  const [editStartPage, setEditStartPage] = useState('')
  const [editingDurationId, setEditingDurationId] = useState<string | null>(null)
  const [editDurationMins, setEditDurationMins] = useState('')
  const [confirmDeleteSessionId, setConfirmDeleteSessionId] = useState<string | null>(null)
  const [bookDbId, setBookDbId] = useState<string | null>(null)
  const [epubUploading, setEpubUploading] = useState(false)
  const [epubPath, setEpubPath] = useState<string | null>(null)
  const [showModeModal, setShowModeModal] = useState(false)
  const [spineCapturing, setSpineCapturing] = useState(false)
  const [spineSaving, setSpineSaving] = useState(false)
  // synopsis may come from nav state OR the DB books record — prefer DB
  const [synopsis, setSynopsis] = useState<string | null>(book?.synopsis ?? null)
  const [seriesInfo, setSeriesInfo] = useState<SeriesInfo | null | undefined>(undefined)

  const SECKRY_BY_TITLE: Record<string, import('../services/gemini').SeriesInfo> = {
    'seckry sevenstars': { seriesName: 'Seckry Sevenstars', position: 1, totalBooks: 3, nextTitle: 'Seckry Sevenstars and the Trinity Awakening', nextAuthor: 'Joseph Evans' },
    'seckry sevenstars and the trinity awakening': { seriesName: 'Seckry Sevenstars', position: 2, totalBooks: 3, prevTitle: 'Seckry Sevenstars', nextTitle: 'Seckry Sevenstars and the Fate of the Fractured Part One', nextAuthor: 'Joseph Evans' },
    'seckry sevenstars and the fate of the fractured part one': { seriesName: 'Seckry Sevenstars', position: 3, totalBooks: 3, prevTitle: 'Seckry Sevenstars and the Trinity Awakening', nextTitle: '', nextAuthor: 'Joseph Evans' },
  }

  useEffect(() => {
    if (!user || !book) return

    const externalId = book.google_books_id ?? book.id

    const titleKey = book.title.toLowerCase().trim()

    // First find the book's UUID in the DB, then load user data
    supabase.from('books').select('id, synopsis, series_data')
      .eq('google_books_id', externalId)
      .maybeSingle()
      .then(({ data: bookRow }) => {
        // Update synopsis from DB book record if available
        if (bookRow?.synopsis) setSynopsis(bookRow.synopsis)

        if (!bookRow) {
          // Book not in DB yet — upsert it so series_data gets shared across all users
          supabase.from('books').upsert({
            google_books_id: externalId,
            title: book.title,
            author: book.author,
            cover_url: book.cover_url ?? null,
            synopsis: book.synopsis ?? null,
            pages_default: book.pages ?? null,
            genres: book.genres ?? [],
            published_year: book.published_year ?? null,
            isbn: book.isbn ?? null,
          }, { onConflict: 'google_books_id', ignoreDuplicates: false })
            .select('id')
            .maybeSingle()
            .then(({ data: newRow }) => {
              const newId = newRow?.id ?? null
              if (newId) setBookDbId(newId)
              if (!SECKRY_BY_TITLE[titleKey]) {
                detectBookSeries({ title: book.title, author: book.author, userId: user.id, bookId: newId })
                  .then(info => setSeriesInfo(info)).catch(() => setSeriesInfo(null))
              }
            })
          return
        }

        const dbId = bookRow.id
        setBookDbId(dbId)

        // Read series_data from DB (shared cache across all users)
        // null col = not yet detected; {} = detected standalone; { seriesName } = in a series
        const sd = bookRow.series_data as Record<string, unknown> | null | undefined
        if (SECKRY_BY_TITLE[titleKey]) {
          setSeriesInfo(SECKRY_BY_TITLE[titleKey])
        } else if (sd !== null && sd !== undefined) {
          setSeriesInfo(sd.seriesName ? (sd as unknown as import('../services/gemini').SeriesInfo) : null)
        } else {
          // First visitor for this book — call Gemini and persist to DB for everyone
          detectBookSeries({ title: book.title, author: book.author, userId: user.id, bookId: dbId })
            .then(info => setSeriesInfo(info))
            .catch(() => setSeriesInfo(null))
        }

        // Check if book is in user's library (with book join so Session gets cover/title)
        supabase.from('user_books').select('*, book:books(*), note_summary, note_summary_range')
          .eq('user_id', user.id)
          .eq('book_id', dbId)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setUserBook(data as UserBook)
              setRating(data.user_rating ?? 0)
              setCustomPages(String(data.custom_pages ?? book.pages ?? ''))
              setEpubPath(data.epub_storage_path ?? null)
              if (!synopsis && data.book?.synopsis) setSynopsis(data.book.synopsis)
              // Load note summary from DB (cross-device)
              if (data.note_summary) {
                setNotesSummary(data.note_summary as string)
                setSummaryPageRange(data.note_summary_range as { from: number | null; to: number | null } ?? null)
              }
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

    // Fetch synopsis from Google Books or Open Library if not already available
    const googleId = book.google_books_id ?? book.id
    const olId = book.open_library_id ?? (book.id?.startsWith('/works/') ? book.id : null)
    if (!book.synopsis) {
      if (googleId && !googleId.startsWith('/') && !googleId.startsWith('OL') && !googleId.startsWith('manual')) {
        fetch(`https://www.googleapis.com/books/v1/volumes/${googleId}`)
          .then(r => r.json())
          .then(data => { const desc = data.volumeInfo?.description; if (desc) setSynopsis(desc) })
          .catch(() => {})
      } else if (olId) {
        // Open Library works endpoint returns description
        fetch(`https://openlibrary.org${olId.startsWith('/') ? olId : '/' + olId}.json`)
          .then(r => r.json())
          .then(data => {
            const desc = typeof data.description === 'string' ? data.description
              : data.description?.value ?? null
            if (desc) setSynopsis(desc)
          })
          .catch(() => {})
      }
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

  const addToLibrary = async (status: 'reading' | 'finished' | 'want_to_read' | 'dropped') => {
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

  const uploadEpub = async (file: File) => {
    if (!user || !userBook || !bookDbId) return
    setEpubUploading(true)
    const path = `${user.id}/${bookDbId}.epub`
    const { error } = await supabase.storage.from('epubs').upload(path, file, { upsert: true, contentType: 'application/epub+zip' })
    if (!error) {
      await supabase.from('user_books').update({ epub_storage_path: path }).eq('id', userBook.id)
      setEpubPath(path)
    }
    setEpubUploading(false)
  }

  const saveSessionEndPage = async (s: ReadingSession) => {
    const newEnd = parseInt(editEndPage)
    if (isNaN(newEnd) || newEnd < 0) return
    const newPagesRead = s.start_page != null ? Math.max(0, newEnd - s.start_page) : s.pages_read ?? 0
    await supabase.from('reading_sessions')
      .update({ end_page: newEnd, pages_read: newPagesRead })
      .eq('id', s.id)

    // Cascade: update start_page of the immediately next chronological session
    // Sessions state is sorted descending, so the "next after s" is the one with the
    // smallest started_at that is still greater than s.started_at
    const sTime = new Date(s.started_at).getTime()
    const nextSession = sessions
      .filter(r => r.id !== s.id && new Date(r.started_at).getTime() > sTime)
      .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())[0]

    let updated = sessions.map(r => r.id === s.id ? { ...r, end_page: newEnd, pages_read: newPagesRead } : r)

    if (nextSession && nextSession.start_page != null && nextSession.end_page != null) {
      const nextNewPagesRead = Math.max(0, nextSession.end_page - newEnd)
      await supabase.from('reading_sessions')
        .update({ start_page: newEnd, pages_read: nextNewPagesRead })
        .eq('id', nextSession.id)
      updated = updated.map(r => r.id === nextSession.id
        ? { ...r, start_page: newEnd, pages_read: nextNewPagesRead }
        : r)
    }

    setSessions(updated)
    setEditingSessionId(null)

    // Sync current_page to the most recent session's end_page
    if (userBook) {
      const lastEndPage = updated
        .filter(r => r.end_page != null)
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]?.end_page ?? null
      await supabase.from('user_books')
        .update({ current_page: lastEndPage })
        .eq('id', userBook.id)
    }
  }

  const saveSessionStartPage = async (s: ReadingSession) => {
    const newStart = parseInt(editStartPage)
    if (isNaN(newStart) || newStart < 0) return
    const newPagesRead = s.end_page != null ? Math.max(0, s.end_page - newStart) : s.pages_read ?? 0
    await supabase.from('reading_sessions')
      .update({ start_page: newStart, pages_read: newPagesRead })
      .eq('id', s.id)
    setSessions(prev => prev.map(r => r.id === s.id ? { ...r, start_page: newStart, pages_read: newPagesRead } : r))
    setEditingStartPageId(null)
  }

  const saveSessionDuration = async (s: ReadingSession) => {
    const newMins = parseFloat(editDurationMins)
    if (isNaN(newMins) || newMins < 0) return
    const newSecs = Math.round(newMins * 60)
    await supabase.from('reading_sessions')
      .update({ duration_seconds: newSecs })
      .eq('id', s.id)
    setSessions(prev => prev.map(r => r.id === s.id ? { ...r, duration_seconds: newSecs } : r))
    setEditingDurationId(null)
  }

  const deleteSession = async (s: ReadingSession) => {
    await supabase.from('reading_sessions').delete().eq('id', s.id)
    const remaining = sessions.filter(r => r.id !== s.id)
    setSessions(remaining)
    // Update current_page to the end_page of the most recent remaining session
    if (userBook) {
      const lastEndPage = remaining
        .filter(r => r.end_page != null)
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]?.end_page ?? null
      await supabase.from('user_books')
        .update({ current_page: lastEndPage })
        .eq('id', userBook.id)
    }
  }

  const continueReading = async () => {
    if (!user || !userBook) return
    setAddingToLib(true)
    await supabase.from('user_books').update({ status: 'reading', finished_at: null }).eq('id', userBook.id)
    setUserBook(prev => prev ? { ...prev, status: 'reading' as const, finished_at: null } : prev)
    setAddingToLib(false)
  }

  const reRead = async () => {
    if (!user || !userBook) return
    setAddingToLib(true)
    await supabase.from('user_books').update({
      status: 'reading', current_page: 0,
      started_at: new Date().toISOString(), finished_at: null,
    }).eq('id', userBook.id)
    setUserBook(prev => prev ? { ...prev, status: 'reading' as const, current_page: 0, finished_at: null } : prev)
    setAddingToLib(false)
  }

  const handleSpineCaptured = async (dataUrl: string) => {
    if (!user || !userBook) return
    setSpineCapturing(false)
    setSpineSaving(true)
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const path = `${user.id}/${userBook.id}.jpg`
      const { error } = await supabase.storage.from('book-spines').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (!error) {
        const spineUrl = supabase.storage.from('book-spines').getPublicUrl(path).data.publicUrl
        await supabase.from('user_books').update({ spine_url: spineUrl }).eq('id', userBook.id)
        setUserBook(prev => prev ? { ...prev, spine_url: spineUrl } : prev)
      }
    } finally {
      setSpineSaving(false)
    }
  }

  if (!book) {
    return (
      <div style={{ minHeight: '100%', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 8 }}><svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
          <div style={{ color: theme.muted, fontSize: 14 }}>No book selected</div>
          <button onClick={() => navigate('/search')} style={{ marginTop: 16, padding: '10px 20px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 14 }}>Search Books</button>
        </div>
      </div>
    )
  }

  const statusLabel = userBook ? {
    reading: 'Reading', finished: 'Finished', want_to_read: 'Want to Read', dropped: 'Dropped'
  }[userBook.status] : null

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ minHeight: '100%', background: theme.bg, position: 'relative' }}>
      {/* Back */}
      <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 16px)', left: 16, zIndex: 20, width: 36, height: 36, borderRadius: '50%', background: theme.bgElevated, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke={theme.fg} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>

      {/* 3D cover hero */}
      <div style={{ background: theme.bgSecondary, paddingTop: 'calc(env(safe-area-inset-top, 0px) + 56px)', paddingBottom: 16 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          {/* Not in library yet */}
          {!userBook && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => addToLibrary('reading')} disabled={addingToLib} style={{ padding: '10px 18px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, flex: 1 }}>
                {addingToLib ? '…' : 'Start Reading'}
              </button>
              <button onClick={() => addToLibrary('want_to_read')} disabled={addingToLib} style={{ padding: '10px 14px', background: theme.bgSecondary, color: theme.fg, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 13 }}>
                Want to Read
              </button>
            </div>
          )}

          {/* Currently reading */}
          {userBook?.status === 'reading' && (() => {
            const totalPages = userBook.custom_pages ?? (userBook.book as any)?.pages_default ?? book.pages ?? 0
            const currentPage = userBook.current_page ?? 0
            const progress = totalPages > 0 ? Math.min(currentPage / totalPages, 1) : 0
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Primary CTA */}
                <button
                  onClick={() => epubPath ? setShowModeModal(true) : navigate('/session', { state: { book: userBook } })}
                  style={{ width: '100%', padding: '13px 18px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box' }}>
                  <svg width="11" height="13" viewBox="0 0 10 12" fill="none"><path d="M1 1l8 5.5L1 12V1z" fill="currentColor"/></svg>
                  Start Session
                </button>

                {/* Progress bar */}
                {totalPages > 0 && (
                  <div>
                    <div style={{ height: 4, borderRadius: 2, background: theme.bgSecondary, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progress * 100}%`, background: theme.fg, borderRadius: 2 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11.5, color: theme.muted }}>
                      <span>p. {currentPage} of {totalPages}</span>
                      <span>{Math.round(progress * 100)}%</span>
                    </div>
                  </div>
                )}

                {/* Secondary actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <label style={{ flex: 1, padding: '9px 12px', background: theme.bgSecondary, color: epubPath ? theme.fg : theme.muted, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, boxSizing: 'border-box' }}>
                    <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 5h4M5 7.5h4M5 10h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
                    {epubUploading ? 'Uploading…' : epubPath ? 'ePub ✓' : 'Upload ePub'}
                    <input type="file" accept=".epub,application/epub+zip" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadEpub(f) }} disabled={epubUploading} />
                  </label>
                  <button onClick={() => addToLibrary('finished')} disabled={addingToLib}
                    style={{ flex: 1, padding: '9px 12px', background: theme.bgSecondary, color: theme.fg, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 12.5, cursor: 'pointer', fontWeight: 500 }}>
                    {addingToLib ? '…' : '✓ Finished'}
                  </button>
                  <button onClick={() => addToLibrary('dropped')} disabled={addingToLib}
                    style={{ padding: '9px 14px', background: 'none', color: theme.muted, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 12.5, cursor: 'pointer' }}>
                    {addingToLib ? '…' : 'Drop'}
                  </button>
                </div>
              </div>
            )
          })()}

          {/* Want to read or dropped — show status + re-start option */}
          {(userBook?.status === 'want_to_read' || userBook?.status === 'dropped') && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ padding: '6px 12px', background: theme.bgSecondary, borderRadius: 8, fontSize: 12, color: theme.muted, fontWeight: 500 }}>{statusLabel}</div>
              <button onClick={() => addToLibrary('reading')} disabled={addingToLib} style={{ padding: '8px 16px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
                {addingToLib ? '…' : 'Start Reading'}
              </button>
            </div>
          )}

          {/* Finished */}
          {userBook?.status === 'finished' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ padding: '6px 12px', background: theme.bgSecondary, borderRadius: 8, fontSize: 12, color: theme.muted, fontWeight: 500, display: 'inline-block' }}>Finished</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={continueReading} disabled={addingToLib}
                  style={{ flex: 1, padding: '9px 14px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {addingToLib ? '…' : 'Continue reading'}
                </button>
                <button onClick={reRead} disabled={addingToLib}
                  style={{ padding: '9px 14px', background: theme.bgSecondary, color: theme.muted, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
                  {addingToLib ? '…' : 'Re-read'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${theme.border}`, marginBottom: 22 }}>
          {(['overview','details', ...(userBook ? ['notes','sessions'] : [])] as DetailTab[]).map(tab => {
            const isActive = tab === activeTab
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '10px 0', background: 'none', border: 'none', borderBottom: isActive ? `2px solid ${theme.fg}` : '2px solid transparent', marginBottom: -1, fontSize: 13.5, color: isActive ? theme.fg : theme.muted, fontWeight: isActive ? 600 : 400, textTransform: 'capitalize' }}>{tab}</button>
            )
          })}
        </div>

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div style={{ paddingBottom: 40 }}>
            {/* Finish prediction — only when reading and have session data */}
            {userBook?.status === 'reading' && (() => {
              const totalPages = userBook.custom_pages ?? (userBook.book as any)?.pages_default ?? book.pages ?? 0
              const currentPage = userBook.current_page ?? 0
              if (!totalPages) return null
              const pred = computeFinishPrediction(sessions, currentPage, totalPages)
              if (!pred) return null
              const { finishDate, pagesPerDay } = pred
              const today = new Date()
              const daysLeft = Math.ceil((finishDate.getTime() - today.getTime()) / (1000 * 3600 * 24))
              const dateStr = finishDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
              const daysText = daysLeft <= 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : daysLeft <= 7 ? `in ${daysLeft} days` : `on ${dateStr}`
              const remaining = totalPages - currentPage
              return (
                <div style={{ marginBottom: 22, padding: '14px 16px', background: theme.bgSecondary, borderRadius: 14, border: `1px solid ${theme.border}` }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 5 }}>At your pace</div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: theme.fg }}>Finish {daysText}</div>
                  <div style={{ fontSize: 12, color: theme.muted, marginTop: 3 }}>{pagesPerDay} pages/day avg · {remaining} pages left</div>
                </div>
              )
            })()}

            {synopsis ? (
              <p style={{ fontSize: 14, color: theme.fgDim, lineHeight: 1.75, marginBottom: 22, whiteSpace: 'pre-wrap' }}>{stripHtml(synopsis)}</p>
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

            {seriesInfo && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 12 }}>Part of a Series</div>
                <div style={{ padding: 16, background: theme.bgSecondary, borderRadius: 14, border: `1px solid ${theme.border}` }}>
                  {seriesInfo.parentSagaName && (
                    <div style={{ fontSize: 11, color: theme.muted, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ opacity: 0.5 }}>↳</span>
                      <span>{seriesInfo.parentSagaName}{seriesInfo.parentSagaTotalBooks ? ` · ${seriesInfo.parentSagaTotalBooks} books` : ''}</span>
                    </div>
                  )}
                  <div style={{ fontSize: 14, fontWeight: 600, color: theme.fg, marginBottom: 3 }}>{seriesInfo.seriesName}</div>
                  <div style={{ fontSize: 12, color: theme.muted, marginBottom: seriesInfo.nextTitle && seriesInfo.position < seriesInfo.totalBooks ? 14 : 0 }}>
                    Book {seriesInfo.position} of {seriesInfo.totalBooks}
                  </div>
                  {seriesInfo.nextTitle && seriesInfo.position < seriesInfo.totalBooks && (
                    <button
                      onClick={async () => {
                        const { results } = await searchBooks(`${seriesInfo.nextTitle} ${seriesInfo.nextAuthor}`, {})
                        if (results[0]) navigate('/detail', { state: { book: results[0] } })
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 10, cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10.5, color: theme.muted, marginBottom: 2, fontWeight: 600, letterSpacing: 0.5 }}>NEXT BOOK</div>
                        <div style={{ fontSize: 13, color: theme.fg, fontWeight: 500 }}>{seriesInfo.nextTitle}</div>
                        <div style={{ fontSize: 12, color: theme.muted }}>{seriesInfo.nextAuthor}</div>
                      </div>
                      <svg width="6" height="11" viewBox="0 0 6 11" fill="none"><path d="M1 1L5 5.5L1 10" stroke={theme.muted} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Details tab */}
        {activeTab === 'details' && (
          <div style={{ paddingBottom: 40 }}>
            {/* Spine photo — only visible when book is in library */}
            {userBook && (
              <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 14 }}>Book Spine</div>
                {userBook.spine_url ? (
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 54, height: 160, borderRadius: 6, overflow: 'hidden', border: `1px solid ${theme.border}`, flexShrink: 0, boxShadow: '0 3px 10px rgba(0,0,0,0.18)' }}>
                      <img src={userBook.spine_url} alt="Book spine" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                      <div style={{ fontSize: 13, color: theme.fg }}>Spine photo captured</div>
                      <div style={{ fontSize: 11.5, color: theme.muted, lineHeight: 1.5 }}>This is how your book will appear on the virtual shelf.</div>
                      <button onClick={() => setSpineCapturing(true)} style={{ marginTop: 4, padding: '7px 14px', background: theme.bgSecondary, border: `1px solid ${theme.border}`, borderRadius: 9, fontSize: 12, color: theme.muted, cursor: 'pointer', alignSelf: 'flex-start' }}>
                        Retake photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setSpineCapturing(true)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: theme.bgSecondary, border: `1px dashed ${theme.border}`, borderRadius: 14, cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                    <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
                      <path d="M2 6.2C2 5.5 2.5 5 3.2 5h1.6l.9-1.4C5.9 3.2 6.2 3 6.6 3h4.8c.4 0 .7.2.9.6L13.2 5h1.6c.7 0 1.2.5 1.2 1.2v7.1c0 .7-.5 1.2-1.2 1.2H3.2C2.5 14.5 2 14 2 13.3V6.2Z" stroke={theme.muted} strokeWidth="1.3" strokeLinejoin="round"/>
                      <circle cx="9" cy="9.6" r="2.7" stroke={theme.muted} strokeWidth="1.3"/>
                    </svg>
                    <div>
                      <div style={{ fontSize: 13.5, color: theme.fg, marginBottom: 2 }}>Capture spine photo</div>
                      <div style={{ fontSize: 11.5, color: theme.muted }}>Scan the real spine of your physical book</div>
                    </div>
                  </button>
                )}
              </div>
            )}
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
            {/* Previous book in series summary context — loaded from Supabase */}
            {seriesInfo && seriesInfo.position > 1 && seriesInfo.prevTitle && user?.id && bookDbId && (
              <PrevSeriesSummary
                userId={user.id}
                prevTitle={seriesInfo.prevTitle}
                position={seriesInfo.position}
                theme={theme}
              />
            )}
            {/* Add note */}
            <div style={{ background: theme.bgSecondary, borderRadius: 14, padding: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input value={newNotePage} onChange={e => setNewNotePage(e.target.value)} placeholder="Page #" type="number" style={{ width: 72, padding: '8px 10px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 14, color: theme.fg }} />
              </div>
              <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Write a note…" rows={3} style={{ width: '100%', padding: '10px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 14, color: theme.fg, resize: 'none' }} />
              <button onClick={addNote} disabled={!newNote.trim()} style={{ marginTop: 10, padding: '10px 20px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, opacity: newNote.trim() ? 1 : 0.5 }}>Add Note</button>
            </div>

            {notes.length >= 1 && (
              <div style={{ marginBottom: 20, background: theme.bgSecondary, borderRadius: 14, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: notesSummary ? 12 : 0 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: theme.fg }}>AI Reading Recap</div>
                    <div style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>Summary based on your {notes.length} note{notes.length !== 1 ? 's' : ''}</div>
                  </div>
                  <button
                    onClick={async () => {
                      setSummarizing(true); setSummaryError(false)
                      try {
                        const pages = notes.map(n => n.page_number).filter(Boolean) as number[]
                        const range = pages.length > 0
                          ? { from: Math.min(...pages), to: Math.max(...pages) }
                          : { from: null, to: null }
                        // Fetch previous book summary for series context
                        let prevSummary: string | null = null
                        if (seriesInfo && seriesInfo.position > 1 && seriesInfo.prevTitle && user?.id) {
                          const { data: prevBook } = await supabase
                            .from('books').select('id').ilike('title', seriesInfo.prevTitle).maybeSingle()
                          if (prevBook?.id) {
                            const { data: prevUB } = await supabase
                              .from('user_books').select('note_summary')
                              .eq('user_id', user.id).eq('book_id', prevBook.id).maybeSingle()
                            prevSummary = prevUB?.note_summary ?? null
                          }
                        }
                        const s = await summarizeNotes({
                          notes, bookTitle: book?.title ?? 'this book',
                          userId: user?.id ?? null,
                          previousBookSummary: prevSummary,
                        })
                        setNotesSummary(s)
                        setSummaryPageRange(range)
                        // Save to Supabase (cross-device sync)
                        if (userBook?.id) {
                          await supabase.from('user_books')
                            .update({ note_summary: s, note_summary_range: range })
                            .eq('id', userBook.id)
                        }
                      } catch { setSummaryError(true) }
                      setSummarizing(false)
                    }}
                    disabled={summarizing}
                    style={{ padding: '7px 14px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: summarizing ? 'default' : 'pointer', opacity: summarizing ? 0.7 : 1, flexShrink: 0 }}>
                    {summarizing ? 'Analyzing…' : notesSummary ? 'Refresh' : 'Summarize'}
                  </button>
                </div>
                {notesSummary && (
                  <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 12 }}>
                    {summaryPageRange && (summaryPageRange.from || summaryPageRange.to) && (
                      <div style={{ fontSize: 10, color: theme.muted, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                        Pages {summaryPageRange.from ?? '?'} – {summaryPageRange.to ?? '?'}
                      </div>
                    )}
                    <div style={{ fontSize: 13, color: theme.fg, lineHeight: 1.7 }}>{notesSummary}</div>
                  </div>
                )}
                {summaryError && (
                  <div style={{ fontSize: 12, color: theme.muted, marginTop: 8 }}>Could not generate summary. Try again.</div>
                )}
              </div>
            )}

            {notes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 14, color: theme.muted, marginBottom: 6 }}>No notes yet</div>
                <div style={{ fontSize: 12, color: theme.muted, opacity: 0.6 }}>Add a note above — once you have one, AI can summarize your reading progress</div>
              </div>
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
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 500, color: theme.fg }}>{dateStr}</div>
                            {confirmDeleteSessionId === s.id ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, color: '#ef4444' }}>Delete?</span>
                                <button onClick={() => { deleteSession(s); setConfirmDeleteSessionId(null) }}
                                  style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Yes</button>
                                <button onClick={() => setConfirmDeleteSessionId(null)}
                                  style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'none', color: theme.muted, border: `1px solid ${theme.border}`, cursor: 'pointer' }}>No</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDeleteSessionId(s.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: theme.muted, display: 'flex', alignItems: 'center' }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </button>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>{isManual ? 'Manual update' : timeStr}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {(s.pages_read ?? 0) > 0 && (
                            <div style={{ fontSize: 14, fontWeight: 500, color: theme.fg }}>+{s.pages_read} pages</div>
                          )}

                          {/* Duration — editable */}
                          {editingDurationId === s.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, justifyContent: 'flex-end' }}>
                              <input
                                autoFocus
                                type="number"
                                value={editDurationMins}
                                onChange={e => setEditDurationMins(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveSessionDuration(s); if (e.key === 'Escape') setEditingDurationId(null) }}
                                style={{ width: 56, padding: '3px 6px', fontSize: 12, borderRadius: 6, border: `1px solid ${theme.accent}`, background: theme.bg, color: theme.fg, textAlign: 'center' }}
                              />
                              <span style={{ fontSize: 11, color: theme.muted }}>min</span>
                              <button onClick={() => saveSessionDuration(s)} style={{ padding: '3px 8px', fontSize: 11, borderRadius: 6, background: theme.accent, color: theme.accentFg, border: 'none', cursor: 'pointer', fontWeight: 600 }}>OK</button>
                              <button onClick={() => setEditingDurationId(null)} style={{ padding: '3px 6px', fontSize: 11, borderRadius: 6, background: 'none', color: theme.muted, border: `1px solid ${theme.border}`, cursor: 'pointer' }}>×</button>
                            </div>
                          ) : dur ? (
                            <button
                              onClick={() => { setEditingDurationId(s.id); setEditDurationMins(String(Math.round((s.duration_seconds ?? 0) / 60))); setEditingSessionId(null) }}
                              style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', justifyContent: 'flex-end', marginLeft: 'auto' }}>
                              <span style={{ fontSize: 12, color: theme.muted }}>{dur}</span>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ color: theme.muted, opacity: 0.5 }}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </button>
                          ) : null}

                          {/* Page range — editable */}
                          {s.start_page != null && s.end_page != null && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              {/* Start page */}
                              {editingStartPageId === s.id ? (
                                <>
                                  <span style={{ fontSize: 11, color: theme.muted }}>p.</span>
                                  <input
                                    autoFocus
                                    type="number"
                                    value={editStartPage}
                                    onChange={e => setEditStartPage(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveSessionStartPage(s); if (e.key === 'Escape') setEditingStartPageId(null) }}
                                    style={{ width: 56, padding: '3px 6px', fontSize: 12, borderRadius: 6, border: `1px solid ${theme.accent}`, background: theme.bg, color: theme.fg, textAlign: 'center' }}
                                  />
                                  <button onClick={() => saveSessionStartPage(s)} style={{ padding: '3px 8px', fontSize: 11, borderRadius: 6, background: theme.accent, color: theme.accentFg, border: 'none', cursor: 'pointer', fontWeight: 600 }}>OK</button>
                                  <button onClick={() => setEditingStartPageId(null)} style={{ padding: '3px 6px', fontSize: 11, borderRadius: 6, background: 'none', color: theme.muted, border: `1px solid ${theme.border}`, cursor: 'pointer' }}>×</button>
                                </>
                              ) : (
                                <button
                                  onClick={() => { setEditingStartPageId(s.id); setEditStartPage(String(s.start_page)); setEditingSessionId(null); setEditingDurationId(null) }}
                                  style={{ background: `${theme.accent}18`, border: `1px solid ${theme.accent}40`, borderRadius: 8, padding: '4px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <span style={{ fontSize: 12, color: theme.fg }}>p.{s.start_page}</span>
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" style={{ color: theme.accent }}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                              )}

                              <span style={{ fontSize: 12, color: theme.muted }}>–</span>

                              {/* End page */}
                              {editingSessionId === s.id ? (
                                <>
                                  <input
                                    autoFocus
                                    type="number"
                                    value={editEndPage}
                                    onChange={e => setEditEndPage(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveSessionEndPage(s); if (e.key === 'Escape') setEditingSessionId(null) }}
                                    style={{ width: 56, padding: '3px 6px', fontSize: 12, borderRadius: 6, border: `1px solid ${theme.accent}`, background: theme.bg, color: theme.fg, textAlign: 'center' }}
                                  />
                                  <button onClick={() => saveSessionEndPage(s)} style={{ padding: '3px 8px', fontSize: 11, borderRadius: 6, background: theme.accent, color: theme.accentFg, border: 'none', cursor: 'pointer', fontWeight: 600 }}>OK</button>
                                  <button onClick={() => setEditingSessionId(null)} style={{ padding: '3px 6px', fontSize: 11, borderRadius: 6, background: 'none', color: theme.muted, border: `1px solid ${theme.border}`, cursor: 'pointer' }}>×</button>
                                </>
                              ) : (
                                <button
                                  onClick={() => { setEditingSessionId(s.id); setEditEndPage(String(s.end_page)); setEditingDurationId(null); setEditingStartPageId(null) }}
                                  style={{ background: `${theme.accent}18`, border: `1px solid ${theme.accent}40`, borderRadius: 8, padding: '4px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <span style={{ fontSize: 12, color: theme.fg }}>p.{s.end_page}</span>
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" style={{ color: theme.accent }}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                              )}
                            </div>
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

      {/* Spine capture camera */}
      {spineCapturing && (
        <SpineCaptureCamera
          bookTitle={book.title}
          onCapture={handleSpineCaptured}
          onClose={() => setSpineCapturing(false)}
        />
      )}

      {/* Spine saving toast */}
      {spineSaving && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: theme.fg, color: theme.bg, borderRadius: 999, padding: '8px 20px', fontSize: 13, fontWeight: 500, zIndex: 600, whiteSpace: 'nowrap' }}>
          Saving spine photo…
        </div>
      )}

      {/* Mode picker modal — shown when epub is loaded and user taps Start Session */}
      {showModeModal && userBook && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowModeModal(false)}>
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={e => e.stopPropagation()}
            style={{ width: '100%', background: theme.bgElevated, borderRadius: '20px 20px 0 0', padding: '28px 24px 40px' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: theme.fg, marginBottom: 6 }}>How are you reading?</div>
            <div style={{ fontSize: 13, color: theme.muted, marginBottom: 24 }}>You have an ePub for this book</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => { setShowModeModal(false); navigate('/read', { state: { userBook, epubPath } }) }}
                style={{ padding: '16px 20px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                <div style={{ textAlign: 'left' }}>
                  <div>Virtual (ePub)</div>
                  <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.8, marginTop: 2 }}>Read on screen with highlights</div>
                </div>
              </button>
              <button
                onClick={() => { setShowModeModal(false); navigate('/session', { state: { book: userBook } }) }}
                style={{ padding: '16px 20px', background: theme.bgSecondary, color: theme.fg, border: `1px solid ${theme.border}`, borderRadius: 14, fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 2h9l4 4v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M13 2v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <div style={{ textAlign: 'left' }}>
                  <div>Physical Book</div>
                  <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.8, marginTop: 2 }}>Track pages from your print copy</div>
                </div>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}
