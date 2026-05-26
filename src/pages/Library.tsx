import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import { BookCover, TabBar, ProgressBar, Stars } from '../components/UI'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import type { UserBook } from '../types'

type LibTab = 'reading' | 'finished' | 'want_to_read'

const TAB_LABELS: Record<LibTab, string> = {
  reading: 'Reading',
  finished: 'Finished',
  want_to_read: 'Want to Read',
}

export default function LibraryScreen() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<LibTab>('reading')
  const [books, setBooks] = useState<Record<LibTab, UserBook[]>>({ reading: [], finished: [], want_to_read: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchBooks()
  }, [user])

  const fetchBooks = async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('user_books').select('*, book:books(*)').eq('user_id', user.id).order('added_at', { ascending: false })
    if (data) {
      const grouped: Record<LibTab, UserBook[]> = { reading: [], finished: [], want_to_read: [] }
      for (const b of data as UserBook[]) {
        if (b.status in grouped) grouped[b.status].push(b)
      }
      setBooks(grouped)
    }
    setLoading(false)
  }

  const totalBooks = books.reading.length + books.finished.length + books.want_to_read.length

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: theme.bg, position: 'relative' }}>
      <div style={{ flex: 1, padding: '64px 22px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 400, color: theme.fg, letterSpacing: -1 }}>Library</div>
          <div style={{ fontSize: 12, color: theme.muted, paddingBottom: 4 }}>{totalBooks} books</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 7, marginBottom: 22, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {(Object.keys(TAB_LABELS) as LibTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 14px', borderRadius: 999, flexShrink: 0, background: tab === t ? theme.accent : theme.bgSecondary, color: tab === t ? theme.accentFg : theme.muted, border: 'none', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 500 }}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Book list */}
        <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 100 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: theme.muted }}>Loading…</div>
          ) : books[tab].length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📚</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: theme.muted }}>Nothing here yet</div>
              <button onClick={() => navigate('/search')} style={{ marginTop: 16, padding: '10px 20px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500 }}>Find books</button>
            </div>
          ) : (
            books[tab].map((book, i) => (
              <SwipeableBookRow key={book.id} book={book} index={i} total={books[tab].length} tab={tab} theme={theme} onPress={() => navigate('/detail', { state: { book: book.book } })} onDelete={() => {
                setBooks(prev => ({
                  ...prev,
                  [tab]: prev[tab].filter(b => b.id !== book.id)
                }))
                supabase.from('user_books').delete().eq('id', book.id)
              }} onFinish={() => {
                if (tab === 'reading') {
                  supabase.from('user_books').update({ status: 'finished', finished_at: new Date().toISOString() }).eq('id', book.id)
                  setBooks(prev => ({
                    reading: prev.reading.filter(b => b.id !== book.id),
                    finished: [{ ...book, status: 'finished' }, ...prev.finished],
                    want_to_read: prev.want_to_read,
                  }))
                }
              }} />
            ))
          )}
        </div>
      </div>

      {/* FAB */}
      <button onClick={() => navigate('/search')} style={{ position: 'absolute', bottom: 74, right: 22, width: 50, height: 50, borderRadius: '50%', background: theme.accent, color: theme.accentFg, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 300, boxShadow: theme.dark ? '0 4px 16px rgba(255,255,255,0.15)' : '0 4px 16px rgba(0,0,0,0.18)' }}>+</button>

      <TabBar activeTab="library" onTabChange={t => navigate(`/${t === 'home' ? 'home' : t}`)} theme={theme} />
    </div>
  )
}

function SwipeableBookRow({ book, index, total, tab, theme, onPress, onDelete, onFinish }: {
  book: UserBook; index: number; total: number; tab: LibTab; theme: import('../types').Theme
  onPress: () => void; onDelete: () => void; onFinish: () => void
}) {
  const x = useMotionValue(0)
  const deleteOpacity = useTransform(x, [-100, -40], [1, 0])
  const finishOpacity = useTransform(x, [40, 100], [0, 1])

  const pages = book.custom_pages ?? book.book?.pages_default ?? 1
  // get progress from sessions — simplified: use a rough estimate
  const progress = tab === 'reading' ? 0.3 : 1

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Swipe actions */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px' }}>
        <motion.div style={{ opacity: finishOpacity }}>
          <div style={{ background: '#22c55e', padding: '8px 14px', borderRadius: 10, fontSize: 12, color: '#FFF', fontWeight: 600 }}>✅ Done</div>
        </motion.div>
        <motion.div style={{ opacity: deleteOpacity }}>
          <div style={{ background: '#ef4444', padding: '8px 14px', borderRadius: 10, fontSize: 12, color: '#FFF', fontWeight: 600 }}>🗑 Remove</div>
        </motion.div>
      </div>

      <motion.button drag="x" dragConstraints={{ left: 0, right: 0 }} style={{ x, display: 'flex', gap: 14, padding: '14px 0', background: theme.bg, border: 'none', textAlign: 'left', borderBottom: index < total - 1 ? `1px solid ${theme.border}` : 'none', cursor: 'pointer', width: '100%', position: 'relative', zIndex: 1 }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -80) onDelete()
          if (info.offset.x > 80 && tab === 'reading') onFinish()
        }}
        onClick={onPress}
        whileTap={{ scale: 0.98 }}>
        <BookCover index={index} width={60} height={90} coverUrl={book.book?.cover_url} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: 2, paddingBottom: 2 }}>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: theme.fg, lineHeight: 1.3, marginBottom: 3 }}>{book.book?.title ?? 'Unknown'}</div>
            <div style={{ fontSize: 12.5, color: theme.muted }}>{book.book?.author ?? ''}</div>
          </div>
          {tab === 'reading' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: theme.muted }}>p. {book.custom_pages ?? '?'} of {pages}</span>
                <span style={{ fontSize: 11, color: theme.fg, fontWeight: 600 }}>{Math.round(progress * 100)}%</span>
              </div>
              <ProgressBar progress={progress} theme={theme} height={3} />
            </div>
          )}
          {tab === 'finished' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Stars filled={book.user_rating ?? 0} count={5} size={13} color={theme.fg} />
              <span style={{ fontSize: 11, color: theme.muted }}>{book.finished_at ? new Date(book.finished_at).toLocaleDateString() : ''}</span>
            </div>
          )}
          {tab === 'want_to_read' && (
            <span style={{ fontSize: 11, color: theme.muted, background: theme.bgSecondary, padding: '3px 9px', borderRadius: 999, display: 'inline-block' }}>Want to Read</span>
          )}
        </div>
      </motion.button>
    </div>
  )
}
