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
const DECO_SIZE = 64   // px at scale=1 — matches the 64px source images

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
// Microsoft Fluent Emoji 3D — open source, CGI-rendered 3D objects, PNG with transparency
// These are NOT flat emoji icons; they are photorealistic 3D renders by Microsoft (MIT license)
const FLUENT_CDN = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/'

interface DecoItem { id: string; label: string; group: string; path: string }

const DECO_CATALOG: DecoItem[] = [
  // Plants
  { id: 'cactus',    label: 'Cactus',      group: 'Plants',  path: 'Cactus/3D/cactus_3d.png'                                   },
  { id: 'monstera',  label: 'Monstera',    group: 'Plants',  path: 'Potted%20plant/3D/potted_plant_3d.png'                     },
  { id: 'mushroom',  label: 'Mushroom',    group: 'Plants',  path: 'Mushroom/3D/mushroom_3d.png'                               },
  { id: 'flower',    label: 'Flower',      group: 'Plants',  path: 'Cherry%20blossom/3D/cherry_blossom_3d.png'                 },
  { id: 'sunflower', label: 'Sunflower',   group: 'Plants',  path: 'Sunflower/3D/sunflower_3d.png'                            },
  // Objects
  { id: 'trophy',    label: 'Trophy',      group: 'Objects', path: 'Trophy/3D/trophy_3d.png'                                   },
  { id: 'globe',     label: 'Globe',       group: 'Objects', path: 'Globe%20showing%20Americas/3D/globe_showing_americas_3d.png'},
  { id: 'candle',    label: 'Candle',      group: 'Objects', path: 'Candle/3D/candle_3d.png'                                   },
  { id: 'hourglass', label: 'Hourglass',   group: 'Objects', path: 'Hourglass%20done/3D/hourglass_done_3d.png'                 },
  { id: 'crystal',   label: 'Crystal',     group: 'Objects', path: 'Crystal%20ball/3D/crystal_ball_3d.png'                     },
  { id: 'books',     label: 'Books',       group: 'Objects', path: 'Books/3D/books_3d.png'                                     },
  { id: 'coffee',    label: 'Coffee',      group: 'Objects', path: 'Hot%20beverage/3D/hot_beverage_3d.png'                     },
  // Charms
  { id: 'owl',       label: 'Owl',         group: 'Charms',  path: 'Owl/3D/owl_3d.png'                                         },
  { id: 'cat',       label: 'Cat',         group: 'Charms',  path: 'Cat/3D/cat_3d.png'                                         },
  { id: 'teddy',     label: 'Teddy',       group: 'Charms',  path: 'Teddy%20bear/3D/teddy_bear_3d.png'                         },
  { id: 'shell',     label: 'Shell',       group: 'Charms',  path: 'Spiral%20shell/3D/spiral_shell_3d.png'                     },
]
const DECO_BY_ID = Object.fromEntries(DECO_CATALOG.map(d => [d.id, d]))
const DECO_GROUPS_LIST = ['Plants', 'Objects', 'Charms']

const decoUrl = (path: string) => `${FLUENT_CDN}${path}`

// Legacy emoji char → new id (for saved shelves from old versions)
const EMOJI_TO_ID: Record<string, string> = {
  '🪴': 'monstera', '🌵': 'cactus',   '🌿': 'monstera', '🍀': 'mushroom',
  '🌷': 'flower',   '🌻': 'sunflower','🎍': 'monstera',
  '🕯️': 'candle',  '🏆': 'trophy',   '🌍': 'globe',    '🕰️': 'globe',
  '☕': 'coffee',   '🫖': 'coffee',   '🖼️': 'books',   '💡': 'candle',
  '🔮': 'crystal',  '🧭': 'globe',    '⏳': 'hourglass','📷': 'books',
  '🦉': 'owl',      '🐈': 'cat',      '🧸': 'teddy',    '🐚': 'shell',
  '🗿': 'trophy',   '⛵': 'globe',    '📚': 'books',
}

// Real wood grain via SVG feTurbulence — renders procedural grain that overlays color gradients
// baseFrequency 0.012 horizontal (long grain lines) + 0.75 vertical (tight cross-grain)
const WOOD_GRAIN_TEX = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.012 0.75' numOctaves='5' seed='7' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.28 0'/%3E%3C/filter%3E%3Crect width='400' height='200' filter='url(%23g)'/%3E%3C/svg%3E\")"

// ─── Types ────────────────────────────────────────────────────────────────────
type ShelfPos = { shelf: number; left: number; rot: number; scale: number }

interface ShelfDeco {
  uid: string
  emoji: string   // stores id (e.g. 'cactus') or legacy emoji char
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
const resolveDecoId = (emoji: string) => EMOJI_TO_ID[emoji] ?? emoji

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
  const [showDecoBar, setShowDecoBar] = useState(false)
  const [decoBarGroup, setDecoBarGroup] = useState('Plants')
  // Floating deco being dragged from the bar onto the shelf
  const [floatingDeco, setFloatingDeco] = useState<{ id: string; x: number; y: number } | null>(null)

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
        emoji: resolveDecoId(d.emoji ?? 'cactus'),
        shelf: d.shelf ?? 0,
        left: d.left ?? 0,
        scale: d.scale ?? 1,
      }))
      setConfig({ ...DEFAULT_CONFIG, ...savedCfg, decoItems })
    } catch { /* ignore */ }
    ;(async () => {
      const { data } = await supabase
        .from('user_books').select('id,spine_url,shelf_pos,book:books(title,author,cover_url)')
        .eq('user_id', user.id).not('shelf_pos', 'is', null)
      if (!data) return
      setBooks((data as any[]).map(r => ({
        userBookId: r.id, title: r.book?.title ?? 'Unknown',
        author: r.book?.author ?? '', coverUrl: r.book?.cover_url ?? null,
        spineUrl: r.spine_url ?? null, pos: r.shelf_pos,
      })))
    })()
  }, [user])

  const saveRows = (n: number) => { if (user) localStorage.setItem(`cc_shelf_rows_${user.id}`, String(n)) }
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
      const g = gestureRef.current; if (!g) return
      if (g.type === 'drag') {
        const el = rowsRef.current; if (!el) return
        const r = el.getBoundingClientRect()
        const shelf = Math.max(0, Math.min(rows - 1, Math.floor((e.clientY - r.top) / ROW_H)))
        if (g.isDeco) {
          const left = Math.max(6, Math.min(e.clientX - r.left - g.grabOffset, el.offsetWidth - DECO_SIZE - 6))
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
    gestureRef.current = { type: 'rotate', id: book.userBookId, cx: r.left + r.width/2, cy: r.top + r.height/2, startAng: Math.atan2(e.clientY-(r.top+r.height/2), e.clientX-(r.left+r.width/2))*180/Math.PI, startRot: book.pos.rot }
    setGesturing(true)
  }
  const scaleDown = (e: React.PointerEvent, book: ShelfBook) => {
    e.stopPropagation()
    const wrap = (e.currentTarget as HTMLElement).closest('[data-spine]') as HTMLElement
    const r = wrap.getBoundingClientRect()
    const cx = r.left + r.width/2, cy = r.top + r.height/2
    gestureRef.current = { type: 'scale', id: book.userBookId, cx, cy, startDist: Math.hypot(e.clientX-cx, e.clientY-cy)||1, startScale: book.pos.scale }
    setGesturing(true)
  }

  // ─── Deco bar drag-to-shelf ────────────────────────────────────────────────
  const startDecoFromBar = (e: React.PointerEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    setFloatingDeco({ id, x: e.clientX, y: e.clientY })
    const onMove = (ev: PointerEvent) => setFloatingDeco({ id, x: ev.clientX, y: ev.clientY })
    const onUp = (ev: PointerEvent) => {
      setFloatingDeco(null)
      const el = rowsRef.current
      if (el) {
        const r = el.getBoundingClientRect()
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
          const shelf = Math.max(0, Math.min(rows - 1, Math.floor((ev.clientY - r.top) / ROW_H)))
          const left = Math.max(6, Math.min(ev.clientX - r.left - DECO_SIZE / 2, el.offsetWidth - DECO_SIZE - 6))
          const uid = `deco_${Date.now()}_${Math.random().toString(36).slice(2)}`
          const item: ShelfDeco = { uid, emoji: id, shelf, left, scale: 1 }
          saveConfig({ ...config, decoItems: [...config.decoItems, item] })
          setEditMode(true)
          setSelectedDeco(uid)
        }
      }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
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
    const { error } = await supabase.from('user_books').update({ shelf_pos: pos }).eq('id', lb.userBookId)
    if (error) console.warn('shelf_pos column missing — run migration 016_virtual_shelf.sql')
    setBooks(prev => [...prev.filter(b => b.userBookId !== lb.userBookId), { ...lb, pos }])
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
    let left = 6
    const wallW = rowsRef.current?.offsetWidth ?? 360
    const updatedBooks = books.map(b => {
      if (b.pos.shelf !== lastRow) return b
      const newPos = { ...b.pos, shelf: lastRow - 1, left }
      left = Math.min(left + spineSize(b.userBookId).w * b.pos.scale + 8, wallW - 40)
      scheduleSave(b.userBookId, newPos)
      return { ...b, pos: newPos }
    })
    setBooks(updatedBooks)
    const n = rows - 1; setRows(n); saveRows(n)
  }

  const openLibSheet = async () => {
    setShowLibSheet(true); setLibLoading(true)
    const { data, error } = await supabase
      .from('user_books').select('id,spine_url,book:books(title,author,cover_url)')
      .eq('user_id', user!.id).is('shelf_pos', null)
    if (error) {
      const { data: all } = await supabase
        .from('user_books').select('id,spine_url,book:books(title,author,cover_url)')
        .eq('user_id', user!.id)
      setLibLoading(false)
      const onShelf = new Set(books.map(b => b.userBookId))
      setLibBooks(((all as any[]) ?? []).filter(r => !onShelf.has(r.id)).map(r => ({
        userBookId: r.id, title: r.book?.title ?? 'Unknown', author: r.book?.author ?? '',
        coverUrl: r.book?.cover_url ?? null, spineUrl: r.spine_url ?? null,
      }))); return
    }
    setLibLoading(false)
    setLibBooks(((data as any[]) ?? []).map(r => ({
      userBookId: r.id, title: r.book?.title ?? 'Unknown', author: r.book?.author ?? '',
      coverUrl: r.book?.cover_url ?? null, spineUrl: r.spine_url ?? null,
    })))
  }

  const handleSpineCaptured = async (dataUrl: string) => {
    if (!spineTarget || !user) return
    const target = spineTarget
    setSpineTarget(null); setSpineSaving(true)
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const path = `${user.id}/${target.userBookId}.jpg`
      const { error } = await supabase.storage.from('book-spines').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (!error) {
        const spineUrl = supabase.storage.from('book-spines').getPublicUrl(path).data.publicUrl
        await supabase.from('user_books').update({ spine_url: spineUrl }).eq('id', target.userBookId)
        setBooks(prev => prev.map(b => b.userBookId === target.userBookId ? { ...b, spineUrl } : b))
      }
    } finally { setSpineSaving(false) }
  }

  const removeDeco = (uid: string) => {
    saveConfig({ ...config, decoItems: config.decoItems.filter(d => d.uid !== uid) })
    if (selectedDeco === uid) setSelectedDeco(null)
  }
  const scaleDeco = (uid: string, delta: number) => {
    saveConfig({ ...config, decoItems: config.decoItems.map(d =>
      d.uid === uid ? { ...d, scale: Math.max(0.5, Math.min(2.5, (d.scale ?? 1) + delta)) } : d) })
  }

  const isEmpty = books.length === 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* ── Hint bar ── */}
      <div style={{ padding: '0 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 28, flexShrink: 0 }}>
        <span style={{ fontSize: 11.5, color: editMode ? theme.fg : theme.muted, fontFamily: '-apple-system,system-ui,sans-serif' }}>
          {editMode ? 'Edit mode · drag freely' : isEmpty ? '' : `${books.length} on the shelf`}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Decor toggle */}
          <button onClick={() => setShowDecoBar(v => !v)}
            style={{ background: showDecoBar ? theme.fg : theme.bgSecondary, border: `1px solid ${showDecoBar ? theme.fg : theme.border}`, borderRadius: 8, cursor: 'pointer', padding: '4px 10px', fontSize: 11.5, fontWeight: showDecoBar ? 600 : 400, color: showDecoBar ? theme.bg : theme.muted, fontFamily: '-apple-system,system-ui,sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4 5H6M5 4V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M8.5 8.5L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            Decor
          </button>
          {/* Edit toggle */}
          <button onClick={() => { setEditMode(m => !m); setSelected(null); setSelectedDeco(null) }}
            style={{ background: editMode ? theme.fg : theme.bgSecondary, border: `1px solid ${editMode ? theme.fg : theme.border}`, borderRadius: 8, cursor: 'pointer', padding: '4px 10px', fontSize: 11.5, fontWeight: editMode ? 600 : 400, color: editMode ? theme.bg : theme.muted, fontFamily: '-apple-system,system-ui,sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}>
            {editMode ? 'Done' : (
              <><svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M9.5 1.5l3 3L4 13l-3 .5.5-3L9.5 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>Edit</>
            )}
          </button>
          <button onClick={() => setShowStyleSheet(true)} style={{ background: theme.bgSecondary, border: `1px solid ${theme.border}`, borderRadius: 8, cursor: 'pointer', padding: '4px 10px', fontSize: 11.5, color: theme.muted, fontFamily: '-apple-system,system-ui,sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3"/><path d="M7 1v2M7 11v2M1 7h2M11 7h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
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
        <div style={{ height: 22, background: `${WOOD_GRAIN_V},linear-gradient(to bottom,${board.top},${board.face} 55%,${board.edge})`, boxShadow: '0 5px 12px rgba(0,0,0,0.45)', borderTop: `1px solid ${board.top}` }}/>
        <div style={{ height: 4, background: `linear-gradient(to bottom,${board.edge},${board.face})` }}/>
      </div>

      {/* ── Scroll container ── */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: showDecoBar ? 160 : 110 }}>
        <div style={{ position: 'relative' }}>
          {/* Side walls */}
          <div style={{ position:'absolute',top:0,left:0,width:18,bottom:0,zIndex:20,pointerEvents:'none',
            background:`${WOOD_GRAIN_H},linear-gradient(to right,${board.top},${board.face} 45%,${board.edge})`,
            boxShadow:'inset -5px 0 12px rgba(0,0,0,0.55),inset 1px 0 0 rgba(255,255,255,0.12)' }}/>
          <div style={{ position:'absolute',top:0,right:0,width:18,bottom:0,zIndex:20,pointerEvents:'none',
            background:`${WOOD_GRAIN_H},linear-gradient(to left,${board.top},${board.face} 45%,${board.edge})`,
            boxShadow:'inset 5px 0 12px rgba(0,0,0,0.55),inset -1px 0 0 rgba(255,255,255,0.12)' }}/>

          <div ref={rowsRef} onPointerDown={() => { setSelected(null); setSelectedDeco(null) }}
            style={{ position:'relative',height:rows*ROW_H,background:wallBg,marginLeft:18,marginRight:18,
              boxShadow:'inset 0 10px 28px rgba(0,0,0,0.6),inset 0 -6px 20px rgba(0,0,0,0.5),inset 8px 0 16px rgba(0,0,0,0.35),inset -8px 0 16px rgba(0,0,0,0.35)' }}>

            {/* Shelf boards */}
            {Array.from({ length: rows }).map((_, r) => (
              <div key={r} style={{ position:'absolute',left:-2,right:-2,top:r*ROW_H+DECK_H }}>
                <div style={{ position:'absolute',bottom:BOARD_H-1,left:0,right:0,height:22,background:'linear-gradient(to top,rgba(0,0,0,0.42),transparent)',pointerEvents:'none' }}/>
                <div style={{ height:2.5,background:`linear-gradient(to right,${board.edge},${board.top} 20%,${board.top} 80%,${board.edge})`,boxShadow:'0 -1px 2px rgba(255,255,255,0.15)' }}/>
                <div style={{ height:BOARD_H-2.5,background:`${WOOD_GRAIN_V},linear-gradient(to bottom,${board.top} 0%,${board.face} 42%,${board.edge} 100%)`,borderBottom:'1px solid rgba(0,0,0,0.4)',boxShadow:'0 3px 8px rgba(0,0,0,0.5)' }}/>
              </div>
            ))}

            {/* Decorations */}
            {config.decoItems.map(deco => {
              const sc = deco.scale ?? 1
              const size = DECO_SIZE * sc
              const decoTop = deco.shelf * ROW_H + DECK_H - size + 4
              const selD = deco.uid === selectedDeco
              const itemId = resolveDecoId(deco.emoji)
              const item = DECO_BY_ID[itemId]
              return (
                <div key={deco.uid}
                  onPointerDown={editMode ? (e => {
                    e.stopPropagation()
                    setSelectedDeco(deco.uid); setSelected(null)
                    const el = rowsRef.current; if (!el) return
                    gestureRef.current = { type:'drag', id:deco.uid, grabOffset:e.clientX-el.getBoundingClientRect().left-deco.left, isDeco:true }
                    setGesturing(true)
                  }) : undefined}
                  style={{ position:'absolute',left:deco.left,top:decoTop,width:size,height:size,zIndex:selD?55:15,cursor:editMode?'grab':'default',touchAction:'none' }}>
                  <img src={item ? decoUrl(item.path) : ''} alt={itemId} draggable={false}
                    style={{ width:size,height:size,objectFit:'contain',display:'block',
                      filter:'drop-shadow(0 4px 8px rgba(0,0,0,0.55))',userSelect:'none',WebkitUserSelect:'none' as any }}/>
                  {editMode && selD && (
                    <>
                      <div style={{ position:'absolute',inset:-6,border:`1.5px dashed ${theme.fg}`,borderRadius:8,pointerEvents:'none',opacity:0.5 }}/>
                      <button onPointerDown={e => { e.stopPropagation(); removeDeco(deco.uid) }}
                        style={{ position:'absolute',top:-14,right:-14,width:26,height:26,borderRadius:'50%',background:theme.fg,border:`1.5px solid ${theme.bg}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:0,zIndex:60,boxShadow:'0 2px 6px rgba(0,0,0,0.4)' }}>
                        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1L9 9M9 1L1 9" stroke={theme.bg} strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </button>
                      <div style={{ position:'absolute',bottom:-20,left:'50%',transform:'translateX(-50%)',display:'flex',gap:4,zIndex:60 }}>
                        <button onPointerDown={e => { e.stopPropagation(); scaleDeco(deco.uid,-0.15) }}
                          style={{ width:24,height:24,borderRadius:'50%',background:theme.fg,border:`1.5px solid ${theme.bg}`,color:theme.bg,cursor:'pointer',padding:0,fontSize:15,lineHeight:'1',boxShadow:'0 2px 6px rgba(0,0,0,0.4)' }}>−</button>
                        <button onPointerDown={e => { e.stopPropagation(); scaleDeco(deco.uid,0.15) }}
                          style={{ width:24,height:24,borderRadius:'50%',background:theme.fg,border:`1.5px solid ${theme.bg}`,color:theme.bg,cursor:'pointer',padding:0,fontSize:15,lineHeight:'1',boxShadow:'0 2px 6px rgba(0,0,0,0.4)' }}>+</button>
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
                  style={{ position:'absolute',left:book.pos.left,top:book.pos.shelf*ROW_H+DECK_H-sz.h,width:sz.w,height:sz.h,transform:`rotate(${book.pos.rot}deg) scale(${book.pos.scale})`,transformOrigin:'bottom center',zIndex:sel?50:10+book.pos.shelf,cursor:'grab',touchAction:'none',filter:'drop-shadow(0 4px 8px rgba(0,0,0,0.55))' }}>
                  <SpineFace book={book} w={sz.w} h={sz.h} theme={theme}/>
                  {sel && <div style={{ position:'absolute',inset:-4,border:`1.5px solid ${theme.fg}`,borderRadius:4,pointerEvents:'none' }}/>}
                  {sel && (
                    <>
                      <div style={{ position:'absolute',left:'50%',top:-22,width:1.5,height:22,background:theme.fg,transform:`scaleX(${inv})`,transformOrigin:'top center',pointerEvents:'none' }}/>
                      <Handle invScale={inv} theme={theme} onPointerDown={e => rotateDown(e,book)} style={{ left:'50%',top:-22,marginLeft:-13,transform:`translateY(-100%) scale(${inv})` }}><RotateIcon color={theme.bg}/></Handle>
                      <Handle invScale={inv} theme={theme} onPointerDown={e => scaleDown(e,book)} style={{ right:-13,bottom:-13,transform:`scale(${inv})` }}><ScaleIcon color={theme.bg}/></Handle>
                      <Handle invScale={inv} theme={theme} onPointerDown={e => { e.stopPropagation(); removeBook(book.userBookId) }} style={{ right:-13,top:-13,transform:`scale(${inv})` }}>
                        <svg width="11" height="11" viewBox="0 0 11 11"><path d="M1 1L10 10M10 1L1 10" stroke={theme.bg} strokeWidth="1.6" strokeLinecap="round"/></svg>
                      </Handle>
                      <Handle invScale={inv} theme={theme} bg={theme.bg} fg={theme.fg} onPointerDown={e => { e.stopPropagation(); setSpineTarget({ userBookId:book.userBookId,title:book.title }) }} style={{ left:-13,bottom:-13,border:`1.5px solid ${theme.fg}`,transform:`scale(${inv})` }}><CameraIcon color={theme.fg}/></Handle>
                    </>
                  )}
                </div>
              )
            })}

            {isEmpty && (
              <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'0 40px' }}>
                <div style={{ fontFamily:'Georgia,serif',fontSize:22,color:theme.fg,letterSpacing:-0.5 }}>Your shelf is empty</div>
                <div style={{ fontSize:13,color:theme.muted,marginTop:8,lineHeight:1.5,maxWidth:230,fontFamily:'-apple-system,system-ui,sans-serif' }}>Add books from your library, then capture each spine with the camera.</div>
                <button onClick={openLibSheet} style={{ marginTop:22,padding:'11px 22px',borderRadius:999,background:theme.fg,color:theme.bg,border:'none',cursor:'pointer',fontSize:14,fontWeight:500,fontFamily:'-apple-system,system-ui,sans-serif' }}>Add Books</button>
              </div>
            )}
          </div>
        </div>

        {/* Baseboard */}
        <div style={{ height:18,background:`${WOOD_GRAIN_V},linear-gradient(to top,${board.edge},${board.face} 55%,${board.top})`,boxShadow:'0 -5px 12px rgba(0,0,0,0.45)',borderBottom:`1px solid ${board.edge}` }}/>

        {/* Row management */}
        <div style={{ display:'flex',borderTop:`1px dashed ${theme.border}` }}>
          {rows > 1 && (
            <button onClick={removeLastRow} style={{ flex:1,height:50,background:'none',cursor:'pointer',border:'none',borderRight:`1px dashed ${theme.border}`,display:'flex',alignItems:'center',justifyContent:'center',gap:6,color:theme.muted,fontSize:12,fontFamily:'-apple-system,system-ui,sans-serif' }}>
              <span style={{ width:20,height:20,borderRadius:'50%',border:`1.5px solid ${theme.border}`,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:16 }}>−</span>Remove shelf
            </button>
          )}
          {rows < ROWS_MAX && (
            <button onClick={() => { const n=rows+1; setRows(n); saveRows(n) }} style={{ flex:1,height:50,background:'none',cursor:'pointer',border:'none',display:'flex',alignItems:'center',justifyContent:'center',gap:6,color:theme.muted,fontSize:12,fontFamily:'-apple-system,system-ui,sans-serif' }}>
              <span style={{ width:20,height:20,borderRadius:'50%',border:`1.5px solid ${theme.border}`,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:16 }}>+</span>Add shelf
            </button>
          )}
        </div>
      </div>

      {/* ── Decoration bar (Snapchat-style carousel) ── */}
      {showDecoBar && (
        <div style={{ position:'absolute',bottom:80,left:0,right:0,zIndex:90,background:theme.dark?'rgba(0,0,0,0.88)':'rgba(255,255,255,0.92)',backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',borderTop:`1px solid ${theme.border}`,boxShadow:'0 -8px 24px rgba(0,0,0,0.3)' } as React.CSSProperties}>
          {/* Group tabs */}
          <div style={{ display:'flex',justifyContent:'center',gap:0,padding:'10px 16px 4px' }}>
            {DECO_GROUPS_LIST.map(g => (
              <button key={g} onClick={() => setDecoBarGroup(g)}
                style={{ flex:1,padding:'5px 0',border:'none',background:'none',cursor:'pointer',fontSize:11.5,fontWeight:decoBarGroup===g?700:400,color:decoBarGroup===g?theme.fg:theme.muted,fontFamily:'-apple-system,system-ui,sans-serif',borderBottom:`2px solid ${decoBarGroup===g?theme.fg:'transparent'}`,transition:'all 0.15s' }}>
                {g}
              </button>
            ))}
          </div>
          {/* Horizontal scroll strip */}
          <div style={{ overflowX:'auto',display:'flex',gap:8,padding:'8px 16px 14px',WebkitOverflowScrolling:'touch',scrollSnapType:'x mandatory' } as React.CSSProperties}>
            {DECO_CATALOG.filter(d => d.group === decoBarGroup).map(item => (
              <div key={item.id}
                onPointerDown={e => startDecoFromBar(e, item.id)}
                style={{ flexShrink:0,scrollSnapAlign:'start',display:'flex',flexDirection:'column',alignItems:'center',gap:4,cursor:'grab',touchAction:'none',userSelect:'none',WebkitUserSelect:'none' } as React.CSSProperties}>
                <div style={{ width:64,height:64,borderRadius:14,background:theme.bgSecondary,border:`1.5px solid ${theme.border}`,display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <img src={decoUrl(item.path)} alt={item.label} draggable={false}
                    style={{ width:46,height:46,objectFit:'contain',pointerEvents:'none' }}/>
                </div>
                <span style={{ fontSize:9,color:theme.muted,fontFamily:'-apple-system,system-ui,sans-serif',textAlign:'center' }}>{item.label}</span>
              </div>
            ))}
          </div>
          <div style={{ textAlign:'center',fontSize:10.5,color:theme.muted,paddingBottom:6,fontFamily:'-apple-system,system-ui,sans-serif',opacity:0.7 }}>
            Hold & drag onto the shelf
          </div>
        </div>
      )}

      {/* ── Single + FAB ── */}
      <button onClick={openLibSheet}
        style={{ position:'absolute',bottom:22,right:22,width:54,height:54,borderRadius:'50%',background:theme.fg,color:theme.bg,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:80,boxShadow:'0 6px 20px rgba(0,0,0,0.5)',fontSize:26,lineHeight:'1',fontWeight:300 }}>
        +
      </button>

      {spineSaving && (
        <div style={{ position:'absolute',top:40,left:'50%',transform:'translateX(-50%)',background:theme.fg,color:theme.bg,borderRadius:999,padding:'6px 16px',fontSize:12,fontWeight:500,zIndex:200,whiteSpace:'nowrap' }}>Saving spine…</div>
      )}

      {spineTarget && (
        <SpineCaptureCamera bookTitle={spineTarget.title} onCapture={handleSpineCaptured} onClose={() => setSpineTarget(null)}/>
      )}

      {showLibSheet && (
        <AddFromLibSheet books={libBooks} loading={libLoading} theme={theme}
          onAdd={lb => addBook(lb,false)} onAddWithCapture={lb => addBook(lb,true)} onClose={() => setShowLibSheet(false)}/>
      )}

      {showStyleSheet && (
        <StyleSheet config={config} theme={theme} onSave={saveConfig} onClose={() => setShowStyleSheet(false)}/>
      )}

      {/* Floating deco ghost while dragging from bar */}
      {floatingDeco && (() => {
        const item = DECO_BY_ID[floatingDeco.id]
        return item ? (
          <img src={decoUrl(item.path)} alt={item.label} draggable={false}
            style={{ position:'fixed',left:floatingDeco.x-32,top:floatingDeco.y-32,width:64,height:64,objectFit:'contain',pointerEvents:'none',zIndex:1000,opacity:0.88,transform:'scale(1.15)',filter:'drop-shadow(0 8px 16px rgba(0,0,0,0.6))' }}/>
        ) : null
      })()}
    </div>
  )
}

// ─── Spine face ────────────────────────────────────────────────────────────────
function SpineFace({ book, w, h, theme }: { book: ShelfBook; w: number; h: number; theme: Theme }) {
  if (book.spineUrl) {
    return (
      <div style={{ width:'100%',height:'100%',borderRadius:2,overflow:'hidden',position:'relative',boxShadow:'inset 0 0 14px rgba(0,0,0,0.55)' }}>
        <img src={book.spineUrl} alt={book.title} draggable={false} style={{ width:'100%',height:'100%',objectFit:'fill',display:'block',pointerEvents:'none' }}/>
        <div style={{ position:'absolute',top:0,bottom:0,left:0,width:2,background:'rgba(255,255,255,0.16)' }}/>
        <div style={{ position:'absolute',top:0,bottom:0,right:0,width:3,background:'rgba(0,0,0,0.35)' }}/>
      </div>
    )
  }
  const tone = spineTone(book.userBookId)
  const light = isLightTone(tone)
  const ink = light ? '#111' : '#fff'
  const authorLast = book.author.split(' ').slice(-1)[0]
  return (
    <div style={{ width:'100%',height:'100%',background:tone,borderRadius:2,overflow:'hidden',position:'relative' }}>
      <div style={{ position:'absolute',top:0,left:0,right:0,height:4,background:'rgba(255,255,255,0.10)' }}/>
      <div style={{ position:'absolute',top:0,bottom:0,left:0,width:1.5,background:'rgba(255,255,255,0.14)' }}/>
      <div style={{ position:'absolute',top:0,bottom:0,right:0,width:2.5,background:'rgba(0,0,0,0.30)' }}/>
      <div style={{ position:'absolute',inset:0,padding:'10px 0',display:'flex',alignItems:'center',justifyContent:'center' }}>
        <span style={{ writingMode:'vertical-rl',fontFamily:'Georgia,serif',fontSize:Math.max(8,w*0.27),color:ink,letterSpacing:0.4,whiteSpace:'nowrap',overflow:'hidden',maxHeight:h-18 }}>{book.title}</span>
      </div>
      <div style={{ position:'absolute',bottom:6,left:0,right:0,textAlign:'center',fontFamily:'-apple-system,system-ui,sans-serif',fontSize:Math.max(5.5,w*0.15),color:light?'rgba(0,0,0,0.45)':'rgba(255,255,255,0.5)' }}>{authorLast}</div>
    </div>
  )
}

// ─── Handle ────────────────────────────────────────────────────────────────────
function Handle({ children, onPointerDown, style, invScale, theme, bg, fg }: {
  children: React.ReactNode; onPointerDown: (e: React.PointerEvent) => void
  style?: React.CSSProperties; invScale: number; theme: Theme; bg?: string; fg?: string
}) {
  return (
    <button onPointerDown={onPointerDown} style={{ position:'absolute',width:26,height:26,borderRadius:'50%',background:bg??theme.fg,color:fg??theme.bg,border:`1.5px solid ${theme.bg}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:0,zIndex:60,touchAction:'none',boxShadow:'0 2px 6px rgba(0,0,0,0.3)',transform:`scale(${invScale})`,...style }}>
      {children}
    </button>
  )
}

// ─── Add from library — face-forward cover grid ────────────────────────────────
function AddFromLibSheet({ books, loading, theme, onAdd, onAddWithCapture, onClose }: {
  books: LibBook[]; loading: boolean; theme: Theme
  onAdd: (b: LibBook) => void; onAddWithCapture: (b: LibBook) => void; onClose: () => void
}) {
  return (
    <div style={{ position:'fixed',inset:0,zIndex:400 }}>
      <div onClick={onClose} style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.5)' }}/>
      <div onClick={e => e.stopPropagation()} style={{ position:'absolute',left:0,right:0,bottom:0,background:theme.bg,borderRadius:'22px 22px 0 0',maxHeight:'78%',display:'flex',flexDirection:'column',boxShadow:'0 -10px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ padding:'14px 22px 10px',flexShrink:0 }}>
          <div style={{ width:38,height:4,borderRadius:999,background:theme.border,margin:'0 auto 16px' }}/>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'baseline' }}>
            <div style={{ fontFamily:'Georgia,serif',fontSize:22,color:theme.fg,letterSpacing:-0.5 }}>Add to Shelf</div>
            <span style={{ fontSize:12,color:theme.muted,fontFamily:'-apple-system,system-ui,sans-serif' }}>{books.length} books</span>
          </div>
          <div style={{ fontSize:12,color:theme.muted,marginTop:3,fontFamily:'-apple-system,system-ui,sans-serif' }}>Tap cover to add · camera icon to also capture spine</div>
        </div>
        <div style={{ overflowY:'auto',padding:'8px 16px calc(28px + env(safe-area-inset-bottom,0px))',flex:1 }}>
          {loading ? (
            <div style={{ textAlign:'center',padding:'40px 0',color:theme.muted,fontSize:14 }}>Loading…</div>
          ) : books.length === 0 ? (
            <div style={{ textAlign:'center',padding:'40px 0',fontFamily:'Georgia,serif',fontSize:16,color:theme.muted }}>Every library book is already on the shelf.</div>
          ) : (
            <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12 }}>
              {books.map(lb => (
                <div key={lb.userBookId} style={{ display:'flex',flexDirection:'column',gap:5 }}>
                  <div style={{ position:'relative' }}>
                    <button onClick={() => onAdd(lb)} style={{ width:'100%',aspectRatio:'2/3',borderRadius:8,overflow:'hidden',background:theme.bgSecondary,border:`1px solid ${theme.border}`,cursor:'pointer',padding:0,display:'block' }}>
                      {lb.coverUrl
                        ? <img src={lb.coverUrl} alt={lb.title} style={{ width:'100%',height:'100%',objectFit:'cover',display:'block' }}/>
                        : <div style={{ width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',padding:8 }}>
                            <span style={{ fontSize:10,color:theme.muted,textAlign:'center',lineHeight:1.3,fontFamily:'-apple-system,system-ui,sans-serif' }}>{lb.title}</span>
                          </div>
                      }
                    </button>
                    <button onClick={() => onAddWithCapture(lb)} style={{ position:'absolute',bottom:5,right:5,width:28,height:28,borderRadius:8,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(4px)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                      <CameraIcon color="#fff" size={13}/>
                    </button>
                    {lb.spineUrl && <div style={{ position:'absolute',top:5,left:5,width:8,height:8,borderRadius:'50%',background:'#22C55E',boxShadow:'0 0 0 1.5px rgba(0,0,0,0.3)' }}/>}
                  </div>
                  <span style={{ fontSize:9.5,color:theme.muted,fontFamily:'-apple-system,system-ui,sans-serif',lineHeight:1.3,textAlign:'center',overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as any }}>{lb.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Style sheet (Style only — Decor moved to carousel bar) ───────────────────
function StyleSheet({ config, theme, onSave, onClose }: {
  config: ShelfConfig; theme: Theme; onSave: (c: ShelfConfig) => void; onClose: () => void
}) {
  return (
    <div style={{ position:'fixed',inset:0,zIndex:400 }}>
      <div onClick={onClose} style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.5)' }}/>
      <div onClick={e => e.stopPropagation()} style={{ position:'absolute',left:0,right:0,bottom:0,background:theme.bg,borderRadius:'22px 22px 0 0',boxShadow:'0 -10px 40px rgba(0,0,0,0.4)',paddingBottom:'calc(28px + env(safe-area-inset-bottom,0px))' }}>
        <div style={{ padding:'14px 22px 0' }}>
          <div style={{ width:38,height:4,borderRadius:999,background:theme.border,margin:'0 auto 16px' }}/>
          <div style={{ fontFamily:'Georgia,serif',fontSize:20,color:theme.fg,letterSpacing:-0.5,marginBottom:18 }}>Shelf Style</div>
        </div>
        <div style={{ padding:'0 22px 18px' }}>
          <div style={{ fontSize:10.5,fontWeight:600,letterSpacing:1,textTransform:'uppercase',color:theme.muted,marginBottom:10,fontFamily:'-apple-system,system-ui,sans-serif' }}>Wood</div>
          <div style={{ display:'flex',gap:10,marginBottom:22 }}>
            {WOOD_PRESETS.map((w,i) => (
              <button key={i} onClick={() => onSave({ ...config,woodIdx:i })} style={{ flex:1,height:48,borderRadius:10,cursor:'pointer',background:`linear-gradient(to bottom,${w.top},${w.face})`,border:config.woodIdx===i?`2.5px solid ${theme.fg}`:`2px solid transparent`,outline:'none',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',paddingBottom:6,boxShadow:`inset 0 2px 4px rgba(255,255,255,0.1),0 2px 8px rgba(0,0,0,0.3)` }}>
                <span style={{ fontSize:9,color:'rgba(255,255,255,0.85)',fontFamily:'-apple-system,system-ui,sans-serif',textShadow:'0 1px 2px rgba(0,0,0,0.6)' }}>{w.name}</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize:10.5,fontWeight:600,letterSpacing:1,textTransform:'uppercase',color:theme.muted,marginBottom:10,fontFamily:'-apple-system,system-ui,sans-serif' }}>Wall</div>
          <div style={{ display:'flex',gap:10 }}>
            {WALL_PRESETS.map((w,i) => (
              <button key={i} onClick={() => onSave({ ...config,wallIdx:i })} style={{ flex:1,height:48,borderRadius:10,cursor:'pointer',background:w.bg,border:config.wallIdx===i?`2.5px solid ${theme.fg}`:`2px solid ${theme.border}`,outline:'none',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',paddingBottom:6 }}>
                <span style={{ fontSize:9,color:'rgba(255,255,255,0.85)',fontFamily:'-apple-system,system-ui,sans-serif',textShadow:'0 1px 2px rgba(0,0,0,0.9)' }}>{w.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Icons ─────────────────────────────────────────────────────────────────────
function CameraIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M2 6.2C2 5.5 2.5 5 3.2 5h1.6l.9-1.4C5.9 3.2 6.2 3 6.6 3h4.8c.4 0 .7.2.9.6L13.2 5h1.6c.7 0 1.2.5 1.2 1.2v7.1c0 .7-.5 1.2-1.2 1.2H3.2C2.5 14.5 2 14 2 13.3V6.2Z" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/>
      <circle cx="9" cy="9.6" r="2.7" stroke={color} strokeWidth="1.3"/>
    </svg>
  )
}
function RotateIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M11 4.5A5 5 0 1 0 12 7" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M11 1.5V4.8H7.7" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function ScaleIcon({ color }: { color: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M3 8V11H6M11 5V2H8M11 2L7 6M2 11L6 7" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
