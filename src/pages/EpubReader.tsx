import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import type { UserBook } from '../types'

// ─── Types ────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EpubBook = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rendition = any

// ─── Reader themes ────────────────────────────────────────────────────────────
type ThemeId = 'light' | 'dark' | 'sepia'

const THEMES: Record<ThemeId, {
  bg: string; fg: string; muted: string; accent: string
  uiBg: string; uiBorder: string; uiMuted: string; name: string
}> = {
  light: {
    bg: '#ffffff', fg: '#1a1a1a', muted: '#888', accent: '#7C3AED',
    uiBg: '#ffffff', uiBorder: 'rgba(0,0,0,0.1)', uiMuted: '#888', name: 'Light',
  },
  sepia: {
    bg: '#f4ead8', fg: '#3b2e1e', muted: '#8a7560', accent: '#7C3AED',
    uiBg: '#ede3cc', uiBorder: 'rgba(91,70,54,0.15)', uiMuted: '#9a8570', name: 'Sepia',
  },
  dark: {
    bg: '#111111', fg: '#e8e6e1', muted: 'rgba(232,230,225,0.45)', accent: '#a78bfa',
    uiBg: '#1a1a1a', uiBorder: 'rgba(255,255,255,0.1)', uiMuted: 'rgba(255,255,255,0.4)', name: 'Dark',
  },
}

// CSS injected into the epub iframe per theme
const EPUB_CSS: Record<ThemeId, string> = {
  light: `
    html, body { background-color: #ffffff !important; color: #1a1a1a !important; }
    * { color: #1a1a1a !important; background-color: transparent !important; }
    a { color: #7C3AED !important; }
    img { max-width: 100% !important; height: auto !important; }
  `,
  sepia: `
    html, body { background-color: #f4ead8 !important; color: #3b2e1e !important; }
    * { color: #3b2e1e !important; background-color: transparent !important; }
    a { color: #7C3AED !important; }
    img { max-width: 100% !important; height: auto !important; }
  `,
  dark: `
    html, body { background-color: #111111 !important; color: #e8e6e1 !important; }
    * { color: #e8e6e1 !important; background-color: transparent !important; }
    a { color: #a78bfa !important; }
    img { max-width: 100% !important; height: auto !important; filter: brightness(0.85); }
    p, span, div, li, td, th, h1, h2, h3, h4, h5, h6 { color: #e8e6e1 !important; }
  `,
}

type FontId = 'serif' | 'sans' | 'mono'
const FONTS: Record<FontId, { label: string; css: string; preview: string }> = {
  serif:  { label: 'Serif',  css: 'Georgia, "Times New Roman", serif',          preview: 'Aa' },
  sans:   { label: 'Sans',   css: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', preview: 'Aa' },
  mono:   { label: 'Mono',   css: '"Courier New", Courier, monospace',           preview: 'Aa' },
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
const SETTINGS_KEY = 'epub_reader_settings'
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return JSON.parse(raw) as { theme: ThemeId; fontSize: number; fontId: FontId }
  } catch { /* ignore */ }
  return { theme: 'light' as ThemeId, fontSize: 18, fontId: 'serif' as FontId }
}
function saveSettings(s: { theme: ThemeId; fontSize: number; fontId: FontId }) {
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
  const setSettings = useCallback((fn: (prev: typeof settings) => typeof settings) => {
    _setSettings(prev => {
      const next = fn(prev)
      settingsRef.current = next
      saveSettings(next)
      return next
    })
  }, [])
  const { theme: themeId, fontSize, fontId } = settings
  const T = THEMES[themeId]

  // ── Session timer ──
  const startRef    = useRef(Date.now())
  const accRef      = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [secs, setSecs]       = useState(0)
  const [running, setRunning] = useState(true)

  // ── Reader state ──
  const [ready, setReady]           = useState(false)
  const [progress, setProgress]     = useState(0)
  const [chapterName, setChapterName] = useState('')
  const [error, setError]           = useState<string | null>(null)

  // ── UI panels ──
  const [showBars, setShowBars]     = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showEnd, setShowEnd]       = useState(false)
  const showBarsRef = useRef(true)

  // ── Highlight / note ──
  const [selection, setSelection]       = useState<SelectionState | null>(null)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteText, setNoteText]         = useState('')
  const [noteSaved, setNoteSaved]       = useState(false)

  // ── Session end anchor ──
  const [anchorSentence, setAnchorSentence] = useState('')
  const [anchorCfi, setAnchorCfi]           = useState('')
  const [anchorError, setAnchorError]       = useState(false)
  const [saving, setSaving]                 = useState(false)

  const bookMeta  = userBook?.book as { title?: string } | undefined
  const title     = bookMeta?.title ?? 'Book'
  const totalPages = userBook?.custom_pages ?? (userBook?.book as any)?.pages_default ?? 0

  // ── Apply theme/font/size to rendition ───────────────────────────────────────
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

    // Inject raw CSS into each section's iframe
    rend.getContents().forEach((c: any) => {
      try {
        const existing = c.document?.getElementById('cc-injected-styles')
        if (existing) { existing.textContent = combined; return }
        const style = c.document?.createElement('style')
        if (!style) return
        style.id = 'cc-injected-styles'
        style.textContent = combined
        c.document?.head?.appendChild(style)
      } catch { /* iframe not ready yet */ }
    })
  }, [])

  // ── Timer ─────────────────────────────────────────────────────────────────────
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

  // ── Load ePub ─────────────────────────────────────────────────────────────────
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

        // Display saved position
        const savedCfi = localStorage.getItem(`epub_cfi_${userBook.id}`)
        await rendition.display(savedCfi ?? undefined)

        // Apply current settings immediately after first render
        rendition.on('rendered', () => {
          applyTheme(rendition, settingsRef.current.theme, settingsRef.current.fontId, settingsRef.current.fontSize)
        })

        // Track location → update progress + chapter + save CFI
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

        // Text selection → allow highlight or anchor
        rendition.on('selected', (cfiRange: string, contents: any) => {
          const sel = contents.window.getSelection()
          const text = sel?.toString().trim() ?? ''
          if (text.length > 3) setSelection({ text, cfi: cfiRange })
          else setSelection(null)
        })

        // Single tap = toggle bars (only if no selection active)
        rendition.on('click', () => {
          setSelection(sel => {
            if (sel) return sel  // keep selection visible
            showBarsRef.current = !showBarsRef.current
            setShowBars(showBarsRef.current)
            return null
          })
        })

        // Generate locations for % (non-blocking)
        book.ready.then(() => {
          book.locations.generate(1024).catch(() => {})
        })

        if (!cancelled) setReady(true)
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

  // Re-apply theme/font whenever settings change (after initial load)
  useEffect(() => {
    if (rendRef.current && ready) {
      applyTheme(rendRef.current, themeId, fontId, fontSize)
    }
  }, [themeId, fontId, fontSize, ready, applyTheme])

  // ── Navigation ────────────────────────────────────────────────────────────────
  const goNext = () => { rendRef.current?.next(); setSelection(null) }
  const goPrev = () => { rendRef.current?.prev(); setSelection(null) }

  // ── Highlight / note ──────────────────────────────────────────────────────────
  const saveHighlight = async (withNote: string) => {
    if (!selection || !user || !userBook) return
    rendRef.current?.annotations?.add(
      'highlight', selection.cfi, {}, undefined, 'highlight',
      { fill: '#7C3AED', 'fill-opacity': '0.28', 'mix-blend-mode': 'multiply' }
    )
    await supabase.from('book_notes').insert({
      user_id: user.id, book_id: userBook.book_id,
      content: withNote.trim() ? `${selection.text}\n\n${withNote.trim()}` : selection.text,
      epub_cfi: selection.cfi, is_highlight: true, page_number: null,
    })
    setSelection(null); setNoteText(''); setShowNoteInput(false)
    setNoteSaved(true); setTimeout(() => setNoteSaved(false), 2000)
  }

  // ── Session end ───────────────────────────────────────────────────────────────
  const openEndModal = () => {
    if (running) pause()
    if (selection) { setAnchorSentence(selection.text); setAnchorCfi(selection.cfi) }
    setShowSettings(false)
    setShowEnd(true)
  }

  const saveSession = async () => {
    if (!anchorSentence.trim()) { setAnchorError(true); return }
    if (!user || !userBook) return
    setSaving(true)
    await supabase.auth.refreshSession()
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
    localStorage.setItem(`epub_anchor_${userBook.book_id}`, JSON.stringify({
      sentence: anchorSentence.trim(), chapter: chapterName, cfi: anchorCfi, progress: prog,
    }))
    setSaving(false)
    navigate(-1)
  }

  // ── Guards ────────────────────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100dvh', background: T.bg, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', transition: 'background 0.25s' }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
        background: T.uiBg, borderBottom: `1px solid ${T.uiBorder}`,
        padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
        transform: showBars ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform 0.25s ease',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}>
        <button onClick={() => navigate(-1)} style={iconBtn(T)}>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          {chapterName && <div style={{ fontSize: 10, color: T.muted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chapterName}</div>}
        </div>

        {/* Timer */}
        <div style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: running ? '#22C55E' : T.muted, flexShrink: 0 }}>{fmtTime(secs)}</div>

        {/* Pause / Resume */}
        <button onClick={running ? pause : resume} style={iconBtn(T)} title={running ? 'Pause' : 'Resume'}>
          {running
            ? <svg width="10" height="12" viewBox="0 0 10 12" fill="none"><rect x="1" y="1" width="3" height="10" rx="1" fill={T.muted}/><rect x="6" y="1" width="3" height="10" rx="1" fill={T.muted}/></svg>
            : <svg width="10" height="12" viewBox="0 0 10 12" fill="none"><path d="M1 1l8 5-8 5V1z" fill={T.muted}/></svg>
          }
        </button>

        {/* Settings */}
        <button onClick={() => setShowSettings(s => !s)} style={iconBtn(T, showSettings)} title="Display settings">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2.5" stroke={showSettings ? T.accent : T.muted} strokeWidth="1.3"/>
            <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.8 2.8l1.1 1.1M10.1 10.1l1.1 1.1M2.8 11.2l1.1-1.1M10.1 3.9l1.1-1.1" stroke={showSettings ? T.accent : T.muted} strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>

        {/* End session */}
        <button onClick={openEndModal} style={{ padding: '6px 12px', background: T.accent, color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, flexShrink: 0, cursor: 'pointer' }}>End</button>
      </div>

      {/* ── Progress bar ────────────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: showBars ? 57 : 0, left: 0, right: 0, height: 2, zIndex: 29, background: T.uiBorder, transition: 'top 0.25s ease' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: T.accent, transition: 'width 0.4s ease' }} />
      </div>

      {/* ── Settings sheet ───────────────────────────────────────────────────── */}
      {showSettings && (
        <div style={{
          position: 'absolute', top: 59, left: 0, right: 0, zIndex: 28,
          background: T.uiBg, borderBottom: `1px solid ${T.uiBorder}`,
          padding: '16px 18px 18px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}>
          {/* Font size */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: T.muted, marginBottom: 10 }}>Font size</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button
                onClick={() => setSettings(s => ({ ...s, fontSize: Math.max(12, s.fontSize - 2) }))}
                style={sizeBtnStyle(T)}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>A</span>
              </button>
              <div style={{ flex: 1, height: 3, background: T.uiBorder, borderRadius: 2, position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, height: '100%', width: `${((fontSize - 12) / 16) * 100}%`, background: T.accent, borderRadius: 2, transition: 'width 0.15s' }} />
                <input
                  type="range" min={12} max={28} step={1} value={fontSize}
                  onChange={e => setSettings(s => ({ ...s, fontSize: parseInt(e.target.value) }))}
                  style={{ position: 'absolute', inset: '-8px 0', width: '100%', opacity: 0, cursor: 'pointer', margin: 0 }}
                />
              </div>
              <button
                onClick={() => setSettings(s => ({ ...s, fontSize: Math.min(28, s.fontSize + 2) }))}
                style={sizeBtnStyle(T)}>
                <span style={{ fontSize: 24, lineHeight: 1 }}>A</span>
              </button>
              <span style={{ fontSize: 12, color: T.muted, minWidth: 28, textAlign: 'right' }}>{fontSize}px</span>
            </div>
          </div>

          {/* Font family */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: T.muted, marginBottom: 10 }}>Typeface</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(Object.keys(FONTS) as FontId[]).map(fid => (
                <button key={fid}
                  onClick={() => setSettings(s => ({ ...s, fontId: fid }))}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: 10,
                    background: fontId === fid ? `${T.accent}18` : T.uiBg,
                    border: `1.5px solid ${fontId === fid ? T.accent : T.uiBorder}`,
                    cursor: 'pointer',
                  }}>
                  <div style={{ fontSize: 18, fontFamily: FONTS[fid].css, color: T.fg, lineHeight: 1, marginBottom: 4 }}>{FONTS[fid].preview}</div>
                  <div style={{ fontSize: 10, color: fontId === fid ? T.accent : T.muted, fontWeight: 600 }}>{FONTS[fid].label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: T.muted, marginBottom: 10 }}>Theme</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(Object.keys(THEMES) as ThemeId[]).map(tid => (
                <button key={tid}
                  onClick={() => setSettings(s => ({ ...s, theme: tid }))}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: 10,
                    background: THEMES[tid].bg,
                    border: `2px solid ${themeId === tid ? T.accent : THEMES[tid].uiBorder}`,
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: THEMES[tid].fg }}>{THEMES[tid].name}</span>
                  <span style={{ fontSize: 10, color: THEMES[tid].muted }}>Aa</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Loading overlay ──────────────────────────────────────────────────── */}
      {!ready && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, gap: 12 }}>
          <div style={{ width: 24, height: 24, border: `2px solid ${T.muted}`, borderTopColor: T.accent, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <div style={{ color: T.muted, fontSize: 13 }}>Loading book…</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* ── ePub viewer ─────────────────────────────────────────────────────── */}
      <div ref={viewerRef} style={{ flex: 1, opacity: ready ? 1 : 0, marginTop: showBars ? 59 : 2, marginBottom: selection ? 120 : 0, transition: 'opacity 0.4s, margin 0.25s ease' }} />

      {/* ── Prev / Next tap zones ────────────────────────────────────────────── */}
      <button onClick={goPrev} style={{ position: 'absolute', left: 0, top: 80, bottom: selection ? 200 : 80, width: 52, background: 'transparent', border: 'none', zIndex: 20, cursor: 'pointer' }} aria-label="Previous page" />
      <button onClick={goNext} style={{ position: 'absolute', right: 0, top: 80, bottom: selection ? 200 : 80, width: 52, background: 'transparent', border: 'none', zIndex: 20, cursor: 'pointer' }} aria-label="Next page" />

      {/* ── Bottom page counter ──────────────────────────────────────────────── */}
      {showBars && !selection && (
        <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 20, pointerEvents: 'none' }}>
          <div style={{ fontSize: 11, color: T.muted, background: T.uiBg, border: `1px solid ${T.uiBorder}`, borderRadius: 20, padding: '4px 12px' }}>{progress}%</div>
        </div>
      )}

      {/* ── Selection toolbar ────────────────────────────────────────────────── */}
      {selection && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40, background: T.uiBg, borderTop: `1px solid ${T.uiBorder}`, padding: '14px 16px', boxShadow: '0 -4px 20px rgba(0,0,0,0.12)' }}>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
            "{selection.text.length > 80 ? selection.text.slice(0, 80) + '…' : selection.text}"
          </div>
          {noteSaved ? (
            <div style={{ fontSize: 13, color: '#22C55E', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke="#22C55E" strokeWidth="1.3" fill="none"/><path d="M4 7l2.5 2.5L10 5" stroke="#22C55E" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Saved to notes
            </div>
          ) : showNoteInput ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                value={noteText} onChange={e => setNoteText(e.target.value)}
                placeholder="Add a note…" rows={2} autoFocus
                style={{ width: '100%', padding: '8px 10px', background: T.bg, border: `1px solid ${T.uiBorder}`, borderRadius: 8, fontSize: 13, color: T.fg, resize: 'none', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => saveHighlight(noteText)} style={{ flex: 1, padding: '9px', background: T.accent, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save</button>
                <button onClick={() => { setShowNoteInput(false); setNoteText('') }} style={{ padding: '9px 16px', background: 'transparent', border: `1px solid ${T.uiBorder}`, borderRadius: 8, fontSize: 13, color: T.muted, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => saveHighlight('')} style={{ flex: 1, padding: '9px', background: `${T.accent}18`, color: T.accent, border: `1px solid ${T.accent}44`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 11l3-1 6-6-2-2-6 6-1 3z" stroke={T.accent} strokeWidth="1.2" strokeLinejoin="round"/></svg>
                Highlight
              </button>
              <button onClick={() => setShowNoteInput(true)} style={{ flex: 1, padding: '9px', background: T.uiBg, color: T.fg, border: `1px solid ${T.uiBorder}`, borderRadius: 8, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1.5" y="1.5" width="10" height="10" rx="2" stroke={T.muted} strokeWidth="1.2"/><path d="M4 5h5M4 7.5h3" stroke={T.muted} strokeWidth="1.2" strokeLinecap="round"/></svg>
                Add note
              </button>
              <button onClick={() => { setAnchorSentence(selection.text); setAnchorCfi(selection.cfi); setSelection(null) }} style={{ flex: 1, padding: '9px', background: T.uiBg, color: T.muted, border: `1px solid ${T.uiBorder}`, borderRadius: 8, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v11M1 6.5h11" stroke={T.muted} strokeWidth="1.3" strokeLinecap="round"/></svg>
                Anchor
              </button>
              <button onClick={() => setSelection(null)} style={{ width: 36, padding: '9px', background: 'transparent', border: `1px solid ${T.uiBorder}`, borderRadius: 8, color: T.muted, fontSize: 16, cursor: 'pointer' }}>×</button>
            </div>
          )}
        </div>
      )}

      {/* ── End session modal ────────────────────────────────────────────────── */}
      {showEnd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ width: '100%', background: T.uiBg, borderRadius: '20px 20px 0 0', padding: '28px 20px 40px', maxHeight: '82dvh', overflowY: 'auto', boxShadow: '0 -4px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: T.fg, marginBottom: 4 }}>End Reading Session</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 22 }}>{fmtTime(accRef.current)} · {progress}% complete</div>

            {/* Anchor — required */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: anchorError ? '#EF4444' : T.muted, marginBottom: 6 }}>
                Last sentence you read *
              </div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 10, lineHeight: 1.6 }}>
                Select text in the book first, then tap "Anchor" — or type it here. Helps you find your place in the physical copy.
              </div>

              {anchorSentence ? (
                <div style={{ padding: '10px 12px', background: `${T.accent}12`, border: `1px solid ${T.accent}44`, borderRadius: 10, fontSize: 13, color: T.fg, fontStyle: 'italic', marginBottom: 8, lineHeight: 1.55 }}>
                  "{anchorSentence.slice(0, 120)}{anchorSentence.length > 120 ? '…' : ''}"
                  <button onClick={() => { setAnchorSentence(''); setAnchorCfi('') }} style={{ marginLeft: 8, background: 'none', border: 'none', color: T.muted, fontSize: 12, cursor: 'pointer' }}>change</button>
                </div>
              ) : (
                <textarea
                  value={anchorSentence}
                  onChange={e => { setAnchorSentence(e.target.value); setAnchorError(false) }}
                  placeholder="Type or paste the last sentence…"
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', background: T.bg, border: `1.5px solid ${anchorError ? '#EF4444' : T.uiBorder}`, borderRadius: 10, fontSize: 13, color: T.fg, resize: 'none', outline: 'none' }}
                />
              )}
              {anchorError && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>Required — helps you locate your place in the physical book</div>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={saveSession} disabled={saving} style={{ padding: '14px', background: T.accent, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
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

// ─── Mini style helpers ────────────────────────────────────────────────────────
function iconBtn(T: typeof THEMES[ThemeId], active = false): React.CSSProperties {
  return {
    width: 34, height: 34, borderRadius: '50%',
    background: active ? `${T.accent}18` : T.uiBg,
    border: `1px solid ${active ? T.accent : T.uiBorder}`,
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
