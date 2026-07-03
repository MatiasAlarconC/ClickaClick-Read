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

// ─── Decoration catalog ───────────────────────────────────────────────────────
interface DecoItem { id: string; label: string; group: string }

const DECO_CATALOG: DecoItem[] = [
  { id: 'cactus',    label: 'Cactus',    group: 'Plants'  },
  { id: 'flower',    label: 'Flower',    group: 'Plants'  },
  { id: 'monstera',  label: 'Monstera',  group: 'Plants'  },
  { id: 'succulent', label: 'Succulent', group: 'Plants'  },
  { id: 'trophy',    label: 'Trophy',    group: 'Objects' },
  { id: 'globe',     label: 'Globe',     group: 'Objects' },
  { id: 'candle',    label: 'Candle',    group: 'Objects' },
  { id: 'hourglass', label: 'Hourglass', group: 'Objects' },
  { id: 'crystal',   label: 'Crystal',   group: 'Objects' },
  { id: 'books',     label: 'Books',     group: 'Objects' },
  { id: 'owl',       label: 'Owl',       group: 'Charms'  },
  { id: 'cat',       label: 'Cat',       group: 'Charms'  },
]

const DECO_GROUP_NAMES = ['Plants', 'Objects', 'Charms']

const DECO_BASE_H = 72  // base height in px at scale=1; width = 72 * 0.75 = 54

// Legacy emoji char → SVG id migration
const EMOJI_TO_ID: Record<string, string> = {
  '🪴': 'monstera', '🌵': 'cactus', '🌿': 'monstera', '🍀': 'succulent',
  '🌷': 'flower',   '🌻': 'flower', '🎍': 'monstera',
  '🕯️': 'candle',  '🏆': 'trophy', '🌍': 'globe',    '🕰️': 'globe',
  '☕': 'books',    '🫖': 'books',  '🖼️': 'books',    '💡': 'candle',
  '🔮': 'crystal',  '🧭': 'globe',  '⏳': 'hourglass', '📷': 'books',
  '🦉': 'owl',      '🐈': 'cat',   '🧸': 'owl',       '🐚': 'crystal',
  '🗿': 'trophy',   '⛵': 'globe',  '📚': 'books',
}

// Realistic wood grain overlays
const WOOD_GRAIN_H = 'repeating-linear-gradient(180deg, rgba(0,0,0,0.05) 0px, rgba(0,0,0,0) 1.5px, rgba(255,255,255,0.03) 3px, rgba(0,0,0,0) 4.5px)'
const WOOD_GRAIN_V = 'repeating-linear-gradient(90deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0) 2px, rgba(255,255,255,0.03) 4px, rgba(0,0,0,0) 6px)'

// ─── Types ────────────────────────────────────────────────────────────────────
type ShelfPos = { shelf: number; left: number; rot: number; scale: number }

interface ShelfDeco {
  uid: string
  emoji: string   // stores SVG id (e.g. 'cactus') or legacy emoji char
  shelf: number
  left: number
  scale?: number
}

interface ShelfConfig {
  woodIdx: number
  wallIdx: number
  decos: number[]
  decoItems: ShelfDeco[]
}

const DEFAULT_CONFIG: ShelfConfig = { woodIdx: 0, wallIdx: 0, decos: [], decoItems: [] }

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
  | { type: 'drag'; id: string; grabOffset: number; isDeco?: boolean }
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
  const [selectedDeco, setSelectedDeco] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)

  const rowsRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<GestureState | null>(null)
  const [gesturing, setGesturing] = useState(false)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const board = WOOD_PRESETS[config.woodIdx] ?? WOOD_PRESETS[0]
  const wallBg = WALL_PRESETS[config.wallIdx]?.bg ?? WALL_PRESETS[0].bg
  const selectedBook = books.find(b => b.userBookId === selected) ?? null

  // ─── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const rowKey = `cc_shelf_rows_${user.id}`
    const cfgKey = `cc_shelf_cfg_${user.id}`
    const savedRows = parseInt(localStorage.getItem(rowKey) ?? '', 10)
    if (!isNaN(savedRows) && savedRows >= 1 && savedRows <= ROWS_MAX) setRows(savedRows)
    try {
      const savedCfg = JSON.parse(localStorage.getItem(cfgKey) ?? '{}')
      const decoItems = (savedCfg.decoItems ?? []).map((d: any) => ({
        uid: d.uid,
        // Migrate legacy emoji chars → SVG ids
        emoji: EMOJI_TO_ID[d.emoji] ?? d.emoji ?? 'cactus',
        shelf: d.shelf ?? 0,
        left: d.left ?? 0,
        scale: d.scale ?? 1,
      }))
      setConfig({ ...DEFAULT_CONFIG, ...savedCfg, decoItems })
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

  // ─── Gestures ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gesturing) return
    const move = (e: PointerEvent) => {
      const g = gestureRef.current
      if (!g) return
      if (g.type === 'drag') {
        const el = rowsRef.current; if (!el) return
        const r = el.getBoundingClientRect()
        const shelf = Math.max(0, Math.min(rows - 1, Math.floor((e.clientY - r.top) / ROW_H)))
        if (g.isDeco) {
          const left = Math.max(6, Math.min(e.clientX - r.left - g.grabOffset, el.offsetWidth - 60))
          setConfig(prev => {
            const decoItems = prev.decoItems.map(d => d.uid === g.id ? { ...d, shelf, left } : d)
            const next = { ...prev, decoItems }
            if (user) localStorage.setItem(`cc_shelf_cfg_${user.id}`, JSON.stringify(next))
            return next
          })
        } else {
          const sz = spineSize(g.id)
          const left = Math.max(6, Math.min(e.clientX - r.left - g.grabOffset, el.offsetWidth - sz.w - 6))
          updatePos(g.id, { shelf, left })
        }
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
    if (!editMode) return
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

  // ─── Actions ──────────────────────────────────────────────────────────────
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

  // ─── Spine capture ────────────────────────────────────────────────────────
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

  const addDeco = (id: string) => {
    const wallW = rowsRef.current?.offsetWidth ?? 340
    const uid = `deco_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const existingOnShelf0 = config.decoItems.filter(d => d.shelf === 0)
    const left = existingOnShelf0.reduce((m, d) => Math.max(m, d.left + DECO_BASE_H * 0.75 + 8), wallW - 70)
    const item: ShelfDeco = { uid, emoji: id, shelf: 0, left: Math.max(6, Math.min(left, wallW - 60)), scale: 1 }
    saveConfig({ ...config, decoItems: [...config.decoItems, item] })
    setEditMode(true)
    setSelectedDeco(uid)
  }

  const removeDeco = (uid: string) => {
    saveConfig({ ...config, decoItems: config.decoItems.filter(d => d.uid !== uid) })
    if (selectedDeco === uid) setSelectedDeco(null)
  }

  const scaleDeco = (uid: string, delta: number) => {
    saveConfig({ ...config, decoItems: config.decoItems.map(d => d.uid === uid ? { ...d, scale: Math.max(0.6, Math.min(2.2, (d.scale ?? 1) + delta)) } : d) })
  }

  const isEmpty = books.length === 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* ── Hint bar ── */}
      <div style={{ padding: '0 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 28, flexShrink: 0 }}>
        <span style={{ fontSize: 11.5, color: editMode ? theme.fg : theme.muted, fontFamily: '-apple-system,system-ui,sans-serif' }}>
          {editMode ? 'Edit mode · drag books & decorations freely' : isEmpty ? '' : `${books.length} on the shelf`}
        </span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => { setEditMode(m => !m); setSelected(null); setSelectedDeco(null) }}
            style={{ background: editMode ? theme.fg : theme.bgSecondary, border: `1px solid ${editMode ? theme.fg : theme.border}`, borderRadius: 8, cursor: 'pointer', padding: '4px 12px', fontSize: 11.5, fontWeight: editMode ? 600 : 400, color: editMode ? theme.bg : theme.muted, fontFamily: '-apple-system,system-ui,sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}>
            {editMode ? 'Done' : (
              <><svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M9.5 1.5l3 3L4 13l-3 .5.5-3L9.5 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>Edit</>
            )}
          </button>
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

      {/* ── Crown moulding ── */}
      <div style={{ flexShrink: 0, position: 'relative', zIndex: 25 }}>
        <div style={{ height: 22, background: `${WOOD_GRAIN_V}, linear-gradient(to bottom, ${board.top}, ${board.face} 55%, ${board.edge})`, boxShadow: '0 5px 12px rgba(0,0,0,0.45)', borderTop: `1px solid ${board.top}` }} />
        <div style={{ height: 4, background: `linear-gradient(to bottom, ${board.edge}, ${board.face})` }} />
      </div>

      {/* ── Scroll container ── */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 110 }}>
        <div style={{ position: 'relative' }}>
          {/* Left wall */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: 16, bottom: 0, zIndex: 20, pointerEvents: 'none',
            background: `${WOOD_GRAIN_H}, linear-gradient(to right, ${board.top}, ${board.face} 45%, ${board.edge})`,
            boxShadow: 'inset -4px 0 10px rgba(0,0,0,0.5), inset 1px 0 0 rgba(255,255,255,0.12)' }} />
          {/* Right wall */}
          <div style={{ position: 'absolute', top: 0, right: 0, width: 16, bottom: 0, zIndex: 20, pointerEvents: 'none',
            background: `${WOOD_GRAIN_H}, linear-gradient(to left, ${board.top}, ${board.face} 45%, ${board.edge})`,
            boxShadow: 'inset 4px 0 10px rgba(0,0,0,0.5), inset -1px 0 0 rgba(255,255,255,0.12)' }} />

          <div ref={rowsRef} onPointerDown={() => { setSelected(null); setSelectedDeco(null) }}
            style={{ position: 'relative', height: rows * ROW_H, background: wallBg, marginLeft: 16, marginRight: 16,
              boxShadow: 'inset 0 10px 28px rgba(0,0,0,0.6), inset 0 -6px 20px rgba(0,0,0,0.5), inset 8px 0 16px rgba(0,0,0,0.35), inset -8px 0 16px rgba(0,0,0,0.35)' }}>

            {/* Shelf boards */}
            {Array.from({ length: rows }).map((_, r) => (
              <div key={r} style={{ position: 'absolute', left: -2, right: -2, top: r * ROW_H + DECK_H }}>
                <div style={{ position: 'absolute', bottom: BOARD_H - 1, left: 0, right: 0, height: 22, background: 'linear-gradient(to top, rgba(0,0,0,0.42), transparent)', pointerEvents: 'none' }} />
                <div style={{ height: 2.5, background: `linear-gradient(to right, ${board.edge}, ${board.top} 20%, ${board.top} 80%, ${board.edge})`, boxShadow: '0 -1px 2px rgba(255,255,255,0.15)' }} />
                <div style={{ height: BOARD_H - 2.5, background: `${WOOD_GRAIN_V}, linear-gradient(to bottom, ${board.top} 0%, ${board.face} 42%, ${board.edge} 100%)`,
                  borderBottom: `1px solid rgba(0,0,0,0.4)`, boxShadow: '0 3px 8px rgba(0,0,0,0.5)' }} />
              </div>
            ))}

            {/* SVG Decorations */}
            {config.decoItems.map(deco => {
              const sc = deco.scale ?? 1
              const size = DECO_BASE_H * sc
              const decoW = size * 0.75
              const decoTop = deco.shelf * ROW_H + DECK_H - size + 5
              const selD = deco.uid === selectedDeco
              return (
                <div key={deco.uid}
                  onPointerDown={editMode ? (e => {
                    e.stopPropagation()
                    setSelectedDeco(deco.uid); setSelected(null)
                    const el = rowsRef.current; if (!el) return
                    gestureRef.current = { type: 'drag', id: deco.uid, grabOffset: e.clientX - el.getBoundingClientRect().left - deco.left, isDeco: true }
                    setGesturing(true)
                  }) : undefined}
                  style={{ position: 'absolute', left: deco.left, top: decoTop, width: decoW, height: size, zIndex: selD ? 55 : 15, cursor: editMode ? 'grab' : 'default', touchAction: 'none' }}>
                  <div style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))', userSelect: 'none', WebkitUserSelect: 'none' }}>
                    <DecoIllustration id={deco.emoji} uid={deco.uid} size={size} />
                  </div>
                  {editMode && selD && (
                    <>
                      <div style={{ position: 'absolute', inset: -6, border: `1.5px dashed ${theme.fg}`, borderRadius: 8, pointerEvents: 'none', opacity: 0.5 }} />
                      <button onPointerDown={e => { e.stopPropagation(); removeDeco(deco.uid) }}
                        style={{ position: 'absolute', top: -14, right: -14, width: 26, height: 26, borderRadius: '50%', background: theme.fg, border: `1.5px solid ${theme.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, zIndex: 60, boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
                        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1L9 9M9 1L1 9" stroke={theme.bg} strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </button>
                      <div style={{ position: 'absolute', bottom: -18, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, zIndex: 60 }}>
                        <button onPointerDown={e => { e.stopPropagation(); scaleDeco(deco.uid, -0.15) }}
                          style={{ width: 24, height: 24, borderRadius: '50%', background: theme.fg, border: `1.5px solid ${theme.bg}`, color: theme.bg, cursor: 'pointer', padding: 0, fontSize: 15, lineHeight: 1, boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>−</button>
                        <button onPointerDown={e => { e.stopPropagation(); scaleDeco(deco.uid, 0.15) }}
                          style={{ width: 24, height: 24, borderRadius: '50%', background: theme.fg, border: `1.5px solid ${theme.bg}`, color: theme.bg, cursor: 'pointer', padding: 0, fontSize: 15, lineHeight: 1, boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>+</button>
                      </div>
                    </>
                  )}
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
        </div>

        {/* Baseboard */}
        <div style={{ height: 18, background: `${WOOD_GRAIN_V}, linear-gradient(to top, ${board.edge}, ${board.face} 55%, ${board.top})`, boxShadow: '0 -5px 12px rgba(0,0,0,0.45)', borderBottom: `1px solid ${board.edge}` }} />

        {/* Row management */}
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
        <StyleSheet config={config} theme={theme} onSave={saveConfig} onClose={() => setShowStyleSheet(false)} onAddDeco={addDeco} />
      )}
    </div>
  )
}

// ─── Spine face ────────────────────────────────────────────────────────────────
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

// ─── Handle button ─────────────────────────────────────────────────────────────
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

// ─── Add from library sheet ────────────────────────────────────────────────────
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

// ─── Style sheet ───────────────────────────────────────────────────────────────
function StyleSheet({ config, theme, onSave, onClose, onAddDeco }: {
  config: ShelfConfig; theme: Theme; onSave: (c: ShelfConfig) => void; onClose: () => void; onAddDeco: (id: string) => void
}) {
  const [tab, setTab] = useState<'style' | 'decor'>('style')
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: theme.bg, borderRadius: '22px 22px 0 0', boxShadow: '0 -10px 40px rgba(0,0,0,0.4)', maxHeight: '82vh', display: 'flex', flexDirection: 'column', paddingBottom: 'calc(28px + env(safe-area-inset-bottom,0px))' }}>
        <div style={{ padding: '14px 22px 0', flexShrink: 0 }}>
          <div style={{ width: 38, height: 4, borderRadius: 999, background: theme.border, margin: '0 auto 16px' }} />
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: theme.fg, letterSpacing: -0.5, marginBottom: 14 }}>Customize Shelf</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4, background: theme.bgSecondary, borderRadius: 10, padding: 3 }}>
            {([['style', 'Style'], ['decor', 'Decorations']] as const).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer', background: tab === t ? theme.bg : 'transparent', color: tab === t ? theme.fg : theme.muted, fontSize: 13, fontWeight: tab === t ? 600 : 400, fontFamily: '-apple-system,system-ui,sans-serif', boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.15)' : 'none' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: '16px 22px 18px', flex: 1 }}>
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
              <div style={{ fontSize: 12, color: theme.muted, marginBottom: 18, fontFamily: '-apple-system,system-ui,sans-serif', lineHeight: 1.4 }}>
                Tap to place · turn on <strong style={{ color: theme.fg }}>Edit</strong> to drag anywhere.
              </div>
              {DECO_GROUP_NAMES.map(group => {
                const items = DECO_CATALOG.filter(d => d.group === group)
                return (
                  <div key={group} style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 12, fontFamily: '-apple-system,system-ui,sans-serif' }}>{group}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                      {items.map(item => (
                        <button key={item.id} onClick={() => onAddDeco(item.id)}
                          style={{ borderRadius: 14, background: theme.bgSecondary, border: `1.5px solid ${theme.border}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 4px 7px', gap: 6 }}>
                          <DecoIllustration id={item.id} uid={`picker-${item.id}`} size={48} />
                          <span style={{ fontSize: 9, color: theme.muted, fontFamily: '-apple-system,system-ui,sans-serif', textAlign: 'center' }}>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Icons ─────────────────────────────────────────────────────────────────────
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

// ─── Decoration SVG illustrations ─────────────────────────────────────────────
// uid prefix is used on all gradient IDs to avoid conflicts between multiple
// instances rendered simultaneously (shelf items + picker previews).

function CactusDeco({ w, h, uid }: { w: number; h: number; uid: string }) {
  const p = uid.replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg viewBox="0 0 60 80" width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`${p}pot`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9c3f1c"/><stop offset="30%" stopColor="#cd5c28"/>
          <stop offset="65%" stopColor="#c45225"/><stop offset="100%" stopColor="#8a3018"/>
        </linearGradient>
        <linearGradient id={`${p}pl`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1b6030"/><stop offset="40%" stopColor="#38a050"/>
          <stop offset="75%" stopColor="#2d8842"/><stop offset="100%" stopColor="#164820"/>
        </linearGradient>
      </defs>
      <ellipse cx="30" cy="78" rx="15" ry="2.5" fill="rgba(0,0,0,0.2)"/>
      <path d="M13 52 Q12 76 20 76 H40 Q48 76 47 52 Z" fill={`url(#${p}pot)`}/>
      <ellipse cx="30" cy="52" rx="17" ry="4.5" fill="#c05228"/>
      <ellipse cx="30" cy="51" rx="15" ry="3" fill="#3c1e08"/>
      <path d="M18 57 Q17 69 19 74" stroke="rgba(255,255,255,0.18)" strokeWidth="3" strokeLinecap="round" fill="none"/>
      <rect x="25" y="10" width="10" height="43" rx="5" fill={`url(#${p}pl)`}/>
      <rect x="27" y="14" width="3" height="35" rx="1.5" fill="rgba(255,255,255,0.1)"/>
      <path d="M26 36 L13 36 Q11 36 11 34 L11 22 Q11 16 17 16" stroke={`url(#${p}pl)`} strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M34 42 L47 42 Q49 42 49 40 L49 28 Q49 22 43 22" stroke={`url(#${p}pl)`} strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      {[14,20,26,32,38,44].map(y => (
        <g key={y}>
          <line x1="25" y1={y} x2="22" y2={y-1.5} stroke="#c8a050" strokeWidth="0.8"/>
          <line x1="35" y1={y} x2="38" y2={y-1.5} stroke="#c8a050" strokeWidth="0.8"/>
        </g>
      ))}
    </svg>
  )
}

function FlowerDeco({ w, h, uid }: { w: number; h: number; uid: string }) {
  const p = uid.replace(/[^a-zA-Z0-9]/g, '')
  const petals = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2
    return { cx: 30 + Math.cos(a) * 9, cy: 24 + Math.sin(a) * 8, rot: i * 45 }
  })
  return (
    <svg viewBox="0 0 60 80" width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`${p}pot`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9c3f1c"/><stop offset="35%" stopColor="#cd5c28"/><stop offset="100%" stopColor="#8a3018"/>
        </linearGradient>
        <radialGradient id={`${p}ctr`} cx="45%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#ffe040"/><stop offset="100%" stopColor="#d4a010"/>
        </radialGradient>
      </defs>
      <ellipse cx="30" cy="78" rx="13" ry="2" fill="rgba(0,0,0,0.18)"/>
      <path d="M16 54 Q15 76 22 76 H38 Q45 76 44 54 Z" fill={`url(#${p}pot)`}/>
      <ellipse cx="30" cy="54" rx="14" ry="3.5" fill="#c05228"/>
      <ellipse cx="30" cy="53" rx="12" ry="2.5" fill="#3c1e08"/>
      <path d="M20 57 Q19 68 21 74" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <path d="M30 53 Q27 42 30 24" stroke="#3d8a2e" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <path d="M30 44 Q20 40 18 34 Q24 36 30 40" fill="#4e9c3a"/>
      <path d="M30 38 Q40 34 42 28 Q36 30 30 34" fill="#3a8228"/>
      {petals.map((pt, i) => (
        <ellipse key={i} cx={pt.cx} cy={pt.cy} rx="5.5" ry="3.5"
          fill={i % 2 === 0 ? '#f8f8ff' : '#ededf8'}
          transform={`rotate(${pt.rot},${pt.cx},${pt.cy})`}/>
      ))}
      <circle cx="30" cy="24" r="7" fill={`url(#${p}ctr)`}/>
      <circle cx="30" cy="24" r="4.5" fill="#e09010"/>
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2
        return <circle key={i} cx={30 + Math.cos(a) * 2.8} cy={24 + Math.sin(a) * 2.8} r="0.7" fill="#8a5c08"/>
      })}
    </svg>
  )
}

function MonsteraDeco({ w, h, uid }: { w: number; h: number; uid: string }) {
  const p = uid.replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg viewBox="0 0 60 80" width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`${p}pot`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9c3f1c"/><stop offset="35%" stopColor="#cd5c28"/><stop offset="100%" stopColor="#8a3018"/>
        </linearGradient>
        <linearGradient id={`${p}lf`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#48b060"/><stop offset="50%" stopColor="#38924e"/><stop offset="100%" stopColor="#246838"/>
        </linearGradient>
      </defs>
      <ellipse cx="30" cy="78" rx="14" ry="2" fill="rgba(0,0,0,0.2)"/>
      <path d="M14 54 Q13 76 21 76 H39 Q47 76 46 54 Z" fill={`url(#${p}pot)`}/>
      <ellipse cx="30" cy="54" rx="16" ry="4.5" fill="#c05228"/>
      <ellipse cx="30" cy="53" rx="14" ry="3" fill="#3c1e08"/>
      <path d="M18 57 Q17 69 19 74" stroke="rgba(255,255,255,0.18)" strokeWidth="3" strokeLinecap="round" fill="none"/>
      <path d="M30 53 Q26 40 28 20" stroke="#2d6e28" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <path d="M28 20 Q8 18 6 6 Q12 4 18 10 Q22 14 24 20 Q30 8 34 4 Q38 0 44 4 Q46 10 38 18 Q46 14 52 20 Q50 28 40 26 Q44 36 40 42 Q34 44 28 38 Q22 42 14 36 Q10 28 18 22 Q24 26 28 20 Z" fill={`url(#${p}lf)`}/>
      <path d="M28 20 Q22 14 18 8" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M28 20 Q34 14 38 8" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

function SucculentDeco({ w, h, uid }: { w: number; h: number; uid: string }) {
  const p = uid.replace(/[^a-zA-Z0-9]/g, '')
  const outer = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    return { cx: 30 + Math.cos(a) * 14, cy: 36 + Math.sin(a) * 10, rot: (i / 8) * 360 }
  })
  const inner = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2
    return { cx: 30 + Math.cos(a) * 7, cy: 34 + Math.sin(a) * 6, rot: (i / 6) * 360 }
  })
  return (
    <svg viewBox="0 0 60 80" width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`${p}pot`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9c3f1c"/><stop offset="35%" stopColor="#cd5c28"/><stop offset="100%" stopColor="#8a3018"/>
        </linearGradient>
        <radialGradient id={`${p}out`} cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#68c858"/><stop offset="100%" stopColor="#286828"/>
        </radialGradient>
        <radialGradient id={`${p}in`} cx="40%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#80d868"/><stop offset="100%" stopColor="#326832"/>
        </radialGradient>
      </defs>
      <ellipse cx="30" cy="78" rx="12" ry="2" fill="rgba(0,0,0,0.18)"/>
      <path d="M16 58 Q15 76 22 76 H38 Q45 76 44 58 Z" fill={`url(#${p}pot)`}/>
      <ellipse cx="30" cy="58" rx="14" ry="3.5" fill="#c05228"/>
      <ellipse cx="30" cy="57" rx="12" ry="2.5" fill="#3c1e08"/>
      <path d="M21 61 Q20 70 22 74" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      {outer.map((pt, i) => (
        <ellipse key={i} cx={pt.cx} cy={pt.cy} rx="8" ry="5.5"
          fill={`url(#${p}out)`} transform={`rotate(${pt.rot},${pt.cx},${pt.cy})`}/>
      ))}
      {inner.map((pt, i) => (
        <ellipse key={i} cx={pt.cx} cy={pt.cy} rx="6" ry="4"
          fill={`url(#${p}in)`} transform={`rotate(${pt.rot},${pt.cx},${pt.cy})`}/>
      ))}
      <circle cx="30" cy="34" r="5" fill="#a0e080"/>
      <circle cx="30" cy="34" r="3" fill="#c0f0a0"/>
      <circle cx="29" cy="33" r="1.5" fill="rgba(255,255,255,0.4)"/>
    </svg>
  )
}

function TrophyDeco({ w, h, uid }: { w: number; h: number; uid: string }) {
  const p = uid.replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg viewBox="0 0 60 80" width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`${p}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0c830"/><stop offset="35%" stopColor="#e8b020"/>
          <stop offset="65%" stopColor="#d49010"/><stop offset="100%" stopColor="#a06808"/>
        </linearGradient>
        <linearGradient id={`${p}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d0a010"/><stop offset="100%" stopColor="#8a6008"/>
        </linearGradient>
      </defs>
      <ellipse cx="30" cy="78" rx="16" ry="2.5" fill="rgba(0,0,0,0.22)"/>
      <rect x="16" y="70" width="28" height="7" rx="2" fill={`url(#${p}b)`}/>
      <rect x="19" y="63" width="22" height="8" rx="2" fill={`url(#${p}b)`}/>
      <rect x="26" y="53" width="8" height="12" rx="2" fill={`url(#${p}g)`}/>
      <path d="M14 20 Q12 38 18 48 Q22 54 30 54 Q38 54 42 48 Q48 38 46 20 Z" fill={`url(#${p}g)`}/>
      <path d="M18 22 Q17 36 21 46" stroke="rgba(255,255,255,0.28)" strokeWidth="3" strokeLinecap="round" fill="none"/>
      <path d="M14 26 Q4 26 4 34 Q4 42 14 42" stroke={`url(#${p}g)`} strokeWidth="4" fill="none" strokeLinecap="round"/>
      <path d="M46 26 Q56 26 56 34 Q56 42 46 42" stroke={`url(#${p}g)`} strokeWidth="4" fill="none" strokeLinecap="round"/>
      <ellipse cx="30" cy="20" rx="16" ry="3.5" fill="#e8c020"/>
      <path d="M30 26 L31.5 31 L36.5 31 L32.5 34 L34 39 L30 36 L26 39 L27.5 34 L23.5 31 L28.5 31 Z" fill="#fff0a0"/>
      <ellipse cx="30" cy="20" rx="10" ry="2" fill="rgba(255,255,255,0.2)"/>
    </svg>
  )
}

function GlobeDeco({ w, h, uid }: { w: number; h: number; uid: string }) {
  const p = uid.replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg viewBox="0 0 60 80" width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id={`${p}g`} cx="38%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#7ab8e8"/><stop offset="40%" stopColor="#4a8ec8"/><stop offset="100%" stopColor="#1a5498"/>
        </radialGradient>
        <linearGradient id={`${p}st`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8a6038"/><stop offset="100%" stopColor="#5a3c20"/>
        </linearGradient>
      </defs>
      <ellipse cx="30" cy="78" rx="14" ry="2" fill="rgba(0,0,0,0.2)"/>
      <ellipse cx="30" cy="72" rx="12" ry="3" fill="#6a4828"/>
      <rect x="22" y="63" width="16" height="10" rx="2" fill={`url(#${p}st)`}/>
      <ellipse cx="30" cy="63" rx="10" ry="2.5" fill="#7a5032"/>
      <circle cx="30" cy="36" r="23" fill="none" stroke="#5a7890" strokeWidth="2.5"/>
      <circle cx="30" cy="36" r="22" fill={`url(#${p}g)`}/>
      <path d="M28 20 Q32 18 34 22 Q36 26 34 32 Q32 36 30 36 Q26 34 24 28 Q24 22 28 20 Z" fill="#68b058" opacity="0.85"/>
      <path d="M18 24 Q20 20 22 22 Q24 26 22 32 Q20 38 18 40 Q14 38 14 32 Q14 26 18 24 Z" fill="#58a048" opacity="0.75"/>
      <path d="M36 20 Q42 18 46 24 Q48 30 44 36 Q40 38 36 34 Q34 28 36 20 Z" fill="#68b058" opacity="0.7"/>
      <ellipse cx="30" cy="36" rx="22" ry="6" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8"/>
      <ellipse cx="30" cy="28" rx="18" ry="5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8"/>
      <ellipse cx="30" cy="44" rx="18" ry="5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8"/>
      <ellipse cx="30" cy="36" rx="5" ry="22" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8"/>
      <circle cx="22" cy="27" r="3.5" fill="rgba(255,255,255,0.13)"/>
    </svg>
  )
}

function CandleDeco({ w, h, uid }: { w: number; h: number; uid: string }) {
  const p = uid.replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg viewBox="0 0 60 80" width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`${p}c`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#d8cfc0"/><stop offset="30%" stopColor="#f0ece0"/>
          <stop offset="70%" stopColor="#e8e0d0"/><stop offset="100%" stopColor="#c0b8a8"/>
        </linearGradient>
        <linearGradient id={`${p}fl`} x1="0.5" y1="1" x2="0.5" y2="0">
          <stop offset="0%" stopColor="#ff6010"/><stop offset="40%" stopColor="#ff9020"/><stop offset="100%" stopColor="#ffe060"/>
        </linearGradient>
        <linearGradient id={`${p}h`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a89880"/><stop offset="50%" stopColor="#c8b898"/><stop offset="100%" stopColor="#988878"/>
        </linearGradient>
      </defs>
      <ellipse cx="30" cy="78" rx="11" ry="2" fill="rgba(0,0,0,0.18)"/>
      <ellipse cx="30" cy="70" rx="14" ry="3.5" fill={`url(#${p}h)`}/>
      <rect x="22" y="66" width="16" height="6" rx="2" fill={`url(#${p}h)`}/>
      <ellipse cx="30" cy="66" rx="11" ry="2.5" fill="#b8a888"/>
      <rect x="20" y="16" width="20" height="52" rx="2" fill={`url(#${p}c)`}/>
      <rect x="23" y="18" width="6" height="48" rx="3" fill="rgba(255,255,255,0.18)"/>
      <path d="M22 26 Q21 38 22 52" stroke="#e0d8c8" strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.55"/>
      <ellipse cx="30" cy="16" rx="10" ry="2" fill="#d8cfc0"/>
      <ellipse cx="30" cy="15.5" rx="7" ry="1.5" fill="#f0ece0" opacity="0.8"/>
      <line x1="30" y1="16" x2="30" y2="10" stroke="#3c2808" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="30" cy="5" r="5.5" fill="rgba(255,160,20,0.18)"/>
      <path d="M30 10 Q25 4 26 0 Q30 -3 34 0 Q35 4 30 10 Z" fill={`url(#${p}fl)`}/>
      <path d="M30 8 Q28 4 28.5 1.5 Q30 0 31.5 1.5 Q32 4 30 8 Z" fill="#fff080"/>
    </svg>
  )
}

function HourglassDeco({ w, h, uid }: { w: number; h: number; uid: string }) {
  const p = uid.replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg viewBox="0 0 60 80" width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`${p}fr`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7a5030"/><stop offset="40%" stopColor="#a06c40"/><stop offset="100%" stopColor="#5a3820"/>
        </linearGradient>
        <linearGradient id={`${p}gl`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(160,200,220,0.45)"/><stop offset="100%" stopColor="rgba(100,150,180,0.2)"/>
        </linearGradient>
        <linearGradient id={`${p}sd`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8a040"/><stop offset="100%" stopColor="#c07020"/>
        </linearGradient>
      </defs>
      <ellipse cx="30" cy="78" rx="13" ry="2" fill="rgba(0,0,0,0.2)"/>
      <rect x="18" y="68" width="24" height="8" rx="3" fill={`url(#${p}fr)`}/>
      <rect x="18" y="8" width="24" height="8" rx="3" fill={`url(#${p}fr)`}/>
      <rect x="18" y="14" width="4" height="56" rx="2" fill={`url(#${p}fr)`}/>
      <rect x="38" y="14" width="4" height="56" rx="2" fill={`url(#${p}fr)`}/>
      <path d="M22 16 L38 16 L32 42 L28 42 Z" fill={`url(#${p}gl)`} stroke="rgba(180,220,240,0.3)" strokeWidth="0.5"/>
      <path d="M28 42 L32 42 L38 68 L22 68 Z" fill={`url(#${p}gl)`} stroke="rgba(180,220,240,0.3)" strokeWidth="0.5"/>
      <path d="M22.5 17 L37.5 17 L32.5 36 L27.5 36 Z" fill={`url(#${p}sd)`} opacity="0.85"/>
      <rect x="29" y="40" width="2" height="5" fill="#d08030" opacity="0.7"/>
      <path d="M23 67 Q30 54 37 67 Z" fill={`url(#${p}sd)`}/>
      <line x1="24" y1="18" x2="28" y2="38" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

function CrystalDeco({ w, h, uid }: { w: number; h: number; uid: string }) {
  const p = uid.replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg viewBox="0 0 60 80" width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id={`${p}orb`} cx="38%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#e0c8ff"/><stop offset="30%" stopColor="#b070e8"/>
          <stop offset="65%" stopColor="#7030c8"/><stop offset="100%" stopColor="#3010a0"/>
        </radialGradient>
        <radialGradient id={`${p}glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(180,80,255,0.28)"/><stop offset="100%" stopColor="rgba(180,80,255,0)"/>
        </radialGradient>
        <linearGradient id={`${p}st`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#484848"/><stop offset="50%" stopColor="#686868"/><stop offset="100%" stopColor="#383838"/>
        </linearGradient>
      </defs>
      <circle cx="30" cy="34" r="26" fill={`url(#${p}glow)`}/>
      <ellipse cx="30" cy="78" rx="13" ry="2" fill="rgba(0,0,0,0.2)"/>
      <path d="M22 58 Q20 70 18 74 L42 74 Q40 70 38 58 Z" fill={`url(#${p}st)`}/>
      <ellipse cx="30" cy="74" rx="14" ry="3" fill="#505050"/>
      <path d="M26 52 Q30 47 34 52 L32 58 L28 58 Z" fill="#585858"/>
      <ellipse cx="30" cy="52" rx="13" ry="3" fill="rgba(0,0,0,0.4)"/>
      <circle cx="30" cy="36" r="20" fill={`url(#${p}orb)`}/>
      <ellipse cx="23" cy="28" rx="6" ry="4" fill="rgba(255,255,255,0.3)" transform="rotate(-20,23,28)"/>
      <ellipse cx="21" cy="26" rx="3" ry="2" fill="rgba(255,255,255,0.45)" transform="rotate(-20,21,26)"/>
      {([[36,32],[38,44],[24,42],[42,36]] as [number,number][]).map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="1.2" fill="rgba(255,255,255,0.6)"/>
      ))}
    </svg>
  )
}

function BooksDeco({ w, h, uid: _uid }: { w: number; h: number; uid: string }) {
  return (
    <svg viewBox="0 0 60 80" width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <ellipse cx="30" cy="78" rx="22" ry="2.5" fill="rgba(0,0,0,0.2)"/>
      <rect x="10" y="62" width="42" height="14" rx="2" fill="#2a8898"/>
      <rect x="10" y="62" width="7" height="14" rx="2" fill="#1a6878"/>
      <rect x="11" y="63" width="3.5" height="12" fill="rgba(255,255,255,0.12)"/>
      <rect x="49" y="62.5" width="3" height="13" rx="0.5" fill="#f0ece0" opacity="0.5"/>
      <rect x="12" y="48" width="38" height="14" rx="2" fill="#b83030"/>
      <rect x="12" y="48" width="7" height="14" rx="2" fill="#882020"/>
      <rect x="13" y="49" width="3.5" height="12" fill="rgba(255,255,255,0.12)"/>
      <rect x="47" y="48.5" width="3" height="13" rx="0.5" fill="#f0ece0" opacity="0.5"/>
      <g transform="rotate(-2,31,43)">
        <rect x="14" y="36" width="34" height="13" rx="2" fill="#c8a020"/>
        <rect x="14" y="36" width="6" height="13" rx="2" fill="#987810"/>
        <rect x="15" y="37" width="3" height="11" fill="rgba(255,255,255,0.12)"/>
        <rect x="45" y="36.5" width="3" height="12" rx="0.5" fill="#f0ece0" opacity="0.5"/>
        <rect x="22" y="42" width="16" height="1.5" rx="0.75" fill="rgba(255,255,255,0.3)"/>
      </g>
      <rect x="20" y="67" width="20" height="1.5" rx="0.75" fill="rgba(255,255,255,0.3)"/>
      <rect x="20" y="53" width="18" height="1.5" rx="0.75" fill="rgba(255,255,255,0.3)"/>
    </svg>
  )
}

function OwlDeco({ w, h, uid }: { w: number; h: number; uid: string }) {
  const p = uid.replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg viewBox="0 0 60 80" width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id={`${p}body`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#c8a060"/><stop offset="50%" stopColor="#a07840"/><stop offset="100%" stopColor="#6a4e28"/>
        </radialGradient>
        <radialGradient id={`${p}eye`} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#f0e060"/><stop offset="60%" stopColor="#d0b020"/><stop offset="100%" stopColor="#906808"/>
        </radialGradient>
      </defs>
      <ellipse cx="30" cy="78" rx="14" ry="2" fill="rgba(0,0,0,0.2)"/>
      <rect x="10" y="66" width="40" height="9" rx="4" fill="#5a3c20"/>
      <rect x="10" y="66" width="40" height="4" rx="2" fill="#7a5030"/>
      <path d="M22 70 Q20 78 18 74 Q22 72 22 70 Z" fill="#8a6030"/>
      <path d="M38 70 Q40 78 42 74 Q38 72 38 70 Z" fill="#8a6030"/>
      <ellipse cx="30" cy="50" rx="18" ry="22" fill={`url(#${p}body)`}/>
      <ellipse cx="30" cy="57" rx="10" ry="12" fill="#d4b870" opacity="0.45"/>
      {[50,54,58,62].map(y => (
        <path key={y} d={`M25 ${y} Q30 ${y-2} 35 ${y}`} stroke="#a88040" strokeWidth="0.8" fill="none" opacity="0.55"/>
      ))}
      <path d="M22 30 Q20 20 22 18 Q24 22 24 30" fill="#8a6030"/>
      <path d="M38 30 Q40 20 38 18 Q36 22 36 30" fill="#8a6030"/>
      <ellipse cx="30" cy="37" rx="14" ry="13" fill="#d4a060" opacity="0.55"/>
      <circle cx="23" cy="35" r="7" fill={`url(#${p}eye)`}/>
      <circle cx="37" cy="35" r="7" fill={`url(#${p}eye)`}/>
      <circle cx="23" cy="35" r="4.5" fill="#1a1008"/>
      <circle cx="37" cy="35" r="4.5" fill="#1a1008"/>
      <circle cx="21" cy="33" r="1.5" fill="rgba(255,255,255,0.7)"/>
      <circle cx="35" cy="33" r="1.5" fill="rgba(255,255,255,0.7)"/>
      <path d="M27 41 L30 47 L33 41 Q30 39 27 41 Z" fill="#d49828"/>
      <ellipse cx="22" cy="42" rx="4" ry="7" fill="rgba(255,255,255,0.08)" transform="rotate(-15,22,42)"/>
    </svg>
  )
}

function CatDeco({ w, h, uid }: { w: number; h: number; uid: string }) {
  const p = uid.replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg viewBox="0 0 60 80" width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id={`${p}body`} cx="38%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#888888"/><stop offset="55%" stopColor="#606060"/><stop offset="100%" stopColor="#383838"/>
        </radialGradient>
        <radialGradient id={`${p}face`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#989898"/><stop offset="100%" stopColor="#585858"/>
        </radialGradient>
      </defs>
      <ellipse cx="30" cy="78" rx="14" ry="2" fill="rgba(0,0,0,0.2)"/>
      <path d="M42 70 Q56 62 54 46 Q52 40 46 44" stroke="#504848" strokeWidth="6" strokeLinecap="round" fill="none"/>
      <path d="M42 70 Q56 62 54 46 Q52 40 46 44" stroke="#686060" strokeWidth="3" strokeLinecap="round" fill="none"/>
      <ellipse cx="29" cy="58" rx="18" ry="20" fill={`url(#${p}body)`}/>
      <ellipse cx="29" cy="61" rx="10" ry="12" fill="rgba(220,220,220,0.12)"/>
      <ellipse cx="22" cy="76" rx="6" ry="3.5" fill="#585858"/>
      <ellipse cx="36" cy="76" rx="6" ry="3.5" fill="#585858"/>
      {[-2,0,2].map(dx => <line key={dx} x1={22+dx} y1="77" x2={22+dx} y2="79" stroke="#404040" strokeWidth="0.8" strokeLinecap="round"/>)}
      {[-2,0,2].map(dx => <line key={dx} x1={36+dx} y1="77" x2={36+dx} y2="79" stroke="#404040" strokeWidth="0.8" strokeLinecap="round"/>)}
      <rect x="22" y="34" width="16" height="12" rx="6" fill="#585858"/>
      <circle cx="30" cy="27" r="16" fill={`url(#${p}face)`}/>
      <path d="M16 20 L12 10 L22 18 Z" fill="#585858"/>
      <path d="M44 20 L48 10 L38 18 Z" fill="#585858"/>
      <path d="M17 19 L14 12 L21 17 Z" fill="#c06060" opacity="0.45"/>
      <path d="M43 19 L46 12 L39 17 Z" fill="#c06060" opacity="0.45"/>
      <ellipse cx="23" cy="26" rx="5" ry="5.5" fill="#c8c040"/>
      <ellipse cx="37" cy="26" rx="5" ry="5.5" fill="#c8c040"/>
      <ellipse cx="23" cy="26" rx="2.5" ry="5" fill="#101010"/>
      <ellipse cx="37" cy="26" rx="2.5" ry="5" fill="#101010"/>
      <circle cx="21.5" cy="24" r="1.5" fill="rgba(255,255,255,0.7)"/>
      <circle cx="35.5" cy="24" r="1.5" fill="rgba(255,255,255,0.7)"/>
      <path d="M28 31 L30 33 L32 31 Q30 29 28 31 Z" fill="#e07090"/>
      <path d="M30 33 Q26 36 24 35" stroke="#808080" strokeWidth="0.8" fill="none"/>
      <path d="M30 33 Q34 36 36 35" stroke="#808080" strokeWidth="0.8" fill="none"/>
      <line x1="8" y1="29" x2="22" y2="31" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8"/>
      <line x1="8" y1="32" x2="22" y2="32" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8"/>
      <line x1="52" y1="29" x2="38" y2="31" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8"/>
      <line x1="52" y1="32" x2="38" y2="32" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8"/>
    </svg>
  )
}

// ─── Illustration dispatcher ───────────────────────────────────────────────────
function DecoIllustration({ id, uid, size }: { id: string; uid: string; size: number }) {
  const resolvedId = EMOJI_TO_ID[id] ?? id
  const h = size
  const w = size * 0.75
  const props = { w, h, uid }
  switch (resolvedId) {
    case 'cactus':    return <CactusDeco {...props}/>
    case 'flower':    return <FlowerDeco {...props}/>
    case 'monstera':  return <MonsteraDeco {...props}/>
    case 'succulent': return <SucculentDeco {...props}/>
    case 'trophy':    return <TrophyDeco {...props}/>
    case 'globe':     return <GlobeDeco {...props}/>
    case 'candle':    return <CandleDeco {...props}/>
    case 'hourglass': return <HourglassDeco {...props}/>
    case 'crystal':   return <CrystalDeco {...props}/>
    case 'books':     return <BooksDeco {...props}/>
    case 'owl':       return <OwlDeco {...props}/>
    case 'cat':       return <CatDeco {...props}/>
    default:          return <span style={{ fontSize: size * 0.7, lineHeight: 1 }}>{id}</span>
  }
}
