import { useEffect, useRef, useState } from 'react'
import { useTheme, useAuth } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import SpineCaptureCamera from './SpineCaptureCamera'
import type { Theme } from '../types'

// ─── Design constants ─────────────────────────────────────────────────────────
const ROW_H = 178
const BOARD_H = 12
const DECK_H = ROW_H - BOARD_H
const ROWS_MAX = 6
const ROWS_DEFAULT = 3

const SPINE_SIZES = [
  { w: 33, h: 110 }, { w: 41, h: 134 }, { w: 35, h: 152 },
  { w: 47, h: 120 }, { w: 31, h: 142 }, { w: 39, h: 118 },
] as const

const SPINE_TONES = ['#1b1b1b', '#2e2e2e', '#444444', '#5a5a5a', '#7c7c7c', '#e7e3db']

// ─── Style presets ────────────────────────────────────────────────────────────
const WOOD_PRESETS = [
  { name: 'Dark',   top: '#4a3725', face: '#33261a', edge: '#221a11' },
  { name: 'Walnut', top: '#6b4f35', face: '#55402a', edge: '#3d2e1e' },
  { name: 'Oak',    top: '#b8885a', face: '#9e7044', edge: '#7a5632' },
  { name: 'Ash',    top: '#c4b89a', face: '#b5a888', edge: '#9a8e74' },
]

const WALL_PRESETS = [
  { name: 'Dark Grid',  bg: 'repeating-linear-gradient(90deg,#161616 0 3px,#181818 3px 6px)' },
  { name: 'Slate',      bg: 'repeating-linear-gradient(90deg,#1a1c22 0 3px,#1d2028 3px 6px)' },
  { name: 'Cream Grid', bg: 'repeating-linear-gradient(90deg,#edeae2 0 3px,#f2efe7 3px 6px)' },
  { name: 'Warm Stone', bg: '#2a2520' },
]

// Decoration types per shelf: 0=none, 1=bookend, 2=cactus, 3=globe, 4=trophy, 5=candle
const DECO_CYCLE = [0, 1, 2]

const DECO_ITEMS = [
  { id: 0, label: 'None' },
  { id: 1, label: 'Bookend' },
  { id: 2, label: 'Cactus' },
  { id: 3, label: 'Globe' },
  { id: 4, label: 'Trophy' },
  { id: 5, label: 'Candle' },
]

// ─── Types ────────────────────────────────────────────────────────────────────
type ShelfPos = { shelf: number; left: number; rot: number; scale: number }

interface ShelfConfig {
  woodIdx: number
  wallIdx: number
  decos: number[]  // index = shelf row
}

const DEFAULT_CONFIG: ShelfConfig = { woodIdx: 0, wallIdx: 0, decos: [] }

interface ShelfBook {
  userBookId: string
  title: string
  author: string
  coverUrl: string | null
  spineUrl: string | null
  pos: ShelfPos
}

interface LibBook {
  userBookId: string
  title: string
  author: string
  coverUrl: string | null
  spineUrl: string | null
}

type GestureState =
  | { type: 'drag'; id: string; grabOffset: number }
  | { type: 'rotate'; id: string; cx: number; cy: number; startAng: number; startRot: number }
  | { type: 'scale'; id: string; cx: number; cy: number; startDist: number; startScale: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hashStr(s: string): number {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return Math.abs(h)
}
const spineSize = (id: string) => SPINE_SIZES[hashStr(id) % SPINE_SIZES.length]
const spineTone = (id: string) => SPINE_TONES[(hashStr(id) * 3) % SPINE_TONES.length]
const isLightTone = (t: string) => t === '#7c7c7c' || t === '#e7e3db' || t === '#c4b89a' || t === '#b5a888'

// ─── Main component ───────────────────────────────────────────────────────────
export default function VirtualShelf() {
  const { theme } = useTheme()
  const { user } = useAuth()

  const [books, setBooks] = useState<ShelfBook[]>([])
  const [rows, setRows] = useState(ROWS_DEFAULT)
  const [selected, setSelected] = useState<string | null>(null)
  const [spineTarget, setSpineTarget] = useState<{ userBookId: string; title: string } | null>(null)
  const [spineSaving, setSpineSaving] = useState(false)
  const [showLibSheet, setShowLibSheet] = useState(false)
  const [libBooks, setLibBooks] = useState<LibBook[]>([])
  const [libLoading, setLibLoading] = useState(false)
  const [showStyleSheet, setShowStyleSheet] = useState(false)
  const [config, setConfig] = useState<ShelfConfig>(DEFAULT_CONFIG)

  const rowsRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<GestureState | null>(null)
  const [gesturing, setGesturing] = useState(false)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const board = WOOD_PRESETS[config.woodIdx] ?? WOOD_PRESETS[0]
  const wallBg = WALL_PRESETS[config.wallIdx]?.bg ?? WALL_PRESETS[0].bg
  const selectedBook = books.find(b => b.userBookId === selected) ?? null

  // ─── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const rowKey = `cc_shelf_rows_${user.id}`
    const cfgKey = `cc_shelf_cfg_${user.id}`
    const savedRows = parseInt(localStorage.getItem(rowKey) ?? '', 10)
    if (!isNaN(savedRows) && savedRows >= 1 && savedRows <= ROWS_MAX) setRows(savedRows)
    try {
      const savedCfg = JSON.parse(localStorage.getItem(cfgKey) ?? '{}')
      setConfig({ ...DEFAULT_CONFIG, ...savedCfg })
    } catch { /* ignore */ }

    ;(async () => {
      const { data } = await supabase
        .from('user_books')
        .select('id, spine_url, shelf_pos, book:books(title,author,cover_url)')
        .eq('user_id', user.id)
        .not('shelf_pos', 'is', null)
      if (!data) return
      setBooks((data as any[]).map(r => ({
        userBookId: r.id,
        title: r.book?.title ?? 'Unknown',
        author: r.book?.author ?? '',
        coverUrl: r.book?.cover_url ?? null,
        spineUrl: r.spine_url ?? null,
        pos: r.shelf_pos,
      })))
    })()
  }, [user])

  const saveRows = (n: number) => {
    if (user) localStorage.setItem(`cc_shelf_rows_${user.id}`, String(n))
  }

  const saveConfig = (next: ShelfConfig) => {
    setConfig(next)
    if (user) localStorage.setItem(`cc_shelf_cfg_${user.id}`, JSON.stringify(next))
  }

  const scheduleSave = (userBookId: string, pos: ShelfPos) => {
    clearTimeout(saveTimers.current[userBookId])
    saveTimers.current[userBookId] = setTimeout(() => {
      supabase.from('user_books').update({ shelf_pos: pos }).eq('id', userBookId).then(() => {})
    }, 600)
  }

  const updatePos = (id: string, patch: Partial<ShelfPos>) => {
    setBooks(prev => prev.map(b => {
      if (b.userBookId !== id) return b
      const newPos = { ...b.pos, ...patch }
      scheduleSave(id, newPos)
      return { ...b, pos: newPos }
    }))
  }

  // ─── Gestures ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gesturing) return
    const move = (e: PointerEvent) => {
      const g = gestureRef.current
      if (!g) return
      if (g.type === 'drag') {
        const el = rowsRef.current; if (!el) return
        const r = el.getBoundingClientRect()
        const shelf = Math.max(0, Math.min(rows - 1, Math.floor((e.clientY - r.top) / ROW_H)))
        const sz = spineSize(g.id)
        const left = Math.max(6, Math.min(e.clientX - r.left - g.grabOffset, el.offsetWidth - sz.w - 6))
        updatePos(g.id, { shelf, left })
      } else if (g.type === 'rotate') {
        const ang = Math.atan2(e.clientY - g.cy, e.clientX - g.cx) * 180 / Math.PI
        updatePos(g.id, { rot: Math.max(-30, Math.min(30, g.startRot + (ang - g.startAng))) })
      } else if (g.type === 'scale') {
        const dist = Math.hypot(e.clientX - g.cx, e.clientY - g.cy)
        updatePos(g.id, { scale: Math.max(0.7, Math.min(1.6, g.startScale * dist / Math.max(g.startDist, 10))) })
      }
    }
    const up = () => { gestureRef.current = null; setGesturing(false) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [gesturing, rows])

  const bodyDown = (e: React.PointerEvent, book: ShelfBook) => {
    e.stopPropagation()
    setSelected(book.userBookId)
    const el = rowsRef.current; if (!el) return
    gestureRef.current = { type: 'drag', id: book.userBookId, grabOffset: e.clientX - el.getBoundingClientRect().left - book.pos.left }
    setGesturing(true)
  }

  const rotateDown = (e: React.PointerEvent, book: ShelfBook) => {
    e.stopPropagation()
    const wrap = (e.currentTarget as HTMLElement).closest('[data-spine]') as HTMLElement
    const r = wrap.getBoundingClientRect()
    gestureRef.current = { type: 'rotate', id: book.userBookId, cx: r.left + r.width/2, cy: r.top + r.height/2, startAng: Math.atan2(e.clientY - (r.top+r.height/2), e.clientX - (r.left+r.width/2)) * 180/Math.PI, startRot: book.pos.rot }
    setGesturing(true)
  }

  const scaleDown = (e: React.PointerEvent, book: ShelfBook) => {
    e.stopPropagation()
    const wrap = (e.currentTarget as HTMLElement).closest('[data-spine]') as HTMLElement
    const r = wrap.getBoundingClientRect()
    const cx = r.left + r.width/2, cy = r.top + r.height/2
    gestureRef.current = { type: 'scale', id: book.userBookId, cx, cy, startDist: Math.hypot(e.clientX - cx, e.clientY - cy) || 1, startScale: book.pos.scale }
    setGesturing(true)
  }

  // ─── Actions ──────────────────────────────────────────────────────────────────
  const addBook = async (lb: LibBook, andCapture = false) => {
    const wallW = rowsRef.current?.offsetWidth ?? 360
    let shelf = rows - 1, left = 10
    outer: for (let r = 0; r < rows; r++) {
      const inRow = books.filter(b => b.pos.shelf === r)
      const rightEdge = inRow.reduce((m, b) => Math.max(m, b.pos.left + spineSize(b.userBookId).w * b.pos.scale), 6)
      if (rightEdge + 8 + 33 <= wallW - 6) { shelf = r; left = rightEdge + 8; break outer }
    }
    const pos: ShelfPos = { shelf, left, rot: 0, scale: 1 }
    const { error: updateErr } = await supabase.from('user_books').update({ shelf_pos: pos }).eq('id', lb.userBookId)
    if (updateErr) console.warn('shelf_pos column missing — run migration 016_virtual_shelf.sql')
    setBooks(prev => {
      const without = prev.filter(b => b.userBookId !== lb.userBookId)
      return [...without, { ...lb, pos }]
    })
    setSelected(lb.userBookId)
    setLibBooks(prev => prev.filter(b => b.userBookId !== lb.userBookId))
    if (andCapture) { setShowLibSheet(false); setSpineTarget({ userBookId: lb.userBookId, title: lb.title }) }
  }

  const removeBook = async (id: string) => {
    await supabase.from('user_books').update({ shelf_pos: null }).eq('id', id)
    setBooks(prev => prev.filter(b => b.userBookId !== id))
    if (selected === id) setSelected(null)
  }

  const removeLastRow = () => {
    if (rows <= 1) return
    const lastRow = rows - 1
    const booksOnLast = books.filter(b => b.pos.shelf === lastRow)
    // Move books on last row to second-to-last
    if (booksOnLast.length > 0) {
      const newRow = lastRow - 1
      const wallW = rowsRef.current?.offsetWidth ?? 360
      let left = 6
      const updatedBooks = books.map(b => {
        if (b.pos.shelf !== lastRow) return b
        const newPos = { ...b.pos, shelf: newRow, left }
        left += spineSize(b.userBookId).w * b.pos.scale + 8
        left = Math.min(left, wallW - 40)
        scheduleSave(b.userBookId, newPos)
        return { ...b, pos: newPos }
      })
      setBooks(updatedBooks)
    }
    const newRows = rows - 1
    setRows(newRows); saveRows(newRows)
  }

  const openLibSheet = async () => {
    setShowLibSheet(true); setLibLoading(true)
    const { data, error } = await supabase
      .from('user_books').select('id, spine_url, book:books(title,author,cover_url)')
      .eq('user_id', user!.id).is('shelf_pos', null)
    if (error) {
      const { data: all } = await supabase
        .from('user_books').select('id, spine_url, book:books(title,author,cover_url)')
        .eq('user_id', user!.id)
      setLibLoading(false)
      const onShelf = new Set(books.map(b => b.userBookId))
      setLibBooks(((all as any[]) ?? [])
        .filter(r => !onShelf.has(r.id))
        .map(r => ({ userBookId: r.id, title: r.book?.title ?? 'Unknown', author: r.book?.author ?? '', coverUrl: r.book?.cover_url ?? null, spineUrl: r.spine_url ?? null })))
      return
    }
    setLibLoading(false)
    setLibBooks(((data as any[]) ?? []).map(r => ({
      userBookId: r.id, title: r.book?.title ?? 'Unknown',
      author: r.book?.author ?? '', coverUrl: r.book?.cover_url ?? null, spineUrl: r.spine_url ?? null,
    })))
  }

  // ─── Spine capture ────────────────────────────────────────────────────────────
  const handleSpineCaptured = async (dataUrl: string) => {
    if (!spineTarget || !user) return
    const target = spineTarget
    setSpineTarget(null); setSpineSaving(true)
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const path = `${user.id}/${target.userBookId}.jpg`
      const { error } = await supabase.storage.from('book-spines').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (error) {
        console.error('Spine upload failed:', error.message)
      } else {
        const spineUrl = supabase.storage.from('book-spines').getPublicUrl(path).data.publicUrl
        await supabase.from('user_books').update({ spine_url: spineUrl }).eq('id', target.userBookId)
        setBooks(prev => prev.map(b => b.userBookId === target.userBookId ? { ...b, spineUrl } : b))
      }
    } finally { setSpineSaving(false) }
  }

  const cycleDeco = (rowIdx: number) => {
    const current = config.decos[rowIdx] ?? 0
    const next = DECO_CYCLE[(DECO_CYCLE.indexOf(current) + 1) % DECO_CYCLE.length]
    const decos = [...config.decos]
    decos[rowIdx] = next
    saveConfig({ ...config, decos })
  }

  const isEmpty = books.length === 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* ── Hint bar ── */}
      <div style={{ padding: '0 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 28, flexShrink: 0 }}>
        <span style={{ fontSize: 11.5, color: theme.muted, fontFamily: '-apple-system,system-ui,sans-serif' }}>
          {selectedBook
            ? 'Drag to move · handles to rotate, resize & re-shoot'
            : isEmpty ? '' : `${books.length} on the shelf · tap a book to edit`}
        </span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => setShowStyleSheet(true)} style={{ background: theme.bgSecondary, border: `1px solid ${theme.border}`, borderRadius: 8, cursor: 'pointer', padding: '4px 10px', fontSize: 11.5, color: theme.muted, fontFamily: '-apple-system,system-ui,sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3"/><path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.93 2.93l1.41 1.41M9.66 9.66l1.41 1.41M2.93 11.07l1.41-1.41M9.66 4.34l1.41-1.41" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            Style
          </button>
          {!isEmpty && (
            <button onClick={async () => { await Promise.all(books.map(b => supabase.from('user_books').update({ shelf_pos: null }).eq('id', b.userBookId))); setBooks([]); setSelected(null) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11.5, color: theme.muted, textDecoration: 'underline', fontFamily: '-apple-system,system-ui,sans-serif' }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Scroll container ── */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 110 }}>
        <div ref={rowsRef} onPointerDown={() => setSelected(null)}
          style={{ position: 'relative', height: rows * ROW_H, background: wallBg, borderLeft: `1px solid ${theme.border}`, borderRight: `1px solid ${theme.border}` }}>

          {/* Shelf boards + decorations */}
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} style={{ position: 'absolute', left: 0, right: 0, top: r * ROW_H + DECK_H }}>
              <div style={{ position: 'absolute', top: BOARD_H, left: 0, right: 0, height: 16, background: `linear-gradient(rgba(0,0,0,0.40), transparent)` }} />
              <div style={{ height: 3, background: board.top }} />
              <div style={{ height: BOARD_H - 3, background: board.face, borderBottom: `1.5px solid ${board.edge}` }} />
            </div>
          ))}

          {/* Decorations */}
          {Array.from({ length: rows }).map((_, r) => {
            const deco = config.decos[r] ?? 0
            if (!deco) return null
            return (
              <div key={`deco-${r}`} style={{ position: 'absolute', right: 8, bottom: (rows - 1 - r) * ROW_H + BOARD_H, pointerEvents: 'none' }}>
                {deco === 1 && <BookendSVG />}
                {deco === 2 && <PlantSVG />}
                {deco === 3 && <GlobeSVG />}
                {deco === 4 && <FigurineSVG />}
                {deco === 5 && <CandleSVG />}
              </div>
            )
          })}

          {/* Books */}
          {books.map(book => {
            const sz = spineSize(book.userBookId)
            const sel = book.userBookId === selected
            const inv = 1 / book.pos.scale
            return (
              <div key={book.userBookId} data-spine={book.userBookId} onPointerDown={e => bodyDown(e, book)}
                style={{ position: 'absolute', left: book.pos.left, top: book.pos.shelf * ROW_H + DECK_H - sz.h, width: sz.w, height: sz.h, transform: `rotate(${book.pos.rot}deg) scale(${book.pos.scale})`, transformOrigin: 'bottom center', zIndex: sel ? 50 : 10 + book.pos.shelf, cursor: 'grab', touchAction: 'none', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.55))' }}>
                <SpineFace book={book} w={sz.w} h={sz.h} theme={theme} />
                {sel && <div style={{ position: 'absolute', inset: -4, border: `1.5px solid ${theme.fg}`, borderRadius: 4, pointerEvents: 'none' }} />}
                {sel && (
                  <>
                    <div style={{ position: 'absolute', left: '50%', top: -22, width: 1.5, height: 22, background: theme.fg, transform: `scaleX(${inv})`, transformOrigin: 'top center', pointerEvents: 'none' }} />
                    <Handle invScale={inv} theme={theme} onPointerDown={e => rotateDown(e, book)} style={{ left: '50%', top: -22, marginLeft: -13, transform: `translateY(-100%) scale(${inv})` }}>
                      <RotateIcon color={theme.bg} />
                    </Handle>
                    <Handle invScale={inv} theme={theme} onPointerDown={e => scaleDown(e, book)} style={{ right: -13, bottom: -13, transform: `scale(${inv})` }}>
                      <ScaleIcon color={theme.bg} />
                    </Handle>
                    <Handle invScale={inv} theme={theme} onPointerDown={e => { e.stopPropagation(); removeBook(book.userBookId) }} style={{ right: -13, top: -13, transform: `scale(${inv})` }}>
                      <svg width="11" height="11" viewBox="0 0 11 11"><path d="M1 1L10 10M10 1L1 10" stroke={theme.bg} strokeWidth="1.6" strokeLinecap="round" /></svg>
                    </Handle>
                    <Handle invScale={inv} theme={theme} bg={theme.bg} fg={theme.fg} onPointerDown={e => { e.stopPropagation(); setSpineTarget({ userBookId: book.userBookId, title: book.title }) }} style={{ left: -13, bottom: -13, border: `1.5px solid ${theme.fg}`, transform: `scale(${inv})` }}>
                      <CameraIcon color={theme.fg} />
                    </Handle>
                  </>
                )}
              </div>
            )
          })}

          {isEmpty && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 40px' }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: theme.fg, letterSpacing: -0.5 }}>Your shelf is empty</div>
              <div style={{ fontSize: 13, color: theme.muted, marginTop: 8, lineHeight: 1.5, maxWidth: 230, fontFamily: '-apple-system,system-ui,sans-serif' }}>Add books from your library, then capture each spine with the camera.</div>
              <button onClick={openLibSheet} style={{ marginTop: 22, padding: '11px 22px', borderRadius: 999, background: theme.fg, color: theme.bg, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: '-apple-system,system-ui,sans-serif' }}>From Library</button>
            </div>
          )}
        </div>

        {/* Row management row */}
        <div style={{ display: 'flex', borderTop: `1px dashed ${theme.border}` }}>
          {rows > 1 && (
            <button onClick={removeLastRow}
              style={{ flex: 1, height: 50, background: 'none', cursor: 'pointer', border: 'none', borderRight: `1px dashed ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: theme.muted, fontSize: 12, fontFamily: '-apple-system,system-ui,sans-serif' }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${theme.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: theme.muted }}>−</span>
              Remove shelf
            </button>
          )}
          {rows < ROWS_MAX && (
            <button onClick={() => { const n = rows + 1; setRows(n); saveRows(n) }}
              style={{ flex: 1, height: 50, background: 'none', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: theme.muted, fontSize: 12, fontFamily: '-apple-system,system-ui,sans-serif' }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${theme.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: theme.muted }}>+</span>
              Add shelf
            </button>
          )}
        </div>
      </div>

      {/* ── FABs ── */}
      {!isEmpty && (
        <button onClick={openLibSheet} style={{ position: 'absolute', bottom: 22, left: 20, padding: '10px 16px', borderRadius: 999, background: theme.bgElevated, color: theme.fg, border: `1px solid ${theme.border}`, cursor: 'pointer', fontSize: 13, fontWeight: 500, zIndex: 80, display: 'flex', alignItems: 'center', gap: 6, fontFamily: '-apple-system,system-ui,sans-serif', boxShadow: '0 4px 14px rgba(0,0,0,0.4)' }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Library
        </button>
      )}
      <button
        onClick={() => { if (selectedBook) setSpineTarget({ userBookId: selectedBook.userBookId, title: selectedBook.title }); else openLibSheet() }}
        style={{ position: 'absolute', bottom: 22, right: 20, width: 54, height: 54, borderRadius: '50%', background: theme.fg, color: theme.bg, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, boxShadow: '0 6px 20px rgba(0,0,0,0.5)' }}>
        <CameraIcon color={theme.bg} size={22} />
      </button>

      {spineSaving && (
        <div style={{ position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)', background: theme.fg, color: theme.bg, borderRadius: 999, padding: '6px 16px', fontSize: 12, fontWeight: 500, zIndex: 200, whiteSpace: 'nowrap' }}>
          Saving spine…
        </div>
      )}

      {spineTarget && (
        <SpineCaptureCamera bookTitle={spineTarget.title} onCapture={handleSpineCaptured} onClose={() => setSpineTarget(null)} />
      )}

      {showLibSheet && (
        <AddFromLibSheet books={libBooks} loading={libLoading} theme={theme}
          onAdd={lb => addBook(lb, false)}
          onAddWithCapture={lb => addBook(lb, true)}
          onClose={() => setShowLibSheet(false)}
        />
      )}

      {showStyleSheet && (
        <StyleSheet config={config} theme={theme} onSave={saveConfig} onClose={() => setShowStyleSheet(false)} rows={rows} />
      )}
    </div>
  )
}

// ─── Spine face ───────────────────────────────────────────────────────────────
function SpineFace({ book, w, h, theme }: { book: ShelfBook; w: number; h: number; theme: Theme }) {
  if (book.spineUrl) {
    return (
      <div style={{ width: '100%', height: '100%', borderRadius: 2, overflow: 'hidden', position: 'relative', boxShadow: 'inset 0 0 14px rgba(0,0,0,0.55)' }}>
        <img src={book.spineUrl} alt={book.title} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 2, background: 'rgba(255,255,255,0.16)' }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 3, background: 'rgba(0,0,0,0.35)' }} />
      </div>
    )
  }
  const tone = spineTone(book.userBookId)
  const light = isLightTone(tone)
  const ink = light ? '#111' : '#fff'
  const authorLast = book.author.split(' ').slice(-1)[0]
  return (
    <div style={{ width: '100%', height: '100%', background: tone, borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.10)' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 1.5, background: 'rgba(255,255,255,0.14)' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 2.5, background: 'rgba(0,0,0,0.30)' }} />
      <div style={{ position: 'absolute', inset: 0, padding: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ writingMode: 'vertical-rl', fontFamily: 'Georgia, serif', fontSize: Math.max(8, w * 0.27), color: ink, letterSpacing: 0.4, whiteSpace: 'nowrap', overflow: 'hidden', maxHeight: h - 18 }}>{book.title}</span>
      </div>
      <div style={{ position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center', fontFamily: '-apple-system,system-ui,sans-serif', fontSize: Math.max(5.5, w * 0.15), color: light ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)' }}>{authorLast}</div>
    </div>
  )
}

// ─── Handle button ────────────────────────────────────────────────────────────
function Handle({ children, onPointerDown, style, invScale, theme, bg, fg }: {
  children: React.ReactNode; onPointerDown: (e: React.PointerEvent) => void
  style?: React.CSSProperties; invScale: number; theme: Theme; bg?: string; fg?: string
}) {
  return (
    <button onPointerDown={onPointerDown} style={{ position: 'absolute', width: 26, height: 26, borderRadius: '50%', background: bg ?? theme.fg, color: fg ?? theme.bg, border: `1.5px solid ${theme.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, zIndex: 60, touchAction: 'none', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', transform: `scale(${invScale})`, ...style }}>
      {children}
    </button>
  )
}

// ─── Add from library sheet ───────────────────────────────────────────────────
function AddFromLibSheet({ books, loading, theme, onAdd, onAddWithCapture, onClose }: {
  books: LibBook[]; loading: boolean; theme: Theme
  onAdd: (b: LibBook) => void; onAddWithCapture: (b: LibBook) => void; onClose: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: theme.bg, borderRadius: '22px 22px 0 0', maxHeight: '76%', display: 'flex', flexDirection: 'column', boxShadow: '0 -10px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ padding: '14px 22px 10px' }}>
          <div style={{ width: 38, height: 4, borderRadius: 999, background: theme.border, margin: '0 auto 16px' }} />
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: theme.fg, letterSpacing: -0.5 }}>Add from Library</div>
          <div style={{ fontSize: 12.5, color: theme.muted, marginTop: 4, fontFamily: '-apple-system,system-ui,sans-serif' }}>Only books already in your library can go on the shelf.</div>
        </div>
        <div style={{ overflowY: 'auto', padding: '4px 16px calc(28px + env(safe-area-inset-bottom,0px))', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: theme.muted, fontSize: 14 }}>Loading…</div>
          ) : books.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Georgia, serif', fontSize: 16, color: theme.muted }}>Every library book is already on the shelf.</div>
          ) : books.map(lb => (
            <div key={lb.userBookId} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 6px', borderBottom: `1px solid ${theme.border}` }}>
              <button onClick={() => onAdd(lb)} style={{ flex: 1, display: 'flex', gap: 12, alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                {/* Spine preview if available, otherwise cover */}
                {lb.spineUrl ? (
                  <div style={{ width: 28, height: 72, borderRadius: 2, overflow: 'hidden', flexShrink: 0, boxShadow: '2px 2px 6px rgba(0,0,0,0.25)' }}>
                    <img src={lb.spineUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                ) : (
                  <div style={{ width: 40, height: 60, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: theme.bgSecondary }}>
                    {lb.coverUrl && <img src={lb.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 14.5, color: theme.fg, lineHeight: 1.25 }}>{lb.title}</div>
                  <div style={{ fontSize: 11.5, color: theme.muted, marginTop: 2, fontFamily: '-apple-system,system-ui,sans-serif' }}>{lb.author}</div>
                  {lb.spineUrl && <div style={{ fontSize: 10, color: theme.muted, marginTop: 3, opacity: 0.7 }}>spine photo ✓</div>}
                </div>
              </button>
              <button onClick={() => onAddWithCapture(lb)} title="Add + capture spine" style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: theme.bgSecondary, border: `1px solid ${theme.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CameraIcon size={17} color={lb.spineUrl ? theme.fg : theme.muted} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Style sheet ──────────────────────────────────────────────────────────────
function StyleSheet({ config, theme, onSave, onClose, rows }: {
  config: ShelfConfig; theme: Theme; onSave: (c: ShelfConfig) => void; onClose: () => void; rows: number
}) {
  const [tab, setTab] = useState<'style' | 'decor'>('style')
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: theme.bg, borderRadius: '22px 22px 0 0', boxShadow: '0 -10px 40px rgba(0,0,0,0.4)', maxHeight: '82vh', display: 'flex', flexDirection: 'column', paddingBottom: 'calc(28px + env(safe-area-inset-bottom,0px))' }}>
        {/* Header */}
        <div style={{ padding: '14px 22px 0', flexShrink: 0 }}>
          <div style={{ width: 38, height: 4, borderRadius: 999, background: theme.border, margin: '0 auto 16px' }} />
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: theme.fg, letterSpacing: -0.5, marginBottom: 14 }}>Customize Shelf</div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: theme.bgSecondary, borderRadius: 10, padding: 3 }}>
            {(['style', 'decor'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', background: tab === t ? theme.bg : 'transparent', color: tab === t ? theme.fg : theme.muted, fontSize: 13, fontWeight: tab === t ? 600 : 400, fontFamily: '-apple-system,system-ui,sans-serif', boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.15)' : 'none', textTransform: 'capitalize' }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', padding: '0 22px 18px', flex: 1 }}>
          {tab === 'style' ? (
            <>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 10, fontFamily: '-apple-system,system-ui,sans-serif' }}>Wood</div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
                {WOOD_PRESETS.map((w, i) => (
                  <button key={i} onClick={() => onSave({ ...config, woodIdx: i })} style={{ flex: 1, height: 40, borderRadius: 8, cursor: 'pointer', background: `linear-gradient(to bottom, ${w.top}, ${w.face})`, border: config.woodIdx === i ? `2.5px solid ${theme.fg}` : `2px solid transparent`, outline: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 5 }}>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', fontFamily: '-apple-system,system-ui,sans-serif', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{w.name}</span>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 10, fontFamily: '-apple-system,system-ui,sans-serif' }}>Wall</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {WALL_PRESETS.map((w, i) => (
                  <button key={i} onClick={() => onSave({ ...config, wallIdx: i })} style={{ flex: 1, height: 40, borderRadius: 8, cursor: 'pointer', background: w.bg, border: config.wallIdx === i ? `2.5px solid ${theme.fg}` : `2px solid ${theme.border}`, outline: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 5 }}>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', fontFamily: '-apple-system,system-ui,sans-serif', textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>{w.name}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11.5, color: theme.muted, fontFamily: '-apple-system,system-ui,sans-serif', marginBottom: 16, lineHeight: 1.4 }}>
                Pick a decoration for each shelf row.
              </div>
              {Array.from({ length: rows }).map((_, r) => (
                <div key={r} style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 8, fontFamily: '-apple-system,system-ui,sans-serif' }}>Shelf {r + 1}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {DECO_ITEMS.map(item => {
                      const sel = (config.decos[r] ?? 0) === item.id
                      return (
                        <button key={item.id} onClick={() => {
                          const decos = [...(config.decos ?? [])]
                          decos[r] = item.id
                          onSave({ ...config, decos })
                        }} style={{ flexShrink: 0, width: 52, borderRadius: 10, background: sel ? theme.bgSecondary : 'transparent', border: sel ? `2px solid ${theme.fg}` : `2px solid ${theme.border}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 4px 6px', gap: 4 }}>
                          <div style={{ width: 36, height: 42, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
                            {item.id === 0
                              ? <span style={{ fontSize: 20, color: theme.muted, paddingBottom: 6 }}>—</span>
                              : (
                                <div style={{ transform: 'scale(0.52)', transformOrigin: 'bottom center', flexShrink: 0 }}>
                                  {item.id === 1 && <BookendSVG />}
                                  {item.id === 2 && <PlantSVG />}
                                  {item.id === 3 && <GlobeSVG />}
                                  {item.id === 4 && <FigurineSVG />}
                                  {item.id === 5 && <CandleSVG />}
                                </div>
                              )}
                          </div>
                          <span style={{ fontSize: 8.5, color: sel ? theme.fg : theme.muted, fontFamily: '-apple-system,system-ui,sans-serif', textAlign: 'center', lineHeight: 1.2 }}>{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Decorations ──────────────────────────────────────────────────────────────
function BookendSVG() {
  return (
    <svg width="18" height="DECK_H" viewBox="0 0 18 166" fill="none" style={{ display: 'block' }}>
      <rect x="12" y="0" width="6" height="156" rx="2" fill="#888" />
      <rect x="0" y="150" width="18" height="6" rx="2" fill="#888" />
      <rect x="11" y="0" width="1" height="156" fill="rgba(255,255,255,0.15)" />
    </svg>
  )
}

function PlantSVG() {
  return (
    <svg width="32" height="56" viewBox="0 0 32 56" fill="none" style={{ display: 'block' }}>
      {/* Pot */}
      <path d="M9 40 L8 52 H24 L23 40Z" fill="#8B6914" />
      <rect x="7" y="38" width="18" height="4" rx="2" fill="#A0792A" />
      {/* Soil */}
      <rect x="9" y="38" width="14" height="2" rx="1" fill="#4a3520" />
      {/* Cactus body */}
      <rect x="12" y="16" width="8" height="24" rx="4" fill="#3a7a3a" />
      {/* Left arm */}
      <path d="M12 26 Q5 26 5 20 Q5 14 9 14" stroke="#3a7a3a" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* Right arm */}
      <path d="M20 30 Q27 30 27 24 Q27 18 23 18" stroke="#3a7a3a" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* Spines */}
      {[20, 26, 32].map(y => (
        <g key={y}>
          <line x1="11" y1={y} x2="8" y2={y-2} stroke="#5aaa5a" strokeWidth="0.8" />
          <line x1="21" y1={y} x2="24" y2={y-2} stroke="#5aaa5a" strokeWidth="0.8" />
        </g>
      ))}
    </svg>
  )
}

function GlobeSVG() {
  return (
    <svg width="38" height="54" viewBox="0 0 38 54" fill="none" style={{ display: 'block' }}>
      <circle cx="19" cy="20" r="14" fill="#1e4d7a" />
      <ellipse cx="15" cy="16" rx="5" ry="7" fill="#2e7d32" />
      <ellipse cx="25" cy="21" rx="4" ry="5" fill="#2e7d32" />
      <ellipse cx="20" cy="29" rx="3" ry="2.5" fill="#2e7d32" />
      <ellipse cx="19" cy="20" rx="14" ry="4.5" stroke="rgba(255,255,255,0.14)" strokeWidth="0.8" fill="none" />
      <line x1="5" y1="20" x2="33" y2="20" stroke="rgba(255,255,255,0.14)" strokeWidth="0.8" />
      <ellipse cx="19" cy="20" rx="5" ry="14" stroke="rgba(255,255,255,0.14)" strokeWidth="0.8" fill="none" />
      <ellipse cx="13" cy="14" rx="4" ry="2.5" fill="rgba(255,255,255,0.10)" />
      <line x1="19" y1="34" x2="19" y2="42" stroke="#555" strokeWidth="1.5" />
      <rect x="12" y="42" width="14" height="3" rx="1.5" fill="#666" />
      <rect x="9" y="45" width="20" height="3" rx="1.5" fill="#555" />
    </svg>
  )
}

function FigurineSVG() {
  return (
    <svg width="30" height="56" viewBox="0 0 30 56" fill="none" style={{ display: 'block' }}>
      <rect x="5" y="48" width="20" height="4" rx="2" fill="#888" />
      <rect x="9" y="43" width="12" height="6" rx="1.5" fill="#777" />
      <path d="M11 29 Q15 21 19 29 L18 43 H12 Z" fill="#c8a84b" />
      <circle cx="15" cy="23" r="5" fill="#c8a84b" />
      <path d="M11 31 Q5 27 4 21" stroke="#c8a84b" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M19 31 Q25 27 26 21" stroke="#c8a84b" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M15 11 L16.2 14.6 H20 L17 16.8 L18.2 20.4 L15 18.2 L11.8 20.4 L13 16.8 L10 14.6 H13.8 Z" fill="#FFD700" />
      <ellipse cx="13" cy="21" rx="1.8" ry="1.2" fill="rgba(255,255,255,0.18)" />
    </svg>
  )
}

function CandleSVG() {
  return (
    <svg width="22" height="56" viewBox="0 0 22 56" fill="none" style={{ display: 'block' }}>
      <path d="M11 3 Q14.5 7.5 13.5 13 Q11.5 11 9.5 13 Q8.5 7.5 11 3Z" fill="#FFB800" />
      <path d="M11 6 Q12.8 9.5 12.2 12 Q11 11 9.8 12 Q9.2 9.5 11 6Z" fill="#FFF4B0" />
      <line x1="11" y1="13" x2="11" y2="16" stroke="#333" strokeWidth="1.2" />
      <rect x="7" y="16" width="8" height="32" rx="3" fill="#F0EDE5" />
      <rect x="7" y="16" width="2" height="32" rx="1" fill="rgba(0,0,0,0.07)" />
      <rect x="13" y="16" width="2" height="32" rx="1" fill="rgba(0,0,0,0.10)" />
      <path d="M7 26 Q6 29 7 31" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <ellipse cx="11" cy="48" rx="8" ry="2.5" fill="#DDD" />
      <rect x="5" y="47" width="12" height="2.5" rx="1" fill="#CCC" />
    </svg>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function CameraIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M2 6.2C2 5.5 2.5 5 3.2 5h1.6l.9-1.4C5.9 3.2 6.2 3 6.6 3h4.8c.4 0 .7.2.9.6L13.2 5h1.6c.7 0 1.2.5 1.2 1.2v7.1c0 .7-.5 1.2-1.2 1.2H3.2C2.5 14.5 2 14 2 13.3V6.2Z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="9" cy="9.6" r="2.7" stroke={color} strokeWidth="1.3" />
    </svg>
  )
}
function RotateIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M11 4.5A5 5 0 1 0 12 7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 1.5V4.8H7.7" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ScaleIcon({ color }: { color: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M3 8V11H6M11 5V2H8M11 2L7 6M2 11L6 7" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
