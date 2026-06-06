/**
 * Apple Watch companion — /watch
 * Abrir desde un Shortcut en Apple Watch con la URL clickaclick.lat/watch
 * Auth persiste en el localStorage del WebKit del watch.
 * Token se refresca automáticamente al abrir para evitar expiración de sesión.
 */

import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import type { UserBook } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0') }
function fmtTime(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

// Design tokens — match app palette
const BG      = '#0d0d0d'
const BG2     = '#1a1a1a'
const ACCENT  = '#7C3AED'   // same violet as app
const GREEN   = '#22C55E'
const RED     = '#EF4444'
const FG      = '#ffffff'
const MUTED   = 'rgba(255,255,255,0.45)'
const BORDER  = 'rgba(255,255,255,0.10)'

const fullBtn = (bg: string, color = FG): React.CSSProperties => ({
  width: '100%', padding: '14px 12px', background: bg, color,
  border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700,
  cursor: 'pointer', boxSizing: 'border-box', fontFamily: 'system-ui, -apple-system, sans-serif',
})
const rowBtn = (bg: string, color: string, border?: string): React.CSSProperties => ({
  flex: 1, padding: '13px 8px', background: bg, color,
  border: border ? `1px solid ${border}` : 'none',
  borderRadius: 14, fontSize: 13, fontWeight: 700,
  cursor: 'pointer', boxSizing: 'border-box', fontFamily: 'system-ui, -apple-system, sans-serif',
})
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 10px', background: BG2,
  border: `1.5px solid ${ACCENT}`, borderRadius: 12, fontSize: 22,
  color: FG, outline: 'none', boxSizing: 'border-box', textAlign: 'center',
  fontFamily: 'Georgia, serif',
}

// ─── Sign In ──────────────────────────────────────────────────────────────────

function SignInView() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [pass, setPass]   = useState('')
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState<string | null>(null)

  const submit = async () => {
    if (!email || !pass) return
    setBusy(true); setErr(null)
    const { error } = await signIn(email, pass)
    setBusy(false)
    if (error) setErr(typeof error === 'string' ? error : 'Error al iniciar sesión')
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 400, textAlign: 'center', color: FG, marginBottom: 4 }}>ClickaClick</div>
      <input style={{ ...inputStyle, fontSize: 13, textAlign: 'left' }} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" />
      <input style={{ ...inputStyle, fontSize: 13, textAlign: 'left' }} type="password" placeholder="Contraseña" value={pass} onChange={e => setPass(e.target.value)} autoComplete="current-password" />
      {err && <div style={{ fontSize: 11, color: RED, textAlign: 'center' }}>{err}</div>}
      <button style={fullBtn(ACCENT, FG)} disabled={busy} onClick={submit}>{busy ? '…' : 'Entrar'}</button>
    </div>
  )
}

// ─── Book picker ──────────────────────────────────────────────────────────────

function BookPicker({ userId, onSelect }: { userId: string; onSelect: (b: UserBook) => void }) {
  const [books, setBooks] = useState<UserBook[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('user_books')
      .select('*, book:books(title, author, cover_url, pages_default)')
      .eq('user_id', userId)
      .eq('status', 'reading')
      .order('added_at', { ascending: false })
      .limit(8)
      .then(({ data }) => { if (data) setBooks(data as UserBook[]); setLoading(false) })
  }, [userId])

  if (loading) return <div style={{ textAlign: 'center', color: MUTED, fontSize: 12 }}>…</div>
  if (books.length === 0) return (
    <div style={{ textAlign: 'center', fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
      No tenés libros en progreso.<br />Agregá uno desde la app.
    </div>
  )

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: MUTED, marginBottom: 12 }}>¿Qué estás leyendo?</div>
      {books.map((b, i) => {
        const meta = b.book as { title?: string; author?: string; cover_url?: string | null } | undefined
        return (
          <button
            key={b.id}
            onClick={() => onSelect(b)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 0', background: 'transparent', border: 'none',
              borderBottom: i < books.length - 1 ? `1px solid ${BORDER}` : 'none',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            {meta?.cover_url ? (
              <img src={meta.cover_url} alt="" style={{ width: 36, height: 52, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 36, height: 52, borderRadius: 4, background: BG2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="10" height="12" rx="1.5" stroke={MUTED} strokeWidth="1.2"/></svg>
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: FG, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta?.title ?? 'Sin título'}</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta?.author ?? ''}</div>
            </div>
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none" style={{ flexShrink: 0 }}>
              <path d="M1 1l4 4-4 4" stroke={MUTED} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )
      })}
    </div>
  )
}

// ─── Voice note ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRec: (new () => any) | undefined =
  (typeof window !== 'undefined')
    ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition)
    : undefined

function VoiceNote({ ub, userId, pageRef }: { ub: UserBook; userId: string; pageRef: React.MutableRefObject<number> }) {
  const [state, setState]   = useState<'idle' | 'recording' | 'preview'>('idle')
  const [transcript, setTr] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef              = useRef<any>(null)

  if (!SpeechRec) return null

  const startRec = () => {
    const r = new SpeechRec()
    r.lang = 'es-ES'; r.interimResults = false; r.maxAlternatives = 1
    r.onresult = (e: any) => { setTr(e.results[0][0].transcript); setState('preview') }
    r.onerror  = () => setState('idle')
    r.onend    = () => { if (state === 'recording') setState('idle') }
    recRef.current = r; r.start(); setState('recording')
  }
  const stopRec = () => { recRef.current?.stop(); setState('idle') }

  const saveNote = async () => {
    if (!transcript.trim()) return
    setSaving(true)
    await supabase.from('book_notes').insert({
      user_id: userId, book_id: ub.book_id,
      page_number: pageRef.current || null, content: transcript.trim(),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => { setTr(''); setState('idle'); setSaved(false) }, 1800)
  }

  if (saved) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', color: GREEN, fontSize: 12 }}>
      <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke={GREEN} strokeWidth="1.5" fill="none"/><path d="M4 7l2.5 2.5L10 5" stroke={GREEN} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      Nota guardada
    </div>
  )

  if (state === 'preview') return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
      <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8 }}>Nota</div>
      <div style={{ fontSize: 12, color: FG, background: BG2, borderRadius: 10, padding: '10px', lineHeight: 1.5 }}>{transcript}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={rowBtn(ACCENT, FG)} disabled={saving} onClick={saveNote}>{saving ? '…' : 'Guardar'}</button>
        <button style={rowBtn('transparent', MUTED, BORDER)} onClick={() => { setTr(''); setState('idle') }}>Descartar</button>
      </div>
    </div>
  )

  return (
    <button
      style={{ width: '100%', padding: '11px 12px', background: BG2, border: `1px solid ${BORDER}`, borderRadius: 12, fontSize: 12, color: state === 'recording' ? RED : MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box' }}
      onClick={state === 'recording' ? stopRec : startRec}
    >
      {state === 'recording' ? (
        <><div style={{ width: 7, height: 7, borderRadius: '50%', background: RED }} />Grabando — toca para parar</>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <rect x="4.5" y="1" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M2 7.5a5.5 5.5 0 0011 0M7 13v1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Nota de voz
        </>
      )}
    </button>
  )
}

// ─── Active session ───────────────────────────────────────────────────────────

type Phase = 'running' | 'paused' | 'ending' | 'saved'

function SessionView({ ub, userId, onCancel }: { ub: UserBook; userId: string; onCancel: () => void }) {
  const [phase, setPhase]     = useState<Phase>('running')
  const [secs, setSecs]       = useState(0)
  const [endPage, setEndPage] = useState(String(ub.current_page ?? ''))
  const [saving, setSaving]   = useState(false)

  const startRef    = useRef(Date.now())
  const accRef      = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pageRef     = useRef(ub.current_page ?? 0)

  const meta = ub.book as { title?: string; cover_url?: string | null } | undefined
  const title = meta?.title ?? 'Libro'
  const shortTitle = title.length > 20 ? title.slice(0, 18) + '…' : title

  const startTick = () => {
    intervalRef.current = setInterval(() => {
      setSecs(accRef.current + Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
  }

  useEffect(() => {
    startRef.current = Date.now()
    startTick()
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const pause = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    accRef.current += Math.floor((Date.now() - startRef.current) / 1000)
    setPhase('paused')
  }

  const resume = () => {
    startRef.current = Date.now()
    setPhase('running')
    startTick()
  }

  const endSession = () => {
    if (phase === 'running') {
      if (intervalRef.current) clearInterval(intervalRef.current)
      accRef.current += Math.floor((Date.now() - startRef.current) / 1000)
    }
    setPhase('ending')
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    // Refresh auth token before saving to avoid 401 errors on long sessions
    await supabase.auth.refreshSession()
    const duration  = accRef.current
    const startPage = ub.current_page ?? 0
    const ep        = parseInt(endPage) || startPage
    const pagesRead = Math.max(0, ep - startPage)
    const endedAt   = new Date().toISOString()
    const startedAt = new Date(Date.now() - duration * 1000).toISOString()
    await supabase.from('reading_sessions').insert({
      user_id: userId, book_id: ub.book_id,
      started_at: startedAt, ended_at: endedAt,
      duration_seconds: duration,
      start_page: startPage, end_page: ep, pages_read: pagesRead,
    })
    if (ep !== startPage) {
      await supabase.from('user_books').update({ current_page: ep }).eq('id', ub.id)
    }
    setSaving(false)
    setPhase('saved')
  }

  // ── Guardado ──
  if (phase === 'saved') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="22" stroke={GREEN} strokeWidth="2.5" fill="none"/>
        <path d="M14 24l8 8 13-13" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: FG }}>Sesión guardada</div>
      <div style={{ fontSize: 12, color: MUTED }}>{fmtTime(secs)}</div>
    </div>
  )

  // ── Página final ──
  if (phase === 'ending') return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, textAlign: 'center', color: FG }}>{shortTitle}</div>
      <div style={{ fontSize: 11, color: MUTED, textAlign: 'center' }}>{fmtTime(secs)}</div>
      <div style={{ fontSize: 11, color: MUTED, textAlign: 'center', marginTop: 4 }}>¿En qué página quedaste?</div>
      <input
        style={inputStyle}
        type="number"
        value={endPage}
        onChange={e => { setEndPage(e.target.value); pageRef.current = parseInt(e.target.value) || 0 }}
        inputMode="numeric"
        min={ub.current_page ?? 0}
      />
      <button style={fullBtn(ACCENT, FG)} disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar sesión'}</button>
      <button style={{ ...fullBtn('transparent', MUTED), border: `1px solid ${BORDER}` }} onClick={() => setPhase('paused')}>Volver</button>
    </div>
  )

  // ── Timer ──
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      {/* Header: portada + título + X */}
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10 }}>
        {meta?.cover_url ? (
          <img src={meta.cover_url} alt="" style={{ width: 28, height: 40, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />
        ) : null}
        <div style={{ flex: 1, fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5 }}>{shortTitle}</div>
        <button
          onClick={onCancel}
          style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: BG2, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          title="Cancelar sesión"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke={MUTED} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Timer display */}
      <div style={{
        fontSize: 50, fontWeight: 800, letterSpacing: -2, lineHeight: 1,
        color: phase === 'paused' ? MUTED : GREEN,
        fontVariantNumeric: 'tabular-nums',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        {fmtTime(secs)}
      </div>

      {phase === 'paused' && (
        <div style={{ fontSize: 10, color: MUTED, letterSpacing: 1.5, textTransform: 'uppercase' }}>Pausado</div>
      )}

      {/* Pausa / Continuar + Terminar */}
      <div style={{ width: '100%', display: 'flex', gap: 8 }}>
        {phase === 'running' ? (
          <button style={rowBtn(BG2, FG, BORDER)} onClick={pause}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight: 5, verticalAlign: 'middle' }}>
              <rect x="2" y="2" width="3" height="8" rx="1" fill="currentColor"/>
              <rect x="7" y="2" width="3" height="8" rx="1" fill="currentColor"/>
            </svg>
            Pausa
          </button>
        ) : (
          <button style={rowBtn(BG2, GREEN, ACCENT)} onClick={resume}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight: 5, verticalAlign: 'middle' }}>
              <path d="M3 2l7 4-7 4V2z" fill="currentColor"/>
            </svg>
            Continuar
          </button>
        )}
        <button style={rowBtn(RED + '22', RED, RED + '55')} onClick={endSession}>Terminar</button>
      </div>

      {/* Nota de voz (opcional) */}
      <VoiceNote ub={ub} userId={userId} pageRef={pageRef} />
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function WatchScreen() {
  const { user }           = useAuth()
  const [ready, setReady]  = useState(false)
  const [book, setBook]    = useState<UserBook | null>(null)
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    if (!user) { setReady(true); return }
    // Refresh token on page load — prevents 401 errors after session is open for >1h
    supabase.auth.refreshSession().finally(() => {
      // Auto-select most recent book
      supabase
        .from('reading_sessions')
        .select('book_id')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .then(async ({ data: sess }) => {
          const bookId = sess?.[0]?.book_id
          const base = supabase
            .from('user_books')
            .select('*, book:books(title, author, cover_url, pages_default)')
            .eq('user_id', user.id)
            .eq('status', 'reading')
          const { data } = bookId
            ? await base.eq('book_id', bookId).maybeSingle()
            : await base.order('added_at', { ascending: false }).limit(1).maybeSingle()
          setBook((data as UserBook) ?? null)
          setReady(true)
        })
    })
  }, [user])

  const selectBook = (b: UserBook) => { setBook(b); setPicking(false) }

  return (
    <div style={{
      minHeight: '100dvh', background: BG, color: FG,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '16px 14px', boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: 220 }}>
        {!ready && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13 }}>…</div>}

        {ready && !user && <SignInView />}

        {ready && user && picking && (
          <BookPicker userId={user.id} onSelect={selectBook} />
        )}

        {ready && user && !picking && !book && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ textAlign: 'center', fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
              No tenés libros en progreso.<br />Agregá uno desde la app.
            </div>
          </div>
        )}

        {ready && user && !picking && book && (
          <>
            <SessionView ub={book} userId={user.id} onCancel={() => { setBook(null); setPicking(true) }} />
            {/* Cambiar libro */}
            <button
              onClick={() => setPicking(true)}
              style={{ width: '100%', marginTop: 10, padding: '9px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 12, fontSize: 11, color: MUTED, cursor: 'pointer' }}
            >
              Cambiar libro
            </button>
          </>
        )}

        {ready && user && !picking && book === null && !ready && null}
      </div>
    </div>
  )
}
