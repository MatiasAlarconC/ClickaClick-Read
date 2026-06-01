/**
 * Apple Watch companion view (/watch)
 *
 * Accessed by adding the app as an Apple Shortcut on Apple Watch.
 * The URL is opened in the Watch's minimal WebKit browser.
 * Designed for a 184 × 224pt viewport (Series 9 screen).
 *
 * Flow:
 *   Not signed in → Sign In form
 *   Signed in, no active session → Book picker → Start session
 *   Active session → Timer display → End session form
 */

import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import type { UserBook } from '../types'

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0') }
function fmtTime(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  root: {
    minHeight: '100dvh',
    background: '#000',
    color: '#fff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 14px',
    boxSizing: 'border-box' as const,
    userSelect: 'none' as const,
  },
  title: { fontSize: 15, fontWeight: 700, letterSpacing: -0.3, marginBottom: 12, textAlign: 'center' as const },
  input: {
    width: '100%',
    padding: '9px 10px',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 10,
    fontSize: 13,
    color: '#fff',
    outline: 'none',
    boxSizing: 'border-box' as const,
    marginBottom: 8,
  },
  btn: (accent = '#22C55E', full = true) => ({
    width: full ? '100%' : 'auto',
    padding: '10px 14px',
    background: accent,
    color: '#000',
    border: 'none',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    marginBottom: 8,
    boxSizing: 'border-box' as const,
  }),
  ghost: {
    width: '100%',
    padding: '8px',
    background: 'none',
    border: '1px solid #333',
    borderRadius: 10,
    fontSize: 12,
    color: '#888',
    cursor: 'pointer',
    marginBottom: 6,
    boxSizing: 'border-box' as const,
  },
  muted: { fontSize: 11, color: '#666', textAlign: 'center' as const, marginBottom: 10 },
  timer: { fontSize: 38, fontWeight: 800, letterSpacing: -1, fontVariantNumeric: 'tabular-nums' as const, color: '#22C55E', textAlign: 'center' as const, margin: '10px 0' },
  bookTitle: { fontSize: 13, fontWeight: 600, textAlign: 'center' as const, marginBottom: 4, maxWidth: 160, lineHeight: 1.3 },
  error: { fontSize: 11, color: '#EF4444', marginBottom: 8, textAlign: 'center' as const },
}

// ─── Screen: Sign in ─────────────────────────────────────────────────────────

function SignInView({ onDone }: { onDone: () => void }) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!email || !pass) return
    setBusy(true); setErr(null)
    const { error } = await signIn(email, pass)
    setBusy(false)
    if (error) setErr(error)
    else onDone()
  }

  return (
    <div style={{ width: '100%', maxWidth: 200 }}>
      <div style={S.title}>Sign In</div>
      <input style={S.input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" />
      <input style={S.input} type="password" placeholder="Password" value={pass} onChange={e => setPass(e.target.value)} autoComplete="current-password" />
      {err && <div style={S.error}>{err}</div>}
      <button style={S.btn()} disabled={busy} onClick={submit}>{busy ? '…' : 'Sign In'}</button>
    </div>
  )
}

// ─── Screen: Book picker ─────────────────────────────────────────────────────

function BookPickerView({ userId, onSelect }: { userId: string; onSelect: (ub: UserBook) => void }) {
  const [books, setBooks] = useState<UserBook[]>([])

  useEffect(() => {
    supabase.from('user_books').select('*, book:books(title, pages_default)')
      .eq('user_id', userId).eq('status', 'reading')
      .limit(5)
      .then(({ data }) => { if (data) setBooks(data as UserBook[]) })
  }, [userId])

  if (books.length === 0) return (
    <div style={S.muted}>No books in progress.<br />Add one in the main app.</div>
  )

  return (
    <div style={{ width: '100%', maxWidth: 200 }}>
      <div style={S.title}>Pick a book</div>
      {books.map(b => (
        <button key={b.id} style={S.ghost} onClick={() => onSelect(b)}>
          {b.book?.title ?? 'Untitled'}
        </button>
      ))}
    </div>
  )
}

// ─── Screen: Active session timer ────────────────────────────────────────────

function SessionView({ userBook, userId, onDone }: { userBook: UserBook; userId: string; onDone: () => void }) {
  const [secs, setSecs] = useState(0)
  const [ending, setEnding] = useState(false)
  const [endPage, setEndPage] = useState(String(userBook.current_page ?? ''))
  const [saving, setSaving] = useState(false)
  const startRef = useRef(Date.now())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSecs(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const finish = async () => {
    if (saving) return
    setSaving(true)
    if (intervalRef.current) clearInterval(intervalRef.current)
    const dur = Math.floor((Date.now() - startRef.current) / 1000)
    const startPage = userBook.current_page ?? 0
    const ep = parseInt(endPage) || startPage
    const pagesRead = Math.max(0, ep - startPage)
    const now = new Date().toISOString()
    await supabase.from('reading_sessions').insert({
      user_id: userId, book_id: userBook.book_id,
      started_at: new Date(startRef.current).toISOString(),
      ended_at: now, duration_seconds: dur,
      start_page: startPage, end_page: ep, pages_read: pagesRead,
    })
    if (ep > startPage) {
      await supabase.from('user_books').update({ current_page: ep }).eq('id', userBook.id)
    }
    setSaving(false)
    onDone()
  }

  if (ending) {
    return (
      <div style={{ width: '100%', maxWidth: 200 }}>
        <div style={S.title}>End Session</div>
        <div style={S.muted}>Time: {fmtTime(secs)}</div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Finished on page</div>
        <input style={S.input} type="number" value={endPage} onChange={e => setEndPage(e.target.value)} min={userBook.current_page ?? 0} />
        <button style={S.btn()} disabled={saving} onClick={finish}>{saving ? 'Saving…' : 'Save & Finish'}</button>
        <button style={S.ghost} onClick={() => setEnding(false)}>Back</button>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 200 }}>
      <div style={S.bookTitle}>{userBook.book?.title ?? 'Reading…'}</div>
      <div style={S.muted}>Page {userBook.current_page ?? '?'}</div>
      <div style={S.timer}>{fmtTime(secs)}</div>
      <button style={S.btn('#EF4444')} onClick={() => setEnding(true)}>End Session</button>
    </div>
  )
}

// ─── Done screen ─────────────────────────────────────────────────────────────

function DoneView({ onAgain }: { onAgain: () => void }) {
  return (
    <div style={{ textAlign: 'center', maxWidth: 200 }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>&#10003;</div>
      <div style={S.title}>Session saved</div>
      <button style={S.btn()} onClick={onAgain}>Read again</button>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function WatchScreen() {
  const { user, signOut } = useAuth()
  const [activeBook, setActiveBook] = useState<UserBook | null>(null)
  const [done, setDone] = useState(false)

  if (!user) return (
    <div style={S.root}>
      <SignInView onDone={() => { /* re-render via auth state change */ }} />
    </div>
  )

  const reset = () => { setActiveBook(null); setDone(false) }

  return (
    <div style={S.root}>
      {done ? (
        <DoneView onAgain={reset} />
      ) : activeBook ? (
        <SessionView userBook={activeBook} userId={user.id} onDone={() => setDone(true)} />
      ) : (
        <>
          <BookPickerView userId={user.id} onSelect={b => setActiveBook(b)} />
          <button style={{ ...S.ghost, marginTop: 8 }} onClick={signOut}>Sign out</button>
        </>
      )}
    </div>
  )
}
