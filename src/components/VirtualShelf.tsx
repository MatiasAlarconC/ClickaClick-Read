import { useEffect, useRef, useState } from 'react'
import { useTheme, useAuth } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { searchByISBN } from '../services/books'
import ISBNScanner from './ISBNScanner'
import type { SearchResult, Theme } from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────
const BOOK_W = 42
const BOOK_H = 162
const SHELF_ROW_H = 210
const SHELF_BOARD_H = 14
const NUM_SHELVES = 10
const CANVAS_W = 3000
const HANDLE_R = 14

// ─── Types ───────────────────────────────────────────────────────────────────
interface ShelfBook {
  userBookId: string
  title: string
  author: string
  coverUrl: string | null
  spineUrl: string | null
  pos: { x: number; y: number; rotation: number; scale: number }
}

type Interaction =
  | { type: 'move'; id: string; offsetX: number; offsetY: number }
  | { type: 'rotate'; id: string; cX: number; cY: number; startAngle: number; origRot: number }
  | { type: 'scale'; id: string; cX: number; cY: number; startDist: number; origScale: number }

interface LibBook { id: string; title: string; author: string; coverUrl: string | null; userBookId: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function spineColor(title: string, dark: boolean): string {
  let h = 0
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  const hue = Math.abs(h) % 360
  return dark ? `hsl(${hue},22%,26%)` : `hsl(${hue},28%,72%)`
}

function toCanvasCoords(
  e: { clientX: number; clientY: number },
  containerEl: HTMLDivElement,
) {
  const r = containerEl.getBoundingClientRect()
  return { cx: e.clientX - r.left, cy: e.clientY - r.top + containerEl.scrollTop }
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function VirtualShelf() {
  const { theme } = useTheme()
  const { user } = useAuth()

  const [books, setBooks] = useState<ShelfBook[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [foundBook, setFoundBook] = useState<{ result: SearchResult; frameUrl?: string } | null>(null)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState('')
  const [addingBook, setAddingBook] = useState(false)
  const [showLibSheet, setShowLibSheet] = useState(false)
  const [libBooks, setLibBooks] = useState<LibBook[]>([])
  const [libLoading, setLibLoading] = useState(false)

  const interactionRef = useRef<Interaction | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // ─── Load shelf books ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data } = await supabase
        .from('user_books')
        .select('id, spine_url, shelf_pos, book:books(title, author, cover_url)')
        .eq('user_id', user.id)
        .not('shelf_pos', 'is', null)
      if (!data) return
      setBooks(
        (data as any[]).map(r => ({
          userBookId: r.id,
          title: r.book?.title ?? 'Unknown',
          author: r.book?.author ?? '',
          coverUrl: r.book?.cover_url ?? null,
          spineUrl: r.spine_url ?? null,
          pos: r.shelf_pos,
        }))
      )
    })()
  }, [user])

  // ─── Position persistence ─────────────────────────────────────────────────
  const scheduleSave = (userBookId: string, pos: ShelfBook['pos']) => {
    clearTimeout(saveTimers.current[userBookId])
    saveTimers.current[userBookId] = setTimeout(() => {
      supabase.from('user_books').update({ shelf_pos: pos }).eq('id', userBookId).then(() => {})
    }, 800)
  }

  const updatePos = (id: string, patch: Partial<ShelfBook['pos']>) => {
    setBooks(prev =>
      prev.map(b => {
        if (b.userBookId !== id) return b
        const newPos = { ...b.pos, ...patch }
        scheduleSave(id, newPos)
        return { ...b, pos: newPos }
      })
    )
  }

  // ─── Default placement ────────────────────────────────────────────────────
  const nextSlot = (): ShelfBook['pos'] => {
    const perRow = Math.floor((CANVAS_W - 20) / (BOOK_W + 6))
    const counts: Record<number, number> = {}
    for (const b of books) {
      const row = Math.floor(b.pos.y / SHELF_ROW_H)
      counts[row] = (counts[row] ?? 0) + 1
    }
    for (let row = 0; row < NUM_SHELVES; row++) {
      const n = counts[row] ?? 0
      if (n < perRow) {
        return { x: 10 + n * (BOOK_W + 6), y: row * SHELF_ROW_H + SHELF_BOARD_H + 12, rotation: 0, scale: 1 }
      }
    }
    return { x: 10, y: 0, rotation: 0, scale: 1 }
  }

  // ─── Overlay pointer handlers (active while dragging) ────────────────────
  const handleOverlayMove = (e: React.PointerEvent) => {
    const st = interactionRef.current
    if (!st || !containerRef.current) return
    const { cx, cy } = toCanvasCoords(e, containerRef.current)

    if (st.type === 'move') {
      updatePos(st.id, {
        x: Math.max(0, Math.min(CANVAS_W - BOOK_W, cx - st.offsetX)),
        y: Math.max(0, cy - st.offsetY),
      })
    } else if (st.type === 'rotate') {
      const angle = Math.atan2(cy - st.cY, cx - st.cX) * 180 / Math.PI
      updatePos(st.id, { rotation: st.origRot + (angle - st.startAngle) })
    } else if (st.type === 'scale') {
      const dist = Math.hypot(cx - st.cX, cy - st.cY)
      const scale = Math.max(0.5, Math.min(3.5, st.origScale * (dist / Math.max(st.startDist, 10))))
      updatePos(st.id, { scale })
    }
  }

  const handleOverlayUp = () => {
    interactionRef.current = null
    setDragging(false)
  }

  // ─── Book body drag start ─────────────────────────────────────────────────
  const startMove = (e: React.PointerEvent, book: ShelfBook) => {
    e.stopPropagation()
    if (!containerRef.current) return
    const { cx, cy } = toCanvasCoords(e, containerRef.current)
    interactionRef.current = {
      type: 'move',
      id: book.userBookId,
      offsetX: cx - book.pos.x,
      offsetY: cy - book.pos.y,
    }
    setSelectedId(book.userBookId)
    setDragging(true)
  }

  // ─── Rotate handle drag start ─────────────────────────────────────────────
  const startRotate = (e: React.PointerEvent, book: ShelfBook) => {
    e.stopPropagation()
    if (!containerRef.current) return
    const { cx, cy } = toCanvasCoords(e, containerRef.current)
    const cX = book.pos.x + BOOK_W / 2
    const cY = book.pos.y + BOOK_H / 2
    interactionRef.current = {
      type: 'rotate',
      id: book.userBookId,
      cX,
      cY,
      startAngle: Math.atan2(cy - cY, cx - cX) * 180 / Math.PI,
      origRot: book.pos.rotation,
    }
    setDragging(true)
  }

  // ─── Scale handle drag start ──────────────────────────────────────────────
  const startScale = (e: React.PointerEvent, book: ShelfBook) => {
    e.stopPropagation()
    if (!containerRef.current) return
    const { cx, cy } = toCanvasCoords(e, containerRef.current)
    const cX = book.pos.x + BOOK_W / 2
    const cY = book.pos.y + BOOK_H / 2
    interactionRef.current = {
      type: 'scale',
      id: book.userBookId,
      cX,
      cY,
      startDist: Math.hypot(cx - cX, cy - cY),
      origScale: book.pos.scale,
    }
    setDragging(true)
  }

  // ─── ISBN scan result ─────────────────────────────────────────────────────
  const handleISBNDetected = async (isbn: string, frameUrl?: string) => {
    setScanning(false)
    setScanLoading(true)
    setScanError('')
    const result = await searchByISBN(isbn)
    setScanLoading(false)
    if (result) {
      setFoundBook({ result, frameUrl })
    } else {
      setScanError('Book not found. Try searching manually in the Search tab.')
    }
  }

  // ─── Confirm add book to shelf ────────────────────────────────────────────
  const handleConfirmAdd = async () => {
    if (!foundBook || !user) return
    setAddingBook(true)
    try {
      const { result, frameUrl } = foundBook
      const externalId = result.google_books_id ?? result.id

      // 1. Ensure book row exists
      let bookDbId: string | null = null
      const { data: existing } = await supabase
        .from('books').select('id').eq('google_books_id', externalId).maybeSingle()
      if (existing) {
        bookDbId = existing.id
      } else {
        const { data: ins } = await supabase.from('books').insert({
          google_books_id: externalId,
          title: result.title, author: result.author,
          synopsis: result.synopsis ?? null, cover_url: result.cover_url ?? null,
          pages_default: result.pages ?? null, genres: result.genres ?? [],
          published_year: result.published_year ?? null, isbn: result.isbn ?? null,
        }).select('id').single()
        bookDbId = ins?.id ?? null
        if (!bookDbId) {
          const { data: retry } = await supabase.from('books').select('id').eq('google_books_id', externalId).maybeSingle()
          bookDbId = retry?.id ?? null
        }
      }
      if (!bookDbId) return

      const defaultPos = nextSlot()

      // 2. Check if user already has this book
      const { data: existingUb } = await supabase
        .from('user_books').select('id').eq('user_id', user.id).eq('book_id', bookDbId).maybeSingle()

      let userBookId: string | null = null
      if (existingUb) {
        await supabase.from('user_books').update({ shelf_pos: defaultPos }).eq('id', existingUb.id)
        userBookId = existingUb.id
      } else {
        const { data: ub } = await supabase.from('user_books').insert({
          user_id: user.id, book_id: bookDbId,
          status: 'want_to_read', added_at: new Date().toISOString(),
          shelf_pos: defaultPos,
        }).select('id').single()
        userBookId = ub?.id ?? null
      }
      if (!userBookId) return

      // 3. Upload spine frame if captured
      let spineUrl: string | null = null
      if (frameUrl) {
        try {
          const blob = await (await fetch(frameUrl)).blob()
          const path = `${user.id}/${userBookId}.jpg`
          const { error: upErr } = await supabase.storage
            .from('book-spines').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
          if (!upErr) {
            spineUrl = supabase.storage.from('book-spines').getPublicUrl(path).data.publicUrl
            await supabase.from('user_books').update({ spine_url: spineUrl }).eq('id', userBookId)
          }
        } catch { /* non-fatal */ }
      }

      // 4. Add to local state
      setBooks(prev => {
        const without = prev.filter(b => b.userBookId !== userBookId)
        return [...without, {
          userBookId: userBookId!,
          title: result.title, author: result.author,
          coverUrl: result.cover_url, spineUrl,
          pos: defaultPos,
        }]
      })
      setFoundBook(null)
    } finally {
      setAddingBook(false)
    }
  }

  // ─── Add existing library book to shelf ───────────────────────────────────
  const openLibSheet = async () => {
    setShowLibSheet(true)
    setLibLoading(true)
    const { data } = await supabase
      .from('user_books')
      .select('id, book:books(title, author, cover_url)')
      .eq('user_id', user!.id)
      .is('shelf_pos', null)
    setLibLoading(false)
    if (!data) return
    setLibBooks((data as any[]).map(r => ({
      userBookId: r.id,
      title: r.book?.title ?? 'Unknown',
      author: r.book?.author ?? '',
      coverUrl: r.book?.cover_url ?? null,
      id: r.id,
    })))
  }

  const addLibBookToShelf = async (lb: LibBook) => {
    const pos = nextSlot()
    await supabase.from('user_books').update({ shelf_pos: pos }).eq('id', lb.userBookId)
    setBooks(prev => [...prev, { userBookId: lb.userBookId, title: lb.title, author: lb.author, coverUrl: lb.coverUrl, spineUrl: null, pos }])
    setLibBooks(prev => prev.filter(b => b.userBookId !== lb.userBookId))
  }

  // ─── Remove book from shelf (keep in library) ─────────────────────────────
  const removeFromShelf = async (id: string) => {
    await supabase.from('user_books').update({ shelf_pos: null }).eq('id', id)
    setBooks(prev => prev.filter(b => b.userBookId !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const canvasH = NUM_SHELVES * SHELF_ROW_H + SHELF_BOARD_H

  const shelfBg = theme.dark ? '#2c1f14' : '#f5ede0'
  const boardColor = theme.dark ? '#4a2f1a' : '#c9a06a'
  const boardEdge = theme.dark ? '#6b3f20' : '#a87840'

  return (
    <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Drag capture overlay — rendered while any interaction is active */}
      {dragging && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9998, touchAction: 'none', cursor: 'grabbing' }}
          onPointerMove={handleOverlayMove}
          onPointerUp={handleOverlayUp}
          onPointerCancel={handleOverlayUp}
        />
      )}

      {/* Shelf canvas */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', WebkitOverflowScrolling: 'touch', position: 'relative', background: shelfBg }}
        onClick={() => setSelectedId(null)}
      >
        <div style={{ width: CANVAS_W, height: canvasH, position: 'relative' }}>
          {/* Shelf boards */}
          {Array.from({ length: NUM_SHELVES }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute', left: 0, width: CANVAS_W,
              top: (i + 1) * SHELF_ROW_H - SHELF_BOARD_H,
              height: SHELF_BOARD_H,
              background: boardColor,
              borderTop: `2px solid ${boardEdge}`,
              zIndex: 1,
            }} />
          ))}

          {/* Books */}
          {books.map(book => (
            <BookSpine
              key={book.userBookId}
              book={book}
              selected={selectedId === book.userBookId}
              theme={theme}
              onStartMove={startMove}
              onStartRotate={startRotate}
              onStartScale={startScale}
              onRemove={removeFromShelf}
            />
          ))}
        </div>

        {books.length === 0 && !scanLoading && (
          <div style={{ position: 'absolute', top: '35%', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none', padding: '0 32px' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: theme.muted, marginBottom: 8 }}>Your shelf is empty</div>
            <div style={{ fontSize: 13, color: theme.muted, opacity: 0.7, lineHeight: 1.6 }}>Scan a book barcode to add it, or choose from your library</div>
          </div>
        )}
      </div>

      {/* Scan error toast */}
      {scanError && (
        <div style={{
          position: 'absolute', bottom: 90, left: 16, right: 16,
          background: theme.bgElevated, border: `1px solid ${theme.border}`,
          borderRadius: 12, padding: '12px 16px',
          fontSize: 13, color: theme.fgDim, lineHeight: 1.5,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
        }}>
          <span>{scanError}</span>
          <button onClick={() => setScanError('')} style={{ background: 'none', border: 'none', color: theme.muted, fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* Scan loading overlay */}
      {scanLoading && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: theme.bg, borderRadius: 16, padding: '20px 28px', fontSize: 14, color: theme.fg }}>Looking up book…</div>
        </div>
      )}

      {/* FAB row */}
      <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
        {/* Add from library button */}
        <button
          onClick={openLibSheet}
          style={{
            padding: '10px 16px', borderRadius: 999,
            background: theme.bgElevated, border: `1px solid ${theme.border}`,
            color: theme.fg, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            boxShadow: `0 2px 8px ${theme.dark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.1)'}`,
            whiteSpace: 'nowrap',
          }}
        >
          From Library
        </button>
        {/* Scan FAB */}
        <button
          onClick={() => { setScanError(''); setScanning(true) }}
          aria-label="Scan book barcode"
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: theme.fg, color: theme.bg, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 16px ${theme.dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)'}`,
          }}
        >
          <ScanIcon />
        </button>
      </div>

      {/* ISBN Scanner */}
      {scanning && (
        <ISBNScanner onDetected={handleISBNDetected} onClose={() => setScanning(false)} />
      )}

      {/* Book found confirmation */}
      {foundBook && (
        <BookFoundSheet
          result={foundBook.result}
          frameUrl={foundBook.frameUrl}
          adding={addingBook}
          theme={theme}
          onConfirm={handleConfirmAdd}
          onDismiss={() => setFoundBook(null)}
        />
      )}

      {/* Add from library sheet */}
      {showLibSheet && (
        <AddFromLibSheet
          books={libBooks}
          loading={libLoading}
          theme={theme}
          onAdd={addLibBookToShelf}
          onClose={() => setShowLibSheet(false)}
        />
      )}
    </div>
  )
}

// ─── Book spine ───────────────────────────────────────────────────────────────
function BookSpine({ book, selected, theme, onStartMove, onStartRotate, onStartScale, onRemove }: {
  book: ShelfBook
  selected: boolean
  theme: Theme
  onStartMove: (e: React.PointerEvent, b: ShelfBook) => void
  onStartRotate: (e: React.PointerEvent, b: ShelfBook) => void
  onStartScale: (e: React.PointerEvent, b: ShelfBook) => void
  onRemove: (id: string) => void
}) {
  const { pos } = book
  const imgSrc = book.spineUrl ?? book.coverUrl

  return (
    <div style={{
      position: 'absolute',
      left: pos.x,
      top: pos.y,
      width: BOOK_W,
      height: BOOK_H,
      transform: `rotate(${pos.rotation}deg) scale(${pos.scale})`,
      transformOrigin: 'center center',
      zIndex: selected ? 20 : 3,
      touchAction: 'none',
      userSelect: 'none',
    }}>
      {/* Rotate handle — top center */}
      {selected && (
        <div
          onPointerDown={e => { e.stopPropagation(); onStartRotate(e, book) }}
          style={{
            position: 'absolute', left: '50%', top: -(HANDLE_R * 2 + 8),
            transform: 'translateX(-50%)',
            width: HANDLE_R * 2, height: HANDLE_R * 2, borderRadius: '50%',
            background: theme.fg, border: `2px solid ${theme.bg}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'grab', touchAction: 'none', zIndex: 5,
          }}
        >
          <RotateIcon color={theme.bg} />
        </div>
      )}

      {/* Book body */}
      <div
        onPointerDown={e => { e.stopPropagation(); onStartMove(e, book) }}
        style={{
          width: '100%', height: '100%',
          borderRadius: 3, overflow: 'hidden',
          background: imgSrc ? undefined : spineColor(book.title, theme.dark),
          boxShadow: selected
            ? `0 0 0 2px ${theme.fg}, 4px 4px 10px rgba(0,0,0,0.45)`
            : '3px 3px 9px rgba(0,0,0,0.28)',
          cursor: 'grab', position: 'relative',
        }}
      >
        {imgSrc ? (
          <img
            src={imgSrc} alt={book.title} draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 4,
          }}>
            <span style={{
              fontSize: 8, lineHeight: 1.35, textAlign: 'center',
              color: theme.dark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)',
              writingMode: 'vertical-rl', transform: 'rotate(180deg)',
              maxHeight: '90%', overflow: 'hidden', wordBreak: 'break-word',
            }}>
              {book.title}
            </span>
          </div>
        )}
      </div>

      {/* Scale handle — bottom right */}
      {selected && (
        <div
          onPointerDown={e => { e.stopPropagation(); onStartScale(e, book) }}
          style={{
            position: 'absolute', right: -HANDLE_R, bottom: -HANDLE_R,
            width: HANDLE_R * 2, height: HANDLE_R * 2, borderRadius: '50%',
            background: theme.fg, border: `2px solid ${theme.bg}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'nwse-resize', touchAction: 'none', zIndex: 5,
          }}
        >
          <ScaleIcon color={theme.bg} />
        </div>
      )}

      {/* Remove button — top right */}
      {selected && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(book.userBookId) }}
          style={{
            position: 'absolute', right: -HANDLE_R, top: -HANDLE_R,
            width: HANDLE_R * 2, height: HANDLE_R * 2, borderRadius: '50%',
            background: '#ef4444', border: `2px solid ${theme.bg}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 5, color: '#fff', fontSize: 14,
            lineHeight: 1, fontWeight: 700, padding: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}

// ─── Book found sheet ─────────────────────────────────────────────────────────
function BookFoundSheet({ result, frameUrl, adding, theme, onConfirm, onDismiss }: {
  result: SearchResult
  frameUrl?: string
  adding: boolean
  theme: Theme
  onConfirm: () => void
  onDismiss: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 400, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', background: theme.bg,
        borderRadius: '20px 20px 0 0',
        padding: '24px 20px calc(24px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: theme.muted, marginBottom: 16 }}>Book Found</div>
        <div style={{ display: 'flex', gap: 14, marginBottom: 22 }}>
          <div style={{ width: 60, height: 90, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: theme.bgSecondary }}>
            {(frameUrl ?? result.cover_url) && (
              <img src={frameUrl ?? result.cover_url!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: theme.fg, lineHeight: 1.3, marginBottom: 4 }}>{result.title}</div>
            <div style={{ fontSize: 13, color: theme.muted, marginBottom: 6 }}>{result.author}</div>
            {result.pages && <div style={{ fontSize: 11, color: theme.muted }}>{result.pages} pages</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onDismiss} style={{ flex: 1, padding: '13px 0', background: theme.bgSecondary, border: 'none', borderRadius: 12, fontSize: 15, color: theme.muted, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} disabled={adding} style={{ flex: 2, padding: '13px 0', background: theme.fg, border: 'none', borderRadius: 12, fontSize: 15, color: theme.bg, fontWeight: 600, cursor: adding ? 'default' : 'pointer', opacity: adding ? 0.65 : 1 }}>
            {adding ? 'Adding…' : 'Add to Shelf'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add from library sheet ───────────────────────────────────────────────────
function AddFromLibSheet({ books, loading, theme, onAdd, onClose }: {
  books: LibBook[]
  loading: boolean
  theme: Theme
  onAdd: (b: LibBook) => void
  onClose: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 400, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', background: theme.bg,
        borderRadius: '20px 20px 0 0',
        maxHeight: '72vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '20px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: theme.fg }}>Add from Library</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: theme.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: theme.muted, fontSize: 14 }}>Loading…</div>
          ) : books.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 20px', color: theme.muted, fontSize: 14, lineHeight: 1.6 }}>All your library books are already on the shelf.</div>
          ) : books.map(lb => (
            <div key={lb.userBookId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderTop: `1px solid ${theme.border}` }}>
              <div style={{ width: 36, height: 54, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: theme.bgSecondary }}>
                {lb.coverUrl && <img src={lb.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: theme.fg, fontFamily: 'Georgia, serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lb.title}</div>
                <div style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>{lb.author}</div>
              </div>
              <button
                onClick={() => onAdd(lb)}
                style={{ padding: '7px 14px', background: theme.fg, color: theme.bg, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
              >
                Add
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function ScanIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <rect x="2" y="5" width="2.5" height="14"/>
      <rect x="6" y="5" width="1.5" height="14"/>
      <rect x="9.5" y="5" width="2.5" height="14"/>
      <rect x="13.5" y="5" width="1.5" height="14"/>
      <rect x="16.5" y="5" width="2.5" height="14"/>
      <rect x="20.5" y="5" width="1.5" height="14"/>
    </svg>
  )
}

function RotateIcon({ color }: { color: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M1 4v6h6" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.51 15a9 9 0 1 0 .49-3" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

function ScaleIcon({ color }: { color: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}
