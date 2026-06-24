import { useEffect, useRef, useState } from 'react'
import { useTheme, useAuth } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import SpineCaptureCamera from './SpineCaptureCamera'
import type { Theme } from '../types'

// ─── Design constants ─────────────────────────────────────────────────────────
const ROW_H = 178
const BOARD_H = 12
const DECK_H = ROW_H - BOARD_H   // 166px — open book space per row
const ROWS_MAX = 6
const ROWS_DEFAULT = 3

const SPINE_SIZES = [
  { w: 33, h: 110 }, { w: 41, h: 134 }, { w: 35, h: 152 },
  { w: 47, h: 120 }, { w: 31, h: 142 }, { w: 39, h: 118 },
] as const

const SPINE_TONES = ['#1b1b1b', '#2e2e2e', '#444444', '#5a5a5a', '#7c7c7c', '#e7e3db']

// ─── Types ────────────────────────────────────────────────────────────────────
type ShelfPos = { shelf: number; left: number; rot: number; scale: number }

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
const isLightTone = (t: string) => t === '#7c7c7c' || t === '#e7e3db'

function boardColors(dark: boolean) {
  return dark
    ? { top: '#4a3725', face: '#33261a', edge: '#221a11' }
    : { top: '#8a6643', face: '#6f4f30', edge: '#523a23' }
}

function wallGradient(dark: boolean) {
  return dark
    ? 'repeating-linear-gradient(90deg,#161616 0 3px,#181818 3px 6px)'
    : 'repeating-linear-gradient(90deg,#efece6 0 3px,#f3f1eb 3px 6px)'
}

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

  const rowsRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<GestureState | null>(null)
  const [gesturing, setGesturing] = useState(false)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const dark = theme.dark
  const board = boardColors(dark)
  const selectedBook = books.find(b => b.userBookId === selected) ?? null

  // ─── Load & persist ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const key = `cc_shelf_rows_${user.id}`
    const saved = parseInt(localStorage.getItem(key) ?? '', 10)
    if (!isNaN(saved) && saved >= ROWS_DEFAULT && saved <= ROWS_MAX) setRows(saved)
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

  // ─── Gesture handlers (window-level) ────────────────────────────────────────
  useEffect(() => {
    if (!gesturing) return

    const move = (e: PointerEvent) => {
      const g = gestureRef.current
      if (!g) return

      if (g.type === 'drag') {
        const el = rowsRef.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const localX = e.clientX - r.left
        const localY = e.clientY - r.top
        const shelf = Math.max(0, Math.min(rows - 1, Math.floor(localY / ROW_H)))
        const sz = spineSize(g.id)
        const maxLeft = el.offsetWidth - sz.w - 6
        const left = Math.max(6, Math.min(localX - g.grabOffset, maxLeft))
        updatePos(g.id, { shelf, left })
      } else if (g.type === 'rotate') {
        const ang = Math.atan2(e.clientY - g.cy, e.clientX - g.cx) * 180 / Math.PI
        const rot = Math.max(-30, Math.min(30, g.startRot + (ang - g.startAng)))
        updatePos(g.id, { rot })
      } else if (g.type === 'scale') {
        const dist = Math.hypot(e.clientX - g.cx, e.clientY - g.cy)
        const scale = Math.max(0.7, Math.min(1.6, g.startScale * dist / Math.max(g.startDist, 10)))
        updatePos(g.id, { scale })
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

  // ─── Gesture starters ────────────────────────────────────────────────────────
  const bodyDown = (e: React.PointerEvent, book: ShelfBook) => {
    e.stopPropagation()
    setSelected(book.userBookId)
    const el = rowsRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    gestureRef.current = { type: 'drag', id: book.userBookId, grabOffset: e.clientX - r.left - book.pos.left }
    setGesturing(true)
  }

  const rotateDown = (e: React.PointerEvent, book: ShelfBook) => {
    e.stopPropagation()
    const wrap = (e.currentTarget as HTMLElement).closest('[data-spine]') as HTMLElement
    const r = wrap.getBoundingClientRect()
    gestureRef.current = {
      type: 'rotate', id: book.userBookId,
      cx: r.left + r.width / 2, cy: r.top + r.height / 2,
      startAng: Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI,
      startRot: book.pos.rot,
    }
    setGesturing(true)
  }

  const scaleDown = (e: React.PointerEvent, book: ShelfBook) => {
    e.stopPropagation()
    const wrap = (e.currentTarget as HTMLElement).closest('[data-spine]') as HTMLElement
    const r = wrap.getBoundingClientRect()
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    gestureRef.current = {
      type: 'scale', id: book.userBookId,
      cx, cy,
      startDist: Math.hypot(e.clientX - cx, e.clientY - cy) || 1,
      startScale: book.pos.scale,
    }
    setGesturing(true)
  }

  // ─── Actions ──────────────────────────────────────────────────────────────────
  const addBook = async (lb: LibBook, andCapture = false) => {
    const wallW = rowsRef.current?.offsetWidth ?? 360
    let shelf = rows - 1, left = 10
    outer: for (let r = 0; r < rows; r++) {
      const inRow = books.filter(b => b.pos.shelf === r)
      const rightEdge = inRow.reduce((m, b) => Math.max(m, b.pos.left + spineSize(b.userBookId).w * b.pos.scale), 6)
      const nextLeft = rightEdge + 8
      if (nextLeft + 33 <= wallW - 6) { shelf = r; left = nextLeft; break outer }
    }
    // If all rows are full, add a new row if possible
    if (shelf === rows - 1 && rows < ROWS_MAX) {
      const inLastRow = books.filter(b => b.pos.shelf === rows - 1)
      const re = inLastRow.reduce((m, b) => Math.max(m, b.pos.left + spineSize(b.userBookId).w * b.pos.scale), 6)
      if (re + 33 > wallW - 6) {
        const newRows = rows + 1
        setRows(newRows); saveRows(newRows)
        shelf = newRows - 1; left = 10
      }
    }
    const pos: ShelfPos = { shelf, left, rot: 0, scale: 1 }
    const { data: existing } = await supabase.from('user_books').select('id, spine_url').eq('id', lb.userBookId).single()
    const { error: updateErr } = await supabase.from('user_books').update({ shelf_pos: pos }).eq('id', lb.userBookId)
    if (updateErr) {
      // Column missing — migration not run yet. Still show in local state so UX works.
      console.warn('shelf_pos column missing — run migration 016_virtual_shelf.sql in Supabase SQL Editor')
    }
    setBooks(prev => {
      const without = prev.filter(b => b.userBookId !== lb.userBookId)
      return [...without, { ...lb, spineUrl: (existing as any)?.spine_url ?? null, pos }]
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

  const openLibSheet = async () => {
    setShowLibSheet(true); setLibLoading(true)
    const { data, error } = await supabase
      .from('user_books').select('id, book:books(title,author,cover_url)')
      .eq('user_id', user!.id).is('shelf_pos', null)
    if (error) {
      // shelf_pos column missing (migration not yet run) — fall back to all books
      const { data: all } = await supabase
        .from('user_books').select('id, book:books(title,author,cover_url)')
        .eq('user_id', user!.id)
      setLibLoading(false)
      const onShelf = new Set(books.map(b => b.userBookId))
      setLibBooks(((all as any[]) ?? [])
        .filter(r => !onShelf.has(r.id))
        .map(r => ({
          userBookId: r.id, title: r.book?.title ?? 'Unknown',
          author: r.book?.author ?? '', coverUrl: r.book?.cover_url ?? null,
        })))
      return
    }
    setLibLoading(false)
    setLibBooks(((data as any[]) ?? []).map(r => ({
      userBookId: r.id, title: r.book?.title ?? 'Unknown',
      author: r.book?.author ?? '', coverUrl: r.book?.cover_url ?? null,
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
        console.error('Spine upload failed:', error.message, '— make sure migration 016_virtual_shelf.sql has been run in Supabase SQL Editor')
      } else {
        const spineUrl = supabase.storage.from('book-spines').getPublicUrl(path).data.publicUrl
        await supabase.from('user_books').update({ spine_url: spineUrl }).eq('id', target.userBookId)
        setBooks(prev => prev.map(b => b.userBookId === target.userBookId ? { ...b, spineUrl } : b))
      }
    } finally { setSpineSaving(false) }
  }

  const isEmpty = books.length === 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* ── Contextual hint bar ── */}
      <div style={{ padding: '0 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 28, flexShrink: 0 }}>
        <span style={{ fontSize: 11.5, color: theme.muted, fontFamily: '-apple-system,system-ui,sans-serif' }}>
          {selectedBook
            ? 'Drag to move · handles to rotate, resize & re-shoot'
            : isEmpty ? '' : `${books.length} on the shelf · tap a book to edit`}
        </span>
        {!isEmpty && (
          <button
            onClick={async () => { await Promise.all(books.map(b => supabase.from('user_books').update({ shelf_pos: null }).eq('id', b.userBookId))); setBooks([]); setSelected(null) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11.5, color: theme.muted, textDecoration: 'underline', fontFamily: '-apple-system,system-ui,sans-serif' }}
          >Clear</button>
        )}
      </div>

      {/* ── Scroll container ── */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 110 }}>
        {/* Shelf wall */}
        <div
          ref={rowsRef}
          onPointerDown={() => setSelected(null)}
          style={{
            position: 'relative',
            height: rows * ROW_H,
            background: wallGradient(dark),
            borderLeft: `1px solid ${theme.border}`,
            borderRight: `1px solid ${theme.border}`,
          }}
        >
          {/* Shelf boards */}
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} style={{ position: 'absolute', left: 0, right: 0, top: r * ROW_H + DECK_H }}>
              {/* Under-board shadow */}
              <div style={{ position: 'absolute', top: BOARD_H, left: 0, right: 0, height: 16, background: `linear-gradient(${dark ? 'rgba(0,0,0,0.50)' : 'rgba(0,0,0,0.15)'}, transparent)` }} />
              {/* Top surface (3px) */}
              <div style={{ height: 3, background: board.top }} />
              {/* Face */}
              <div style={{ height: BOARD_H - 3, background: board.face, borderBottom: `1.5px solid ${board.edge}` }} />
            </div>
          ))}

          {/* Books */}
          {books.map(book => {
            const sz = spineSize(book.userBookId)
            const sel = book.userBookId === selected
            const inv = 1 / book.pos.scale
            return (
              <div
                key={book.userBookId}
                data-spine={book.userBookId}
                onPointerDown={e => bodyDown(e, book)}
                style={{
                  position: 'absolute',
                  left: book.pos.left,
                  top: book.pos.shelf * ROW_H + DECK_H - sz.h,
                  width: sz.w, height: sz.h,
                  transform: `rotate(${book.pos.rot}deg) scale(${book.pos.scale})`,
                  transformOrigin: 'bottom center',
                  zIndex: sel ? 50 : 10 + book.pos.shelf,
                  cursor: 'grab', touchAction: 'none',
                  filter: dark ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.55))' : 'drop-shadow(0 4px 7px rgba(0,0,0,0.28))',
                }}
              >
                <SpineFace book={book} w={sz.w} h={sz.h} theme={theme} />

                {/* Selection outline */}
                {sel && (
                  <div style={{ position: 'absolute', inset: -4, border: `1.5px solid ${theme.fg}`, borderRadius: 4, pointerEvents: 'none' }} />
                )}

                {/* Handles */}
                {sel && (
                  <>
                    {/* Connector line */}
                    <div style={{ position: 'absolute', left: '50%', top: -22, width: 1.5, height: 22, background: theme.fg, transform: `scaleX(${inv})`, transformOrigin: 'top center', pointerEvents: 'none' }} />

                    {/* Rotate — top center */}
                    <Handle invScale={inv} theme={theme} onPointerDown={e => rotateDown(e, book)}
                      style={{ left: '50%', top: -22, marginLeft: -13, transform: `translateY(-100%) scale(${inv})` }}>
                      <RotateIcon color={theme.bg} />
                    </Handle>

                    {/* Scale — bottom right */}
                    <Handle invScale={inv} theme={theme} onPointerDown={e => scaleDown(e, book)}
                      style={{ right: -13, bottom: -13, transform: `scale(${inv})` }}>
                      <ScaleIcon color={theme.bg} />
                    </Handle>

                    {/* Remove — top right (monochrome, not red) */}
                    <Handle invScale={inv} theme={theme} onPointerDown={e => { e.stopPropagation(); removeBook(book.userBookId) }}
                      style={{ right: -13, top: -13, transform: `scale(${inv})` }}>
                      <svg width="11" height="11" viewBox="0 0 11 11"><path d="M1 1L10 10M10 1L1 10" stroke={theme.bg} strokeWidth="1.6" strokeLinecap="round" /></svg>
                    </Handle>

                    {/* Camera — bottom left */}
                    <Handle invScale={inv} theme={theme} bg={theme.bg} fg={theme.fg}
                      onPointerDown={e => { e.stopPropagation(); setSpineTarget({ userBookId: book.userBookId, title: book.title }) }}
                      style={{ left: -13, bottom: -13, border: `1.5px solid ${theme.fg}`, transform: `scale(${inv})` }}>
                      <CameraIcon color={theme.fg} />
                    </Handle>
                  </>
                )}
              </div>
            )
          })}

          {/* Empty state */}
          {isEmpty && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 40px' }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: theme.fg, letterSpacing: -0.5 }}>Your shelf is empty</div>
              <div style={{ fontSize: 13, color: theme.muted, marginTop: 8, lineHeight: 1.5, maxWidth: 230, fontFamily: '-apple-system,system-ui,sans-serif' }}>
                Add a book from your library, then capture its real spine with the camera.
              </div>
              <button onClick={openLibSheet} style={{
                marginTop: 22, padding: '11px 22px', borderRadius: 999,
                background: theme.fg, color: theme.bg, border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 500, fontFamily: '-apple-system,system-ui,sans-serif',
              }}>From Library</button>
            </div>
          )}
        </div>

        {/* Add a shelf ghost row */}
        {rows < ROWS_MAX && (
          <button
            onClick={() => { const n = rows + 1; setRows(n); saveRows(n) }}
            style={{
              width: '100%', height: 60, background: 'none', cursor: 'pointer', border: 'none',
              borderTop: `1px dashed ${theme.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              color: theme.muted, fontSize: 13, fontFamily: '-apple-system,system-ui,sans-serif',
            }}
          >
            <span style={{ width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${theme.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, lineHeight: 1, color: theme.muted }}>+</span>
            Add a shelf
          </button>
        )}
      </div>

      {/* ── FABs ── */}
      {!isEmpty && (
        <button
          onClick={openLibSheet}
          style={{
            position: 'absolute', bottom: 22, left: 20, padding: '10px 16px', borderRadius: 999,
            background: theme.bgElevated, color: theme.fg, border: `1px solid ${theme.border}`,
            cursor: 'pointer', fontSize: 13, fontWeight: 500, zIndex: 80,
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: '-apple-system,system-ui,sans-serif',
            boxShadow: dark ? '0 4px 14px rgba(0,0,0,0.5)' : '0 4px 14px rgba(0,0,0,0.12)',
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Library
        </button>
      )}
      <button
        onClick={() => { if (selectedBook) setSpineTarget({ userBookId: selectedBook.userBookId, title: selectedBook.title }); else openLibSheet() }}
        style={{
          position: 'absolute', bottom: 22, right: 20, width: 54, height: 54, borderRadius: '50%',
          background: theme.fg, color: theme.bg, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80,
          boxShadow: dark ? '0 6px 20px rgba(0,0,0,0.6)' : '0 6px 20px rgba(0,0,0,0.25)',
        }}
      >
        <CameraIcon color={theme.bg} size={22} />
      </button>

      {/* Saving indicator */}
      {spineSaving && (
        <div style={{ position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)', background: theme.fg, color: theme.bg, borderRadius: 999, padding: '6px 16px', fontSize: 12, fontWeight: 500, zIndex: 200, whiteSpace: 'nowrap' }}>
          Saving spine…
        </div>
      )}

      {/* Spine camera */}
      {spineTarget && (
        <SpineCaptureCamera bookTitle={spineTarget.title} onCapture={handleSpineCaptured} onClose={() => setSpineTarget(null)} />
      )}

      {/* Add from library sheet */}
      {showLibSheet && (
        <AddFromLibSheet
          books={libBooks} loading={libLoading} theme={theme}
          onAdd={lb => addBook(lb, false)}
          onAddWithCapture={lb => addBook(lb, true)}
          onClose={() => setShowLibSheet(false)}
        />
      )}
    </div>
  )
}

// ─── Spine face ───────────────────────────────────────────────────────────────
function SpineFace({ book, w, h, theme }: { book: ShelfBook; w: number; h: number; theme: Theme }) {
  if (book.spineUrl) {
    return (
      <div style={{ width: '100%', height: '100%', borderRadius: 2, overflow: 'hidden', position: 'relative', boxShadow: 'inset 0 0 14px rgba(0,0,0,0.55)' }}>
        <img src={book.spineUrl} alt={book.title} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
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
      {/* Edge highlights */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.10)' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 1.5, background: 'rgba(255,255,255,0.14)' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 2.5, background: 'rgba(0,0,0,0.30)' }} />
      {/* Title */}
      <div style={{ position: 'absolute', inset: 0, padding: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{
          writingMode: 'vertical-rl', fontFamily: 'Georgia, serif',
          fontSize: Math.max(8, w * 0.27), color: ink, letterSpacing: 0.4,
          whiteSpace: 'nowrap', overflow: 'hidden', maxHeight: h - 18,
        }}>{book.title}</span>
      </div>
      {/* Author last name */}
      <div style={{ position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center', fontFamily: '-apple-system,system-ui,sans-serif', fontSize: Math.max(5.5, w * 0.15), color: light ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)' }}>
        {authorLast}
      </div>
    </div>
  )
}

// ─── Handle button ────────────────────────────────────────────────────────────
function Handle({ children, onPointerDown, style, invScale, theme, bg, fg }: {
  children: React.ReactNode
  onPointerDown: (e: React.PointerEvent) => void
  style?: React.CSSProperties
  invScale: number
  theme: Theme
  bg?: string
  fg?: string
}) {
  return (
    <button
      onPointerDown={onPointerDown}
      style={{
        position: 'absolute', width: 26, height: 26, borderRadius: '50%',
        background: bg ?? theme.fg, color: fg ?? theme.bg,
        border: `1.5px solid ${theme.bg}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', padding: 0, zIndex: 60, touchAction: 'none',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        transform: `scale(${invScale})`,
        ...style,
      }}
    >{children}</button>
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
      <div onClick={e => e.stopPropagation()} style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: theme.bg, borderRadius: '22px 22px 0 0',
        maxHeight: '76%', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.4)',
      }}>
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
            <div key={lb.userBookId} style={{ display: 'flex', gap: 13, alignItems: 'center', padding: '10px 6px', borderBottom: `1px solid ${theme.border}` }}>
              <button onClick={() => onAdd(lb)} style={{ flex: 1, display: 'flex', gap: 13, alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                <div style={{ width: 40, height: 60, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: theme.bgSecondary }}>
                  {lb.coverUrl && <img src={lb.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 14.5, color: theme.fg, lineHeight: 1.25 }}>{lb.title}</div>
                  <div style={{ fontSize: 11.5, color: theme.muted, marginTop: 2, fontFamily: '-apple-system,system-ui,sans-serif' }}>{lb.author}</div>
                </div>
              </button>
              <button onClick={() => onAddWithCapture(lb)} title="Add + capture spine" style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: theme.bgSecondary, border: `1px solid ${theme.border}`, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CameraIcon size={17} color={theme.fg} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function CameraIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M2 6.2C2 5.5 2.5 5 3.2 5h1.6l.9-1.4C5.9 3.2 6.2 3 6.6 3h4.8c.4 0 .7.2.9.6L13.2 5h1.6c.7 0 1.2.5 1.2 1.2v7.1c0 .7-.5 1.2-1.2 1.2H3.2C2.5 14.5 2 14 2 13.3V6.2Z"
        stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
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
