import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import type { UserBook } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EpubBook = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rendition = any

// ─── Reader themes (monochromatic — no accent color) ──────────────────────────
type ThemeId = 'light' | 'dark' | 'sepia'

const THEMES: Record<ThemeId, {
  bg: string; fg: string; muted: string
  uiBg: string; uiBorder: string; name: string
}> = {
  light: {
    bg: '#ffffff', fg: '#1a1a1a', muted: '#888888',
    uiBg: '#ffffff', uiBorder: 'rgba(0,0,0,0.1)', name: 'Light',
  },
  sepia: {
    bg: '#f4ead8', fg: '#3b2e1e', muted: '#8a7560',
    uiBg: '#ede3cc', uiBorder: 'rgba(91,70,54,0.15)', name: 'Sepia',
  },
  dark: {
    bg: '#111111', fg: '#e8e6e1', muted: 'rgba(232,230,225,0.45)',
    uiBg: '#1a1a1a', uiBorder: 'rgba(255,255,255,0.1)', name: 'Dark',
  },
}

// CSS injected into epub iframe — no link color overrides (monochromatic)
const EPUB_CSS: Record<ThemeId, string> = {
  light: `
    html, body { background-color: #ffffff !important; color: #1a1a1a !important; }
    * { color: #1a1a1a !important; background-color: transparent !important; }
    img { max-width: 100% !important; height: auto !important; }
  `,
  sepia: `
    html, body { background-color: #f4ead8 !important; color: #3b2e1e !important; }
    * { color: #3b2e1e !important; background-color: transparent !important; }
    img { max-width: 100% !important; height: auto !important; }
  `,
  dark: `
    html, body { background-color: #111111 !important; color: #e8e6e1 !important; }
    * { color: #e8e6e1 !important; background-color: transparent !important; }
    img { max-width: 100% !important; height: auto !important; filter: brightness(0.85); }
    p, span, div, li, td, th, h1, h2, h3, h4, h5, h6 { color: #e8e6e1 !important; }
  `,
}

type FontId = 'serif' | 'sans' | 'mono'
const FONTS: Record<FontId, { label: string; css: string }> = {
  serif: { label: 'Serif', css: 'Georgia, "Times New Roman", serif' },
  sans:  { label: 'Sans',  css: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  mono:  { label: 'Mono',  css: '"Courier New", Courier, monospace' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, '0') }
function fmtTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`
}
function flattenToc(toc: any[]): any[] {
  return toc.reduce((acc: any[], item: any) => {
    acc.push(item)
    if (item.subitems?.length) acc.push(...flattenToc(item.subitems))
    return acc
  }, [])
}

// ─── Settings storage ─────────────────────────────────────────────────────────
type ReaderSettings = { theme: ThemeId; fontSize: number; fontId: FontId; marginH: number }
const DEFAULTS: ReaderSettings = { theme: 'light', fontSize: 18, fontId: 'serif', marginH: 20 }
const SETTINGS_KEY = 'epub_reader_settings'
function loadSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<ReaderSettings>) }
  } catch { /* ignore */ }
  return { ...DEFAULTS }
}
function saveSettings(s: ReaderSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SelectionState { text: string; cfi: string }

export default function EpubReaderPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const userBook: UserBook = state?.userBook
  const epubPath: string   = state?.epubPath

  const viewerRef = useRef<HTMLDivElement>(null)
  const bookRef   = useRef<EpubBook>(null)
  const rendRef   = useRef<Rendition>(null)

  // ── Persistent settings ──
  const [settings, _setSettings] = useState(loadSettings)
  const settingsRef = useRef(settings)
  const setSettings = useCallback((fn: (prev: ReaderSettings) => ReaderSettings) => {
    _setSettings(prev => {
      const next = fn(prev)
      settingsRef.current = next
      saveSettings(next)
      return next
    })
  }, [])
  const { theme: themeId, fontSize, fontId, marginH } = settings
  const T = THEMES[themeId]

  // ── Session timer ──
  const startRef    = useRef(Date.now())
  const accRef      = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [secs, setSecs]       = useState(0)
  const [running, setRunning] = useState(true)

  // ── Reader state ──
  const [ready, setReady]               = useState(false)
  const [progress, setProgress]         = useState(0)
  const [chapterName, setChapterName]   = useState('')
  const [error, setError]               = useState<string | null>(null)

  // ── UI panels ──
  const [showBars, setShowBars]         = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showEnd, setShowEnd]           = useState(false)
  const showBarsRef = useRef(true)

  // ── Highlight / note toolbar ──
  const [selection, setSelection]           = useState<SelectionState | null>(null)
  const [showNoteInput, setShowNoteInput]   = useState(false)
  const [noteText, setNoteText]             = useState('')
  const [noteSaved, setNoteSaved]           = useState(false)
  const [positionMarked, setPositionMarked] = useState(false)
  const [awaitingAnchor, setAwaitingAnchor] = useState(false)
  const awaitingAnchorRef = useRef(false)

  // ── Session end ──
  const [anchorSentence, setAnchorSentence] = useState('')
  const [anchorCfi, setAnchorCfi]           = useState('')
  const [anchorError, setAnchorError]       = useState(false)
  const [endNote, setEndNote]               = useState('')
  const [saving, setSaving]                 = useState(false)
  const [showAnchorBanner, setShowAnchorBanner] = useState(false)
  const [anchorBannerText, setAnchorBannerText] = useState('')

  const bookMeta   = userBook?.book as { title?: string } | undefined
  const title      = bookMeta?.title ?? 'Book'
  const totalPages = userBook?.custom_pages ?? (userBook?.book as any)?.pages_default ?? 0

  // ── Apply theme/font/size to rendition ────────────────────────────────────────
  const applyTheme = useCallback((rend: Rendition, tid: ThemeId, fid: FontId, fs: number) => {
    const fontCss = FONTS[fid].css
    const combined = EPUB_CSS[tid] + `
      html, body, p, span, div, li {
        font-family: ${fontCss} !important;
        font-size: ${fs}px !important;
        line-height: 1.75 !important;
      }
    `
    rend.themes.register('custom', { '*': {} })
    rend.themes.override('background-color', THEMES[tid].bg)
    rend.themes.override('color', THEMES[tid].fg)
    rend.getContents().forEach((c: any) => {
      try {
        const existing = c.document?.getElementById('cc-injected-styles')
        if (existing) { existing.textContent = combined; return }
        const style = c.document?.createElement('style')
        if (!style) return
        style.id = 'cc-injected-styles'
        style.textContent = combined
        c.document?.head?.appendChild(style)
      } catch { /* iframe not ready */ }
    })
  }, [])

  // ── Tap-to-mark: inject per-paragraph click handlers into epub iframes ────────
  // iOS intercepts text selection with its native menu, so we use tap instead.
  // Registered on every 'rendered' event (page turn) so new paragraphs get handlers.
  const injectTapToMark = useCallback((rend: Rendition) => {
    try {
      rend.getContents().forEach((c: any) => {
        const doc = c.document as Document
        doc.querySelectorAll('p, li, blockquote').forEach((el: Element) => {
          el.addEventListener('click', () => {
            if (!awaitingAnchorRef.current) return
            const text = (el as HTMLElement).innerText?.trim()
            if (text && text.length > 10) {
              setAnchorSentence(text.slice(0, 300))
              setAwaitingAnchor(false)
              setShowEnd(true)
            }
          })
        })
      })
    } catch { /* ignore — iframe may not be ready */ }
  }, [])

  // ── Timer ──────────────────────────────────────────────────────────────────────
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

  const pause = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    accRef.current += Math.floor((Date.now() - startRef.current) / 1000)
    setRunning(false)
  }, [])

  const resume = useCallback(() => {
    startRef.current = Date.now()
    setRunning(true)
    startTick()
  }, [startTick])

  useEffect(() => { awaitingAnchorRef.current = awaitingAnchor }, [awaitingAnchor])

  // ── Load ePub ──────────────────────────────────────────────────────────────────
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
          width: '100%', height: '100%',
          flow: 'paginated', spread: 'none',
          allowScriptedContent: false,
        })
        rendRef.current = rendition

        const savedCfi = localStorage.getItem(`epub_cfi_${userBook.id}`)
        // Read physical session anchor — used to resume position if no epub CFI saved yet
        let physAnchor: { sentence: string; cfi: string; progress: number } | null = null
        try {
          const raw = localStorage.getItem(`epub_anchor_${userBook.book_id}`)
          if (raw) physAnchor = JSON.parse(raw)
        } catch { /* ignore */ }
        // Priority: last epub position > previous epub end CFI > beginning
        await rendition.display(savedCfi ?? physAnchor?.cfi ?? undefined)

        rendition.on('rendered', () => {
          const s = settingsRef.current
          applyTheme(rendition, s.theme, s.fontId, s.fontSize)
          injectTapToMark(rendition)
        })

        rendition.on('locationChanged', (loc: any) => {
          const pct = book.locations?.percentageFromCfi?.(loc.start.cfi) ?? 0
          setProgress(Math.round(pct * 100))
          localStorage.setItem(`epub_cfi_${userBook.id}`, loc.start.cfi)
          book.loaded.navigation.then((nav: any) => {
            const flat = flattenToc(nav?.toc ?? [])
            const match = flat.find((item: any) => item.href && loc.start.href?.includes(item.href.split('#')[0]))
            if (match) setChapterName(match.label?.trim() ?? '')
          })
        })

        rendition.on('selected', (cfiRange: string, contents: any) => {
          const sel = contents.window.getSelection()
          const text = sel?.toString().trim() ?? ''
          if (text.length > 3) setSelection({ text, cfi: cfiRange })
          else setSelection(null)
        })

        rendition.on('click', () => {
          setSelection(sel => {
            if (sel) return sel
            showBarsRef.current = !showBarsRef.current
            setShowBars(showBarsRef.current)
            return null
          })
        })

        book.ready.then(() => {
          book.locations.generate(1024).then(() => {
            // Navigate to physical session progress if no epub position exists yet
            if (!savedCfi && !physAnchor?.cfi && physAnchor?.progress && physAnchor.progress > 0) {
              const targetCfi = book.locations.cfiFromPercentage(physAnchor.progress)
              if (targetCfi) rendRef.current?.display(targetCfi).catch(() => {})
            }
          }).catch(() => {})
        })

        if (!cancelled) {
          setReady(true)
          // Show "last physical position" banner when opening epub for first time after a physical session
          if (!savedCfi && physAnchor?.sentence) {
            const preview = physAnchor.sentence.length > 90
              ? physAnchor.sentence.slice(0, 90) + '…'
              : physAnchor.sentence
            setAnchorBannerText(preview)
            setShowAnchorBanner(true)
          }
        }
      } catch (e) {
        if (!cancelled) setError(String(e))
      }
    }

    load()
    return () => {
      cancelled = true
      try { rendRef.current?.destroy?.() } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epubPath, user])

  useEffect(() => {
    if (rendRef.current && ready) {
      applyTheme(rendRef.current, themeId, fontId, fontSize)
    }
  }, [themeId, fontId, fontSize, ready, applyTheme])

  // Margin changes resize the viewer container → tell epubjs to recalculate columns
  useEffect(() => {
    if (rendRef.current && ready) {
      rendRef.current.resize?.()
    }
  }, [marginH, ready])

  // ── Navigation ─────────────────────────────────────────────────────────────────
  const goNext = () => { rendRef.current?.next(); setSelection(null) }
  const goPrev = () => { rendRef.current?.prev(); setSelection(null) }

  // ── Highlight / note ───────────────────────────────────────────────────────────
  const saveHighlight = async (withNote: string) => {
    if (!selection || !user || !userBook) return
    const fillColor = themeId === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'
    rendRef.current?.annotations?.add(
      'highlight', selection.cfi, {}, undefined, 'highlight',
      { fill: fillColor, 'fill-opacity': '1', 'mix-blend-mode': 'multiply' }
    )
    await supabase.from('book_notes').insert({
      user_id: user.id, book_id: userBook.book_id,
      content: withNote.trim() ? `${selection.text}\n\n${withNote.trim()}` : selection.text,
      page_number: null,
    })
    setSelection(null); setNoteText(''); setShowNoteInput(false)
    setNoteSaved(true); setTimeout(() => setNoteSaved(false), 2000)
  }

  // ── Mark position (pre-fill anchor for end modal) ─────────────────────────────
  const markPosition = () => {
    if (!selection) return
    setAnchorSentence(selection.text)
    setAnchorCfi(selection.cfi)
    setSelection(null)
    if (awaitingAnchor) {
      setAwaitingAnchor(false)
      setShowEnd(true)
    } else {
      setPositionMarked(true)
      setTimeout(() => setPositionMarked(false), 2000)
    }
  }

  // ── Session end ────────────────────────────────────────────────────────────────
  const openEndModal = () => {
    if (running) pause()
    setShowSettings(false)
    // Auto-fill anchor from the current visible epub text (saves iOS users from fighting the native copy menu)
    if (!anchorSentence) {
      try {
        const contents = rendRef.current?.getContents()
        if (contents?.length) {
          const doc = contents[0].document as Document | undefined
          const nodes = Array.from(doc?.querySelectorAll('p, li, blockquote') ?? [])
          for (const node of nodes) {
            const text = (node as HTMLElement).innerText?.trim()
            if (text && text.length > 30) {
              setAnchorSentence(text.slice(0, 300))
              break
            }
          }
        }
      } catch { /* ignore */ }
    }
    setShowEnd(true)
  }

  const saveSession = async () => {
    if (!anchorSentence.trim()) { setAnchorError(true); return }
    if (!user || !userBook) return
    setSaving(true)
    const duration = accRef.current
    const prog = progress / 100
    const physPages = totalPages > 0 ? Math.round(prog * totalPages) : null
    await supabase.from('reading_sessions').insert({
      user_id: user.id, book_id: userBook.book_id,
      started_at: new Date(Date.now() - duration * 1000).toISOString(),
      ended_at: new Date().toISOString(),
      duration_seconds: duration,
      session_type: 'epub',
      epub_cfi_end: anchorCfi || null,
      last_sentence: anchorSentence.trim(),
      chapter_name: chapterName || null,
      pages_read: null, start_page: null, end_page: physPages,
    })
    await supabase.from('user_books').update({ progress_pct: prog, current_page: physPages }).eq('id', userBook.id)
    if (endNote.trim()) {
      await supabase.from('book_notes').insert({
        user_id: user.id, book_id: userBook.book_id,
        page_number: physPages,
        content: endNote.trim(),
      })
    }
    localStorage.setItem(`epub_anchor_${userBook.book_id}`, JSON.stringify({
      sentence: anchorSentence.trim(), chapter: chapterName, cfi: anchorCfi, progress: prog,
    }))
    setSaving(false)
    navigate(-1)
  }

  // ── Guards ─────────────────────────────────────────────────────────────────────
  if (!userBook || !epubPath) {
    return (
      <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#888', fontSize: 14 }}>No book selected</div>
      </div>
    )
  }
  if (error) {
    return (
      <div style={{ minHeight: '100dvh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ color: '#EF4444', fontSize: 14, textAlign: 'center' }}>{error}</div>
        <button onClick={() => navigate(-1)} style={{ padding: '10px 20px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, color: '#fff', fontSize: 14 }}>Go Back</button>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100dvh', background: T.bg, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', transition: 'background 0.25s' }}>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .epub-top {
          padding-top: max(12px, env(safe-area-inset-top));
        }
        .epub-bottom {
          padding-bottom: max(12px, env(safe-area-inset-bottom));
        }
        .epub-viewer-wrap {
          margin-top: calc(var(--top-h, 57px) + env(safe-area-inset-top));
          margin-bottom: var(--bot-h, 52px);
          transition: margin 0.25s ease, opacity 0.35s;
        }
      `}</style>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="epub-top" style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
        background: T.uiBg, borderBottom: `1px solid ${T.uiBorder}`,
        paddingLeft: 14, paddingRight: 14, paddingBottom: 10,
        display: 'flex', alignItems: 'center', gap: 10,
        transform: showBars ? 'translateY(0)' : 'translateY(-110%)',
        transition: 'transform 0.25s ease',
        boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
      }}>
        <button onClick={() => navigate(-1)} style={iconBtn(T)}>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
            <path d="M6 1L1 6L6 11" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          {chapterName && <div style={{ fontSize: 10, color: T.muted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chapterName}</div>}
        </div>
        <button onClick={running ? pause : resume} style={iconBtn(T)}>
          {running
            ? <svg width="10" height="12" viewBox="0 0 10 12" fill="none"><rect x="1" y="1" width="3" height="10" rx="1" fill={T.muted}/><rect x="6" y="1" width="3" height="10" rx="1" fill={T.muted}/></svg>
            : <svg width="10" height="12" viewBox="0 0 10 12" fill="none"><path d="M1 1l8 5-8 5V1z" fill={T.muted}/></svg>
          }
        </button>
        <div style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: running ? '#22C55E' : T.muted, flexShrink: 0 }}>{fmtTime(secs)}</div>
        <button onClick={openEndModal} style={{ padding: '6px 14px', background: T.fg, color: T.bg, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, flexShrink: 0, cursor: 'pointer' }}>End</button>
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: showBars ? 'calc(var(--top-h,57px) + env(safe-area-inset-top))' : 0, left: 0, right: 0, height: 2, zIndex: 29, background: T.uiBorder, transition: 'top 0.25s ease' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: T.fg, opacity: 0.4, transition: 'width 0.5s ease' }} />
      </div>

      {/* ── Loading overlay ───────────────────────────────────────────────────── */}
      {!ready && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, gap: 12 }}>
          <div style={{ width: 24, height: 24, border: `2px solid ${T.uiBorder}`, borderTopColor: T.fg, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <div style={{ color: T.muted, fontSize: 13 }}>Loading book…</div>
        </div>
      )}

      {/* ── ePub viewer ──────────────────────────────────────────────────────── */}
      <div ref={viewerRef} className="epub-viewer-wrap"
        style={{ flex: 1, opacity: ready ? 1 : 0, paddingLeft: marginH, paddingRight: marginH }} />

      {/* ── Prev / Next tap zones ─────────────────────────────────────────────── */}
      <button onClick={goPrev} style={{ position: 'absolute', left: 0, top: '15%', bottom: '15%', width: 52, background: 'transparent', border: 'none', zIndex: 20, cursor: 'pointer' }} aria-label="Previous page" />
      <button onClick={goNext} style={{ position: 'absolute', right: 0, top: '15%', bottom: '15%', width: 52, background: 'transparent', border: 'none', zIndex: 20, cursor: 'pointer' }} aria-label="Next page" />

      {/* ── Bottom bar ───────────────────────────────────────────────────────── */}
      <div className="epub-bottom" style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
        background: T.uiBg, borderTop: `1px solid ${T.uiBorder}`,
        paddingTop: 10, paddingLeft: 20, paddingRight: 20,
        display: 'flex', alignItems: 'center', gap: 14,
        transform: showBars ? 'translateY(0)' : 'translateY(110%)',
        transition: 'transform 0.25s ease',
      }}>
        <div style={{ fontSize: 12, color: T.muted, flexShrink: 0 }}>{progress}%</div>
        <div style={{ flex: 1, height: 3, background: T.uiBorder, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: T.fg, opacity: 0.4, borderRadius: 2, transition: 'width 0.5s ease' }} />
        </div>
        {/* "Aa" settings button — universally understood as typography/display settings */}
        <button onClick={() => setShowSettings(s => !s)} style={{
          ...iconBtn(T, showSettings),
          fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: showSettings ? 700 : 400,
          color: showSettings ? T.fg : T.muted, border: `1px solid ${showSettings ? T.fg : T.uiBorder}`,
        }} title="Display settings">
          Aa
        </button>
      </div>

      {/* ── "Position marked" toast ───────────────────────────────────────────── */}
      {positionMarked && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: T.fg, color: T.bg, padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500, zIndex: 60, whiteSpace: 'nowrap' }}>
          ✓ Last position marked
        </div>
      )}

      {/* ── "Awaiting anchor" instruction banner ─────────────────────────────── */}
      {awaitingAnchor && !showEnd && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 55, background: T.fg, color: T.bg, padding: '14px 20px', paddingBottom: 'calc(14px + env(safe-area-inset-bottom))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Select the last sentence you read</div>
            <div style={{ fontSize: 11, opacity: 0.65 }}>Tap the paragraph where you stopped</div>
          </div>
          <button onClick={() => { setAwaitingAnchor(false); setShowEnd(true) }} style={{ padding: '8px 14px', background: T.bg, color: T.fg, border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
            Skip
          </button>
        </div>
      )}

      {/* ── Settings bottom sheet ─────────────────────────────────────────────── */}
      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 45, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={() => setShowSettings(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: T.uiBg, borderRadius: '20px 20px 0 0', padding: '20px 20px 36px', boxShadow: '0 -4px 30px rgba(0,0,0,0.2)', maxHeight: '70dvh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: T.uiBorder, margin: '0 auto 20px' }} />

            {/* Font size */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: T.muted, marginBottom: 12 }}>Font size</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => setSettings(s => ({ ...s, fontSize: Math.max(12, s.fontSize - 2) }))} style={sizeBtnStyle(T)}>
                  <span style={{ fontSize: 16, lineHeight: 1, color: T.fg }}>A</span>
                </button>
                <div style={{ flex: 1, position: 'relative', height: 28, display: 'flex', alignItems: 'center' }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, height: 3, background: T.uiBorder, borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${((fontSize - 12) / 16) * 100}%`, background: T.fg, opacity: 0.5, borderRadius: 2, transition: 'width 0.15s' }} />
                  </div>
                  <input type="range" min={12} max={28} step={1} value={fontSize}
                    onChange={e => setSettings(s => ({ ...s, fontSize: parseInt(e.target.value) }))}
                    style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', height: '100%', margin: 0 }} />
                </div>
                <button onClick={() => setSettings(s => ({ ...s, fontSize: Math.min(28, s.fontSize + 2) }))} style={sizeBtnStyle(T)}>
                  <span style={{ fontSize: 22, lineHeight: 1, color: T.fg }}>A</span>
                </button>
                <span style={{ fontSize: 12, color: T.muted, minWidth: 32, textAlign: 'right' }}>{fontSize}px</span>
              </div>
            </div>

            {/* Margins */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: T.muted, marginBottom: 12 }}>Margins</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => setSettings(s => ({ ...s, marginH: Math.max(0, (s.marginH ?? 20) - 5) }))} style={sizeBtnStyle(T)}>
                  <span style={{ fontSize: 18, lineHeight: 1, color: T.fg }}>←</span>
                </button>
                <div style={{ flex: 1, position: 'relative', height: 28, display: 'flex', alignItems: 'center' }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, height: 3, background: T.uiBorder, borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${((marginH) / 60) * 100}%`, background: T.fg, opacity: 0.5, borderRadius: 2, transition: 'width 0.15s' }} />
                  </div>
                  <input type="range" min={0} max={60} step={5} value={marginH}
                    onChange={e => setSettings(s => ({ ...s, marginH: parseInt(e.target.value) }))}
                    style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', height: '100%', margin: 0 }} />
                </div>
                <button onClick={() => setSettings(s => ({ ...s, marginH: Math.min(60, (s.marginH ?? 20) + 5) }))} style={sizeBtnStyle(T)}>
                  <span style={{ fontSize: 18, lineHeight: 1, color: T.fg }}>→</span>
                </button>
                <span style={{ fontSize: 12, color: T.muted, minWidth: 32, textAlign: 'right' }}>{marginH}px</span>
              </div>
            </div>

            {/* Typeface */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: T.muted, marginBottom: 12 }}>Typeface</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {(Object.keys(FONTS) as FontId[]).map(fid => (
                  <button key={fid} onClick={() => setSettings(s => ({ ...s, fontId: fid }))} style={{
                    flex: 1, padding: '12px 8px', borderRadius: 12,
                    background: fontId === fid ? `${T.fg}10` : T.bg,
                    border: `2px solid ${fontId === fid ? T.fg : T.uiBorder}`,
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}>
                    <span style={{ fontSize: 22, fontFamily: FONTS[fid].css, color: T.fg, lineHeight: 1 }}>Aa</span>
                    <span style={{ fontSize: 10, color: fontId === fid ? T.fg : T.muted, fontWeight: fontId === fid ? 700 : 400 }}>{FONTS[fid].label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Theme */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: T.muted, marginBottom: 12 }}>Theme</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {(Object.keys(THEMES) as ThemeId[]).map(tid => (
                  <button key={tid} onClick={() => setSettings(s => ({ ...s, theme: tid }))} style={{
                    flex: 1, padding: '12px 8px', borderRadius: 12,
                    background: THEMES[tid].bg,
                    border: `2px solid ${themeId === tid ? THEMES[tid].fg : THEMES[tid].uiBorder}`,
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: THEMES[tid].fg }}>{THEMES[tid].name}</span>
                    <span style={{ fontSize: 11, color: THEMES[tid].muted, fontFamily: 'Georgia, serif' }}>Aa</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Selection toolbar ─────────────────────────────────────────────────── */}
      {selection && !showSettings && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40, background: T.uiBg, borderTop: `1px solid ${T.uiBorder}`, padding: '12px 14px 28px', boxShadow: '0 -4px 20px rgba(0,0,0,0.12)' }}>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
            "{selection.text.length > 70 ? selection.text.slice(0, 70) + '…' : selection.text}"
          </div>
          {noteSaved ? (
            <div style={{ fontSize: 13, color: '#22C55E', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke="#22C55E" strokeWidth="1.3" fill="none"/><path d="M4 7l2.5 2.5L10 5" stroke="#22C55E" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Saved to notes
            </div>
          ) : showNoteInput ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note…" rows={2} autoFocus
                style={{ width: '100%', padding: '8px 10px', background: T.bg, border: `1px solid ${T.uiBorder}`, borderRadius: 8, fontSize: 13, color: T.fg, resize: 'none', outline: 'none' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => saveHighlight(noteText)} style={{ flex: 1, padding: '10px', background: T.fg, color: T.bg, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save</button>
                <button onClick={() => { setShowNoteInput(false); setNoteText('') }} style={{ padding: '10px 16px', background: 'transparent', border: `1px solid ${T.uiBorder}`, borderRadius: 8, fontSize: 13, color: T.muted, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => saveHighlight('')} style={{ flex: 1, padding: '10px 6px', background: `${T.fg}10`, color: T.fg, border: `1px solid ${T.uiBorder}`, borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Highlight
              </button>
              <button onClick={() => setShowNoteInput(true)} style={{ flex: 1, padding: '10px 6px', background: T.bg, color: T.fg, border: `1px solid ${T.uiBorder}`, borderRadius: 10, fontSize: 12, cursor: 'pointer' }}>
                + Note
              </button>
              <button onClick={markPosition} style={{ flex: 1, padding: '10px 6px', background: T.bg, color: T.muted, border: `1px solid ${T.uiBorder}`, borderRadius: 10, fontSize: 12, cursor: 'pointer' }}>
                Mark end
              </button>
              <button onClick={() => setSelection(null)} style={{ width: 38, background: 'transparent', border: `1px solid ${T.uiBorder}`, borderRadius: 10, color: T.muted, fontSize: 18, cursor: 'pointer' }}>×</button>
            </div>
          )}
        </div>
      )}

      {/* ── Last physical position banner ────────────────────────────────────── */}
      {showAnchorBanner && anchorBannerText && (
        <div style={{ position: 'absolute', bottom: showBars ? 70 : 20, left: 16, right: 16, zIndex: 35, background: T.uiBg, border: `1px solid ${T.uiBorder}`, borderRadius: 12, padding: '10px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: T.muted, marginBottom: 3 }}>Last physical position</div>
            <div style={{ fontSize: 12, color: T.fg, fontStyle: 'italic', lineHeight: 1.4 }}>"{anchorBannerText}"</div>
          </div>
          <button onClick={() => setShowAnchorBanner(false)} style={{ background: 'none', border: 'none', color: T.muted, fontSize: 20, lineHeight: 1, cursor: 'pointer', flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* ── End session modal ─────────────────────────────────────────────────── */}
      {showEnd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ width: '100%', background: T.uiBg, borderRadius: '20px 20px 0 0', padding: '28px 20px 40px', maxHeight: '85dvh', overflowY: 'auto', boxShadow: '0 -4px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: T.fg, marginBottom: 4 }}>End Session</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 22 }}>{fmtTime(accRef.current)} · {progress}% complete</div>

            {/* Last sentence — required */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: anchorError ? '#EF4444' : T.muted, marginBottom: 4 }}>
                Last sentence *
              </div>
              {anchorSentence ? (
                <div style={{ padding: '10px 12px', background: `${T.fg}08`, border: `1px solid ${T.uiBorder}`, borderRadius: 10, fontSize: 13, color: T.fg, fontStyle: 'italic', marginBottom: 8, lineHeight: 1.55 }}>
                  "{anchorSentence.slice(0, 120)}{anchorSentence.length > 120 ? '…' : ''}"
                  <button onClick={() => { setAnchorSentence(''); setAnchorCfi('') }} style={{ marginLeft: 8, background: 'none', border: 'none', color: T.muted, fontSize: 12, cursor: 'pointer' }}>change</button>
                </div>
              ) : (
                <>
                  {/* Primary action: go back and select text */}
                  <button onClick={() => { setShowEnd(false); setAwaitingAnchor(true) }} style={{ width: '100%', padding: '12px', background: `${T.fg}10`, border: `1.5px dashed ${T.fg}40`, borderRadius: 10, fontSize: 13, color: T.fg, cursor: 'pointer', marginBottom: 10, textAlign: 'center', fontWeight: 500 }}>
                    ← Go select text in book
                  </button>
                  <div style={{ fontSize: 11, color: T.muted, textAlign: 'center', marginBottom: 8 }}>or type it manually</div>
                  <textarea value={anchorSentence} onChange={e => { setAnchorSentence(e.target.value); setAnchorError(false) }}
                    placeholder="Paste the last sentence you read…" rows={2}
                    style={{ width: '100%', padding: '10px 12px', background: T.bg, border: `1.5px solid ${anchorError ? '#EF4444' : T.uiBorder}`, borderRadius: 10, fontSize: 13, color: T.fg, resize: 'none', outline: 'none' }} />
                </>
              )}
              {anchorError && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>Required — helps locate your place in the physical book</div>}
            </div>

            {/* Note — optional */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: T.muted, marginBottom: 8 }}>Quick note (optional)</div>
              <textarea value={endNote} onChange={e => setEndNote(e.target.value)} placeholder="Any thoughts or highlights…" rows={3}
                style={{ width: '100%', padding: '10px 12px', background: T.bg, border: `1px solid ${T.uiBorder}`, borderRadius: 10, fontSize: 13, color: T.fg, resize: 'none', outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={saveSession} disabled={saving} style={{ padding: '14px', background: T.fg, color: T.bg, border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save session'}
              </button>
              <button onClick={() => { setShowEnd(false); if (!running) resume() }} style={{ padding: '12px', background: 'transparent', border: `1px solid ${T.uiBorder}`, borderRadius: 12, fontSize: 14, color: T.muted, cursor: 'pointer' }}>
                Keep reading
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Style helpers ─────────────────────────────────────────────────────────────
function iconBtn(T: typeof THEMES[ThemeId], active = false): React.CSSProperties {
  return {
    width: 34, height: 34, borderRadius: '50%',
    background: active ? `${T.fg}10` : T.uiBg,
    border: `1px solid ${active ? T.fg : T.uiBorder}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, cursor: 'pointer',
  }
}
function sizeBtnStyle(T: typeof THEMES[ThemeId]): React.CSSProperties {
  return {
    width: 38, height: 38, borderRadius: 10, background: T.uiBg,
    border: `1px solid ${T.uiBorder}`, display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: T.fg,
  }
}
