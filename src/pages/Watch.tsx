/**
 * Apple Watch companion — /watch
 * Abrir desde un Shortcut en Apple Watch con la URL clickaclick.lat/watch
 * Auth persiste en el localStorage del WebKit del watch.
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

const ACCENT = '#22C55E'
const MUTED  = 'rgba(255,255,255,0.45)'
const BORDER = 'rgba(255,255,255,0.12)'

// Botón full-width
const fullBtn = (bg = ACCENT, color = '#000'): React.CSSProperties => ({
  width: '100%', padding: '15px 12px', background: bg, color,
  border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700,
  cursor: 'pointer', boxSizing: 'border-box',
})
// Botón en fila (flex: 1, sin width: 100%)
const rowBtn = (bg: string, color: string): React.CSSProperties => ({
  flex: 1, padding: '14px 8px', background: bg, color,
  border: bg === 'transparent' ? `1px solid ${BORDER}` : 'none',
  borderRadius: 14, fontSize: 13, fontWeight: 700,
  cursor: 'pointer', boxSizing: 'border-box',
})
const ghostFull: React.CSSProperties = {
  width: '100%', padding: '13px 12px', background: 'transparent',
  border: `1px solid ${BORDER}`, borderRadius: 14, fontSize: 13,
  color: MUTED, cursor: 'pointer', boxSizing: 'border-box',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 10px', background: '#111',
  border: `1px solid ${ACCENT}`, borderRadius: 12, fontSize: 22,
  color: '#fff', outline: 'none', boxSizing: 'border-box', textAlign: 'center',
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
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center', marginBottom: 4, color: '#fff' }}>ClickaClick</div>
      <input style={{ ...inputStyle, fontSize: 13, textAlign: 'left' }} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" />
      <input style={{ ...inputStyle, fontSize: 13, textAlign: 'left' }} type="password" placeholder="Contraseña" value={pass} onChange={e => setPass(e.target.value)} autoComplete="current-password" />
      {err && <div style={{ fontSize: 11, color: '#EF4444', textAlign: 'center' }}>{err}</div>}
      <button style={fullBtn()} disabled={busy} onClick={submit}>{busy ? '…' : 'Entrar'}</button>
    </div>
  )
}

// ─── Nota de voz ──────────────────────────────────────────────────────────────

// Usa Web Speech API (SpeechRecognition) — on-device, sin subir audio
// Si el watch WebKit no lo soporta, el botón no aparece.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRec: (new () => any) | undefined =
  (typeof window !== 'undefined')
    ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition)
    : undefined

function VoiceNote({ ub, userId, pageRef }: { ub: UserBook; userId: string; pageRef: React.MutableRefObject<number> }) {
  const [state, setState]         = useState<'idle' | 'recording' | 'preview'>('idle')
  const [transcript, setTrans]    = useState('')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef                    = useRef<any>(null)

  if (!SpeechRec) return null

  const startRec = () => {
    const r = new SpeechRec()
    r.lang = 'es-ES'
    r.interimResults = false
    r.maxAlternatives = 1
    r.onresult = (e: any) => {
      setTrans(e.results[0][0].transcript)
      setState('preview')
    }
    r.onerror = () => setState('idle')
    r.onend   = () => { if (state === 'recording') setState('idle') }
    recRef.current = r
    r.start()
    setState('recording')
  }

  const stopRec = () => {
    recRef.current?.stop()
    setState('idle')
  }

  const saveNote = async () => {
    if (!transcript.trim()) return
    setSaving(true)
    await supabase.from('book_notes').insert({
      user_id: userId,
      book_id: ub.book_id,
      page_number: pageRef.current || null,
      content: transcript.trim(),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => { setTrans(''); setState('idle'); setSaved(false) }, 1800)
  }

  if (saved) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', color: ACCENT, fontSize: 12 }}>
      <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke={ACCENT} strokeWidth="1.5" fill="none"/><path d="M4 7l2.5 2.5L10 5" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      Nota guardada
    </div>
  )

  if (state === 'preview') return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
      <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8 }}>Nota</div>
      <div style={{ fontSize: 12, color: '#fff', background: '#111', borderRadius: 10, padding: '10px', lineHeight: 1.5, minHeight: 40 }}>{transcript}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={rowBtn(ACCENT, '#000')} disabled={saving} onClick={saveNote}>{saving ? '…' : 'Guardar'}</button>
        <button style={rowBtn('transparent', MUTED)} onClick={() => { setTrans(''); setState('idle') }}>Descartar</button>
      </div>
    </div>
  )

  return (
    <button
      style={{ ...ghostFull, marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: state === 'recording' ? '#EF4444' : MUTED }}
      onClick={state === 'recording' ? stopRec : startRec}
    >
      {state === 'recording' ? (
        <>
          <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#EF4444"/></svg>
          Grabando — toca para parar
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="4.5" y="1" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M2 7.5a5.5 5.5 0 0011 0M7 13v1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Nota de voz
        </>
      )}
    </button>
  )
}

// ─── Timer activo ─────────────────────────────────────────────────────────────

type Phase = 'running' | 'paused' | 'ending' | 'saved'

function SessionView({ ub, userId }: { ub: UserBook; userId: string }) {
  const [phase, setPhase]     = useState<Phase>('running')
  const [secs, setSecs]       = useState(0)
  const [endPage, setEndPage] = useState(String(ub.current_page ?? ''))
  const [saving, setSaving]   = useState(false)

  const startRef    = useRef(Date.now())
  const accRef      = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // ref para que VoiceNote siempre lea la página actual
  const currentPageRef = useRef(ub.current_page ?? 0)

  const title = (ub.book as { title?: string } | undefined)?.title ?? 'Libro'
  const shortTitle = title.length > 22 ? title.slice(0, 20) + '…' : title

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="20" stroke={ACCENT} strokeWidth="2.5" fill="none"/>
        <path d="M13 22l7 7 12-12" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Sesión guardada</div>
      <div style={{ fontSize: 12, color: MUTED }}>{fmtTime(secs)}</div>
    </div>
  )

  // ── Página final ──
  if (phase === 'ending') return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'center', color: '#fff' }}>{shortTitle}</div>
      <div style={{ fontSize: 11, color: MUTED, textAlign: 'center' }}>{fmtTime(secs)}</div>
      <div style={{ fontSize: 11, color: MUTED, textAlign: 'center', marginTop: 4 }}>¿En qué página quedaste?</div>
      <input
        style={inputStyle}
        type="number"
        value={endPage}
        onChange={e => { setEndPage(e.target.value); currentPageRef.current = parseInt(e.target.value) || 0 }}
        inputMode="numeric"
        min={ub.current_page ?? 0}
      />
      <button style={fullBtn()} disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar'}</button>
      <button style={ghostFull} onClick={() => setPhase('paused')}>Volver</button>
    </div>
  )

  // ── Timer principal ──
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 11, color: MUTED, textAlign: 'center', letterSpacing: 0.3, textTransform: 'uppercase' }}>
        {shortTitle}
      </div>

      <div style={{
        fontSize: 46, fontWeight: 800, letterSpacing: -2, lineHeight: 1,
        color: phase === 'paused' ? MUTED : ACCENT,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {fmtTime(secs)}
      </div>

      {phase === 'paused' && (
        <div style={{ fontSize: 10, color: MUTED, letterSpacing: 1.5, textTransform: 'uppercase' }}>Pausado</div>
      )}

      <div style={{ width: '100%', display: 'flex', gap: 8 }}>
        {phase === 'running' ? (
          <button style={rowBtn('#1a1a1a', '#fff')} onClick={pause}>Pausa</button>
        ) : (
          <button style={rowBtn('#1a1a1a', ACCENT)} onClick={resume}>Continuar</button>
        )}
        <button style={rowBtn('#EF4444', '#fff')} onClick={endSession}>Terminar</button>
      </div>

      <VoiceNote ub={ub} userId={userId} pageRef={currentPageRef} />
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function WatchScreen() {
  const { user }              = useAuth()
  const [book, setBook]       = useState<UserBook | null | false>(null)
  const [ready, setReady]     = useState(false)

  useEffect(() => {
    if (!user) { setReady(true); return }
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
          .select('*, book:books(title, pages_default, cover_url)')
          .eq('user_id', user.id)
          .eq('status', 'reading')
        const { data } = bookId
          ? await base.eq('book_id', bookId).maybeSingle()
          : await base.order('added_at', { ascending: false }).limit(1).maybeSingle()
        setBook((data as UserBook) ?? false)
        setReady(true)
      })
  }, [user])

  return (
    <div style={{
      minHeight: '100dvh', background: '#000', color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '16px 14px', boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: 210 }}>
        {!ready && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13 }}>…</div>}
        {ready && !user && <SignInView />}
        {ready && user && book === false && (
          <div style={{ textAlign: 'center', fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
            No tenés libros en progreso.<br />Agregá uno desde la app.
          </div>
        )}
        {ready && user && book && (
          <SessionView ub={book} userId={user.id} />
        )}
      </div>
    </div>
  )
}
