import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TabBar } from '../components/UI'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import type { ReadingSession, UserBook } from '../types'

export default function StatsScreen() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()
  const dark = theme.dark

  const [sessions, setSessions] = useState<ReadingSession[]>([])
  const [userBooks, setUserBooks] = useState<UserBook[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString()
    Promise.all([
      supabase.from('reading_sessions').select('*').eq('user_id', user.id).gte('started_at', startOfYear).order('started_at', { ascending: true }),
      supabase.from('user_books').select('*, book:books(*)').eq('user_id', user.id),
    ]).then(([sessRes, bookRes]) => {
      if (sessRes.data) setSessions(sessRes.data as ReadingSession[])
      if (bookRes.data) setUserBooks(bookRes.data as UserBook[])
      setLoading(false)
    })
  }, [user])

  const stats = useMemo(() => {
    const booksFinished = userBooks.filter(b => b.status === 'finished').length
    const pagesRead = sessions.reduce((s, r) => s + (r.pages_read ?? 0), 0)
    const totalSeconds = sessions.reduce((s, r) => s + (r.duration_seconds ?? 0), 0)
    const hours = Math.round(totalSeconds / 3600)
    const days = new Set(sessions.map(s => new Date(s.started_at).toDateString())).size
    const dailyAvgPages = days > 0 ? Math.round(pagesRead / days) : 0
    // Reading pace: pages per hour — only from timed sessions (duration > 0)
    const timedSessions = sessions.filter(s => (s.duration_seconds ?? 0) > 0)
    const timedPages = timedSessions.reduce((s, r) => s + (r.pages_read ?? 0), 0)
    const timedHours = timedSessions.reduce((s, r) => s + (r.duration_seconds ?? 0), 0) / 3600
    const pacePerHour = timedHours > 0 ? Math.round(timedPages / timedHours) : 0
    return { booksFinished, pagesRead, hours, dailyAvgPages, pacePerHour }
  }, [sessions, userBooks])

  // Heatmap: 52 weeks × 7 days
  const heatmap = useMemo(() => {
    const sessionDates = new Set(sessions.map(s => new Date(s.started_at).toDateString()))
    const sessionPagesByDate: Record<string, number> = {}
    for (const s of sessions) {
      const d = new Date(s.started_at).toDateString()
      sessionPagesByDate[d] = (sessionPagesByDate[d] ?? 0) + (s.pages_read ?? 0)
    }

    const today = new Date()
    const cells: Array<{ date: Date; value: 0|1|2 }> = []

    // Start from 52 weeks ago Monday
    const start = new Date(today)
    start.setDate(start.getDate() - 364)
    const dow = start.getDay()
    start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1))

    for (let i = 0; i < 52 * 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      if (d > today) { cells.push({ date: d, value: 0 }); continue }
      const p = sessionPagesByDate[d.toDateString()] ?? 0
      cells.push({ date: d, value: p === 0 ? 0 : p > 30 ? 2 : 1 })
    }
    return cells
  }, [sessions])

  // Streak
  const { currentStreak, longestStreak } = useMemo(() => {
    const sessionDates = new Set(sessions.map(s => new Date(s.started_at).toDateString()))
    let current = 0; const today = new Date()
    for (let i = 0; i < 366; i++) {
      const d = new Date(today); d.setDate(today.getDate() - i)
      if (sessionDates.has(d.toDateString())) current++
      else if (i > 0) break
    }
    let longest = 0, run = 0
    const sorted = [...sessionDates].sort()
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) { run = 1; longest = 1; continue }
      const prev = new Date(sorted[i-1]); const cur = new Date(sorted[i])
      const diff = (cur.getTime() - prev.getTime()) / 86400000
      if (diff <= 1) { run++; longest = Math.max(longest, run) } else run = 1
    }
    return { currentStreak: current, longestStreak: longest }
  }, [sessions])

  // Monthly pages
  const monthlyPages = useMemo(() => {
    const arr = Array(12).fill(0)
    for (const s of sessions) {
      const m = new Date(s.started_at).getMonth()
      arr[m] += s.pages_read ?? 0
    }
    return arr
  }, [sessions])
  const maxPages = Math.max(...monthlyPages.filter(v => v > 0), 1)
  const months = ['J','F','M','A','M','J','J','A','S','O','N','D']

  const CELL = 5.2; const GAP = 1.5

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: theme.bg, paddingBottom: 'calc(68px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ flex: 1, padding: '64px 22px 0' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 400, color: theme.fg, letterSpacing: -1, lineHeight: 1.15 }}>Your Reading<br />Life</div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Books', value: String(stats.booksFinished), sub: 'this year' },
            { label: 'Pages', value: stats.pagesRead.toLocaleString(), sub: 'this year' },
            { label: 'Hours', value: String(stats.hours), sub: 'of reading' },
            { label: 'Daily avg', value: `${stats.dailyAvgPages} pg`, sub: 'per day' },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              style={{ background: theme.bgSecondary, borderRadius: 16, padding: '16px 16px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.9, textTransform: 'uppercase', color: theme.muted, marginBottom: 5 }}>{s.label}</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, color: theme.fg, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: theme.muted, marginTop: 3 }}>{s.sub}</div>
            </motion.div>
          ))}
        </div>

        {/* Reading pace — full-width accent card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}
          style={{ background: theme.bgSecondary, borderRadius: 16, padding: '16px 20px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.9, textTransform: 'uppercase', color: theme.muted, marginBottom: 5 }}>Reading Pace</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, color: theme.fg, lineHeight: 1 }}>
              {stats.pacePerHour > 0 ? stats.pacePerHour : '—'}
            </div>
            <div style={{ fontSize: 11, color: theme.muted, marginTop: 3 }}>pages / hour</div>
          </div>
          <div style={{ fontSize: 28 }}>⚡</div>
        </motion.div>

        {/* Heatmap */}
        <div style={{ background: theme.bgSecondary, borderRadius: 16, padding: '16px 16px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.9, textTransform: 'uppercase', color: theme.muted }}>Reading Heatmap {new Date().getFullYear()}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 9, color: theme.muted }}>less</span>
              {[0,1,2].map(v => (
                <div key={v} style={{ width: 8, height: 8, borderRadius: 2, background: v === 0 ? theme.border : v === 1 ? (dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)') : theme.accent }} />
              ))}
              <span style={{ fontSize: 9, color: theme.muted }}>more</span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: GAP, width: 52 * (CELL + GAP) }}>
              {[...Array(52)].map((_, week) => (
                <div key={week} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                  {[...Array(7)].map((_, day) => {
                    const cell = heatmap[week * 7 + day]
                    const val = cell?.value ?? 0
                    const isFuture = cell?.date > new Date()
                    const bg = isFuture ? theme.border : val === 0 ? theme.border : val === 1 ? (dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.28)') : theme.accent
                    return <div key={day} style={{ width: CELL, height: CELL, borderRadius: 1.2, background: bg, opacity: isFuture ? 0.4 : 1 }} />
                  })}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            {['Jan','Mar','May','Jul','Sep','Nov'].map(m => <span key={m} style={{ fontSize: 9, color: theme.muted }}>{m}</span>)}
          </div>
        </div>

        {/* Monthly pages chart */}
        <div style={{ background: theme.bgSecondary, borderRadius: 16, padding: '16px 16px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.9, textTransform: 'uppercase', color: theme.muted, marginBottom: 14 }}>Pages per Month</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 72 }}>
            {monthlyPages.map((pages, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div title={pages > 0 ? `${pages} pages` : '—'} style={{ width: '100%', height: pages > 0 ? `${(pages / maxPages) * 58}px` : 3, background: pages > 0 ? theme.accent : theme.border, borderRadius: '3px 3px 0 0', opacity: i > new Date().getMonth() ? 0.25 : 1 }} />
                <span style={{ fontSize: 8.5, color: theme.muted }}>{months[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Streaks */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Current Streak', value: String(currentStreak), unit: 'days' },
            { label: 'Best Streak', value: String(longestStreak), unit: 'days' },
          ].map(item => (
            <div key={item.label} style={{ background: theme.bgSecondary, borderRadius: 16, padding: '16px 16px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.9, textTransform: 'uppercase', color: theme.muted, marginBottom: 5 }}>{item.label}</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 36, color: theme.fg, lineHeight: 1 }}>{item.value}</div>
              <div style={{ fontSize: 11, color: theme.muted, marginTop: 3 }}>{item.unit}</div>
            </div>
          ))}
        </div>

        {/* Year in Review CTA */}
        <motion.div onClick={() => navigate('/yearreview')}
          whileTap={{ scale: 0.98 }}
          style={{ background: dark ? '#181818' : '#0A0A0A', borderRadius: 18, padding: '20px', marginBottom: 28, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, opacity: 0.12, pointerEvents: 'none' }}>
            <svg viewBox="0 0 140 140" style={{ width: '100%', height: '100%' }}>
              <path d="M70,10 C100,0 135,25 138,60 C141,95 118,130 82,138 C46,146 10,122 4,86 C-2,50 20,12 50,6 C80,0 40,20 70,10Z" fill="white"/>
            </svg>
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#FFFFFF', marginBottom: 5 }}>Year in Review</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 14 }}>See your {new Date().getFullYear()} reading story</div>
          <div style={{ padding: '10px 18px', background: 'rgba(255,255,255,0.12)', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#FFF', fontWeight: 500 }}>
            Open
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6H10M10 6L7 3M10 6L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </motion.div>

        {/* AI Picks CTA */}
        <motion.div onClick={() => navigate('/ai')}
          whileTap={{ scale: 0.98 }}
          style={{ background: theme.bgSecondary, border: `1px solid ${theme.border}`, borderRadius: 18, padding: '20px', marginBottom: 28, cursor: 'pointer' }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>✨</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: theme.fg, marginBottom: 4 }}>What should I read next?</div>
          <div style={{ fontSize: 13, color: theme.muted }}>AI recommendations based on your taste</div>
        </motion.div>
      </div>

      <TabBar activeTab="stats" onTabChange={t => navigate(`/${t === 'home' ? 'home' : t}`)} theme={theme} />
    </div>
  )
}
