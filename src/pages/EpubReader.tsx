import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import type { UserBook } from '../types'

// epubjs types are loose — use any for the Book/Rendition objects
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EpubBook = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rendition = any

function pad(n: number) { return String(n).padStart(2, '0') }
function fmtTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`
}

interface SelectionState {
  text: string
  cfi: string
}

interface AnchorData {
  sentence: string
  chapter: string
  cfi: string
  progress: number
}

export default function EpubReaderPage() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const userBook: UserBook = state?.userBook
  const epubPath: string = state?.epubPath

  const viewerRef = useRef<HTMLDivElement>(null)
  const bookRef   = useRef<EpubBook>(null)
  const rendRef   = useRef<Rendition>(null)

  // Session timer
  const startRef    = useRef(Date.now())
  const accRef      = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [secs, setSecs]         = useState(0)
  const [running, setRunning]   = useState(true)

  // Reader state
  const [ready, setReady]       = useState(false)
  const [progress, setProgress] = useState(0)
  const [chapterName, setChapterName] = useState('')
  const [error, setError]       = useState<string | null>(null)

  // UI panels
  const [showTop, setShowTop]   = useState(true)
  const [showEnd, setShowEnd]   = useState(false)

  // Highlight / note
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)

  // Last sentence anchor (mandatory on session end)
  const [anchorSentence, setAnchorSentence] = useState('')
  const [anchorCfi, setAnchorCfi] = useState('')
  const [anchorError, setAnchorError] = useState(false)
  const [saving, setSaving] = useState(false)

  // Computed
  const bookMeta = userBook?.book as { title?: string; cover_url?: string | null } | undefined
  const title = bookMeta?.title ?? 'Book'
  const totalPages = userBook?.custom_pages ?? (userBook?.book as any)?.pages_default ?? 0

  // ── Timer ────────────────────────────────────────────────────────────────────

  const startTick = useCallback(() => {
    intervalRef.current = setInterval(() => {
      setSecs(accRef.current + Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
  }, [])

  useEffect(() => {
    startRef.current = Date.now()
    startTick()
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [startTick])

  const pause = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    accRef.current += Math.floor((Date.now() - startRef.current) / 1000)
    setRunning(false)
  }

  const resume = () => {
    startRef.current = Date.now()
    setRunning(true)
    startTick()
  }

  // ── Load ePub ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!epubPath || !user || !viewerRef.current) return

    let cancelled = false

    const load = async () => {
      try {
        const { data, error: dlErr } = await supabase.storage.from('epubs').download(epubPath)
        if (dlErr || !data) { setError('Could not load ePub file'); return }
        if (cancelled) return

        const ePub = (await import('epubjs')).default
        const arrayBuffer = await data.arrayBuffer()
        const book: EpubBook = ePub(arrayBuffer)
        bookRef.current = book

        const rendition: Rendition = book.renderTo(viewerRef.current!, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'none',
        })
        rendRef.current = rendition

        // Restore last position
        const savedCfi = localStorage.getItem(`epub_cfi_${userBook.id}`)
        await rendition.display(savedCfi ?? undefined)

        // Track location changes → update progress + chapter
        rendition.on('locationChanged', (loc: any) => {
          const pct = book.locations?.percentageFromCfi(loc.start.cfi) ?? 0
          setProgress(Math.round(pct * 100))
          localStorage.setItem(`epub_cfi_${userBook.id}`, loc.start.cfi)
          // Get chapter name from TOC
          book.loaded.navigation.then((nav: any) => {
            const toc = nav?.toc ?? []
            const flat = flattenToc(toc)
            const current = flat.find((item: any) => {
              try { return book.spine.get(item.href) } catch { return false }
            })
            if (current) setChapterName(current.label?.trim() ?? '')
          })
        })

        // Text selection → allow highlighting or anchoring
        rendition.on('selected', (cfiRange: string, contents: any) => {
          const text = contents.window.getSelection()?.toString().trim() ?? ''
          if (text.length > 5) setSelection({ text, cfi: cfiRange })
        })

        // Tap to toggle top bar (if no selection)
        rendition.on('click', () => {
          if (!selection) setShowTop(p => !p)
        })

        // Generate locations for % progress (async, non-blocking)
        book.ready.then(() => {
          book.locations.generate(1024).then(() => {
            if (!cancelled) setReady(true)
          })
        })

        setReady(true)
      } catch (e) {
        if (!cancelled) setError(String(e))
      }
    }

    load()
    return () => { cancelled = true; rendRef.current?.destroy?.() }
  }, [epubPath, user, userBook])

  // ── Navigation ───────────────────────────────────────────────────────────────

  const goNext = () => { rendRef.current?.next(); setSelection(null) }
  const goPrev = () => { rendRef.current?.prev(); setSelection(null) }

  // ── Highlight / note ─────────────────────────────────────────────────────────

  const saveHighlight = async (withNote: string) => {
    if (!selection || !user || !userBook) return
    rendRef.current?.annotations?.add(
      'highlight', selection.cfi, {}, undefined,
      'highlight', { fill: '#7C3AED', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' }
    )
    await supabase.from('book_notes').insert({
      user_id: user.id,
      book_id: userBook.book_id,
      content: withNote.trim() ? `${selection.text}\n\n${withNote.trim()}` : selection.text,
      epub_cfi: selection.cfi,
      is_highlight: true,
      page_number: null,
    })
    setSelection(null)
    setNoteText('')
    setShowNoteInput(false)
    setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 2000)
  }

  // ── Session end ──────────────────────────────────────────────────────────────

  const openEndModal = () => {
    if (running) pause()
    // Pre-fill anchor with current selection if any
    if (selection) { setAnchorSentence(selection.text); setAnchorCfi(selection.cfi) }
    setShowEnd(true)
  }

  const saveSession = async () => {
    if (!anchorSentence.trim()) { setAnchorError(true); return }
    if (!user || !userBook) return
    setSaving(true)
    await supabase.auth.refreshSession()

    const duration  = accRef.current
    const endedAt   = new Date().toISOString()
    const startedAt = new Date(Date.now() - duration * 1000).toISOString()
    const prog      = progress / 100

    // Estimate physical page from progress
    const physPages = totalPages > 0 ? Math.round(prog * totalPages) : null

    // Save session with epub metadata
    await supabase.from('reading_sessions').insert({
      user_id: user.id,
      book_id: userBook.book_id,
      started_at: startedAt,
      ended_at: endedAt,
      duration_seconds: duration,
      session_type: 'epub',
      epub_cfi_start: localStorage.getItem(`epub_cfi_${userBook.id}`) ?? null,
      epub_cfi_end: anchorCfi || null,
      last_sentence: anchorSentence.trim(),
      chapter_name: chapterName || null,
      pages_read: null,
      start_page: null,
      end_page: physPages,
    })

    // Update user_books progress
    await supabase.from('user_books').update({
      progress_pct: prog,
      current_page: physPages,
    }).eq('id', userBook.id)

    // Save anchor to localStorage for next physical session
    const anchor: AnchorData = {
      sentence: anchorSentence.trim(),
      chapter: chapterName,
      cfi: anchorCfi,
      progress: prog,
    }
    localStorage.setItem(`epub_anchor_${userBook.book_id}`, JSON.stringify(anchor))

    setSaving(false)
    navigate(-1)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!userBook || !epubPath) {
    return (
      <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#888', fontSize: 14 }}>No book selected</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ color: '#EF4444', fontSize: 14, textAlign: 'center' }}>{error}</div>
        <button onClick={() => navigate(-1)} style={{ padding: '10px 20px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, color: '#fff', fontSize: 14 }}>Go Back</button>
      </div>
    )
  }

  return (
    <div style={{ height: '100dvh', background: '#0d0d0d', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

      {/* Top bar */}
      {showTop && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30, background: 'rgba(13,13,13,0.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate(-1)} style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
            {chapterName && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chapterName}</div>}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{progress}%</div>
          <button onClick={running ? pause : resume} style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {running
              ? <svg width="10" height="12" viewBox="0 0 10 12" fill="none"><rect x="1" y="1" width="3" height="10" rx="1" fill="rgba(255,255,255,0.7)"/><rect x="6" y="1" width="3" height="10" rx="1" fill="rgba(255,255,255,0.7)"/></svg>
              : <svg width="10" height="12" viewBox="0 0 10 12" fill="none"><path d="M1 1l8 5-8 5V1z" fill="rgba(255,255,255,0.7)"/></svg>
            }
          </button>
          <div style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: running ? '#22C55E' : 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{fmtTime(secs)}</div>
          <button onClick={openEndModal} style={{ padding: '6px 12px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>End</button>
        </div>
      )}

      {/* ePub viewer */}
      {!ready && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading book…</div>
        </div>
      )}
      <div ref={viewerRef} style={{ flex: 1, opacity: ready ? 1 : 0, transition: 'opacity 0.3s' }} />

      {/* Prev / Next tap zones */}
      <button onClick={goPrev} style={{ position: 'absolute', left: 0, top: 80, bottom: 80, width: 44, background: 'transparent', border: 'none', zIndex: 20 }} aria-label="Previous page" />
      <button onClick={goNext} style={{ position: 'absolute', right: 0, top: 80, bottom: 80, width: 44, background: 'transparent', border: 'none', zIndex: 20 }} aria-label="Next page" />

      {/* Selection tooltip */}
      {selection && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40, background: '#1a1a1a', borderTop: '1px solid rgba(255,255,255,0.1)', padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{selection.text}"</div>
          {noteSaved && <div style={{ fontSize: 12, color: '#22C55E', marginBottom: 8 }}>Saved to notes</div>}
          {!noteSaved && (
            showNoteInput ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Add a note (optional)…"
                  rows={2}
                  autoFocus
                  style={{ width: '100%', padding: '8px 10px', background: '#111', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 13, color: '#fff', resize: 'none' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => saveHighlight(noteText)} style={{ flex: 1, padding: '9px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Save highlight</button>
                  <button onClick={() => { setShowNoteInput(false); setNoteText('') }} style={{ padding: '9px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => saveHighlight('')} style={{ flex: 1, padding: '9px', background: '#7C3AED22', color: '#a78bfa', border: '1px solid #7C3AED55', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Highlight</button>
                <button onClick={() => setShowNoteInput(true)} style={{ flex: 1, padding: '9px', background: '#1e1e1e', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 13 }}>+ Note</button>
                <button onClick={() => setSelection(null)} style={{ padding: '9px 12px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 18 }}>×</button>
              </div>
            )
          )}
        </div>
      )}

      {/* End session modal */}
      {showEnd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ width: '100%', background: '#141414', borderRadius: '20px 20px 0 0', padding: '28px 20px 40px', maxHeight: '80dvh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#fff', marginBottom: 4 }}>End Reading Session</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>{fmtTime(accRef.current)} · {progress}% complete</div>

            {/* Mandatory last sentence */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: anchorError ? '#EF4444' : 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
                Last sentence you read *
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8, lineHeight: 1.5 }}>
                Select text in the book, then tap "Use as anchor" — or type it manually. This helps you find your place in the physical book.
              </div>
              {selection && (
                <button
                  onClick={() => { setAnchorSentence(selection.text); setAnchorCfi(selection.cfi); setAnchorError(false) }}
                  style={{ width: '100%', padding: '10px 12px', background: '#7C3AED22', border: '1px solid #7C3AED55', borderRadius: 10, color: '#a78bfa', fontSize: 12, marginBottom: 8, textAlign: 'left' }}>
                  Use selected: "{selection.text.slice(0, 60)}{selection.text.length > 60 ? '…' : ''}"
                </button>
              )}
              <textarea
                value={anchorSentence}
                onChange={e => { setAnchorSentence(e.target.value); setAnchorError(false) }}
                placeholder="Type or paste the last sentence…"
                rows={3}
                style={{ width: '100%', padding: '10px 12px', background: '#1a1a1a', border: `1px solid ${anchorError ? '#EF4444' : 'rgba(255,255,255,0.15)'}`, borderRadius: 10, fontSize: 13, color: '#fff', resize: 'none' }}
              />
              {anchorError && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>Required — this helps you locate your place in the physical book</div>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={saveSession} disabled={saving} style={{ padding: '14px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700 }}>
                {saving ? 'Saving…' : 'Save session'}
              </button>
              <button onClick={() => { setShowEnd(false); if (!running) resume() }} style={{ padding: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
                Keep reading
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function flattenToc(toc: any[]): any[] {
  return toc.reduce((acc: any[], item: any) => {
    acc.push(item)
    if (item.subitems?.length) acc.push(...flattenToc(item.subitems))
    return acc
  }, [])
}
