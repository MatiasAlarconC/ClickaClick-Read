import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TabBar } from '../components/UI'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { FlameIcon, LightningIcon } from '../components/Icons'
import type { ReadingSession, UserBook } from '../types'

export default function StatsScreen() {
  const { theme } = useTheme()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const dark = theme.dark

  const [sessions, setSessions] = useState<ReadingSession[]>([])
  const [userBooks, setUserBooks] = useState<UserBook[]>([])
  const [loading, setLoading] = useState(true)
  const [showPagesBreakdown, setShowPagesBreakdown] = useState(false)

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
    // Sum all session pages (timed + manual)
    const sessionPagesByBook: Record<string, number> = {}
    for (const s of sessions) {
      if (s.book_id) sessionPagesByBook[s.book_id] = (sessionPagesByBook[s.book_id] ?? 0) + (s.pages_read ?? 0)
    }
    let pagesRead = sessions.reduce((s, r) => s + (r.pages_read ?? 0), 0)
    // For finished books where tracked sessions under-count (pre-session manual reads not in DB),
    // add the gap so the total reflects the true pages read.
    const thisYearStart = new Date(new Date().getFullYear(), 0, 1)
    for (const b of userBooks) {
      if (b.status !== 'finished') continue
      const finishedAt = b.finished_at ? new Date(b.finished_at) : null
      // Only count books finished this year (or no finish date recorded)
      if (finishedAt && finishedAt < thisYearStart) continue
      const bookPages = b.custom_pages ?? (b.book as { pages_default?: number | null } | undefined)?.pages_default ?? 0
      if (!bookPages) continue
      const tracked = sessionPagesByBook[b.book_id] ?? 0
      if (bookPages > tracked) pagesRead += (bookPages - tracked)
    }
    // Timed sessions only (exclude is_manual and zero-duration entries)
    const timedSessions = sessions.filter(s => !s.is_manual && (s.duration_seconds ?? 0) > 0)
    const timedPages = timedSessions.reduce((s, r) => s + (r.pages_read ?? 0), 0)
    const timedHours = timedSessions.reduce((s, r) => s + (r.duration_seconds ?? 0), 0) / 3600
    const totalTimedSecs = timedSessions.reduce((s, r) => s + (r.duration_seconds ?? 0), 0)
    const timedDays = new Set(timedSessions.map(s => new Date(s.started_at).toDateString())).size
    const hours = Math.round(totalTimedSecs / 3600)
    // Reading pace: pages per hour from timed sessions
    const pacePerHour = timedHours > 0 ? Math.round(timedPages / timedHours) : 0
    // True daily averages: over all days that had timed sessions
    const dailyAvgPages = timedDays > 0 ? Math.round(timedPages / timedDays) : 0
    const avgDailyMins = timedDays > 0 ? Math.round(totalTimedSecs / 60 / timedDays) : 0
    // Today's progress for goal tracking (timed sessions only)
    const todayStr = new Date().toDateString()
    const todayTimedSessions = timedSessions.filter(s => new Date(s.started_at).toDateString() === todayStr)
    const todayPages = todayTimedSessions.reduce((s, r) => s + (r.pages_read ?? 0), 0)
    const todayMins = Math.round(todayTimedSessions.reduce((s, r) => s + (r.duration_seconds ?? 0), 0) / 60)
    return { booksFinished, pagesRead, hours, dailyAvgPages, pacePerHour, avgDailyMins, todayPages, todayMins }
  }, [sessions, userBooks])

  const pagesBreakdown = useMemo(() => {
    const sessionPagesByBook: Record<string, number> = {}
    for (const s of sessions) {
      if (s.book_id) sessionPagesByBook[s.book_id] = (sessionPagesByBook[s.book_id] ?? 0) + (s.pages_read ?? 0)
    }
    const thisYearStart = new Date(new Date().getFullYear(), 0, 1)
    const bookIds = new Set([
      ...Object.keys(sessionPagesByBook),
      ...userBooks.filter(b => b.status === 'finished').map(b => b.book_id),
    ])
    const rows: { title: string; author: string; cover: string | null; pages: number }[] = []
    for (const bid of bookIds) {
      const ub = userBooks.find(b => b.book_id === bid)
      if (!ub) continue
      const bookMeta = ub.book as { title?: string; author?: string; cover_url?: string | null; pages_default?: number | null } | undefined
      let pages = sessionPagesByBook[bid] ?? 0
      if (ub.status === 'finished') {
        const finishedAt = ub.finished_at ? new Date(ub.finished_at) : null
        if (!finishedAt || finishedAt >= thisYearStart) {
          const bookPages = ub.custom_pages ?? bookMeta?.pages_default ?? 0
          if (bookPages > pages) pages = bookPages
        }
      }
      if (pages === 0) continue
      rows.push({
        title: bookMeta?.title ?? 'Unknown',
        author: bookMeta?.author ?? '',
        cover: bookMeta?.cover_url ?? null,
        pages,
      })
    }
    return rows.sort((a, b) => b.pages - a.pages)
  }, [sessions, userBooks])

  // Heatmap: last 16 weeks × 7 days (timed sessions only)
  const WEEKS = 16
  const heatmap = useMemo(() => {
    const timedOnly = sessions.filter(s => !s.is_manual && (s.duration_seconds ?? 0) > 0)
    const sessionDates = new Set(timedOnly.map(s => new Date(s.started_at).toDateString()))
    const sessionPagesByDate: Record<string, number> = {}
    for (const s of timedOnly) {
      const d = new Date(s.started_at).toDateString()
      sessionPagesByDate[d] = (sessionPagesByDate[d] ?? 0) + (s.pages_read ?? 0)
    }

    const today = new Date()
    const cells: Array<{ date: Date; value: 0|1|2; isToday: boolean }> = []
    const todayStr = today.toDateString()

    // Start from WEEKS weeks ago Monday
    const start = new Date(today)
    start.setDate(start.getDate() - (WEEKS - 1) * 7)
    const dow = start.getDay()
    start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1))

    for (let i = 0; i < WEEKS * 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      if (d > today) { cells.push({ date: d, value: 0, isToday: false }); continue }
      const p = sessionPagesByDate[d.toDateString()] ?? 0
      const hasSession = sessionDates.has(d.toDateString())
      cells.push({ date: d, value: hasSession ? (p > 30 ? 2 : 1) : 0, isToday: d.toDateString() === todayStr })
    }
    return cells
  }, [sessions])

  // Streak
  const { currentStreak, longestStreak } = useMemo(() => {
    const sessionDates = new Set(sessions.filter(s => !s.is_manual).map(s => new Date(s.started_at).toDateString()))
    let current = 0; const today = new Date()
    for (let i = 0; i < 366; i++) {
      const d = new Date(today); d.setDate(today.getDate() - i)
      if (sessionDates.has(d.toDateString())) current++
      else if (i > 0) break
    }
    let longest = 0, run = 0
    const sorted = [...sessionDates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
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

  // Monthly insights: this month vs last month
  const monthlyInsights = useMemo(() => {
    const now = new Date()
    const thisYear = now.getFullYear(); const thisMonth = now.getMonth()
    const lastMonthDate = new Date(thisYear, thisMonth - 1, 1)
    const lastYear = lastMonthDate.getFullYear(); const lastMonth = lastMonthDate.getMonth()
    const filterMonth = (y: number, m: number) => sessions.filter(s => { const d = new Date(s.started_at); return d.getFullYear() === y && d.getMonth() === m })
    const calc = (subs: ReadingSession[]) => {
      const pages = subs.reduce((a, s) => a + (s.pages_read ?? 0), 0)
      const days = new Set(subs.map(s => new Date(s.started_at).toDateString())).size
      const timed = subs.filter(s => (s.duration_seconds ?? 0) > 0)
      const timedPages = timed.reduce((a, s) => a + (s.pages_read ?? 0), 0)
      const timedHrs = timed.reduce((a, s) => a + (s.duration_seconds ?? 0), 0) / 3600
      const speed = timedHrs > 0 ? Math.round(timedPages / timedHrs) : 0
      const totalSecs = subs.reduce((a, s) => a + (s.duration_seconds ?? 0), 0)
      const avgMins = days > 0 ? Math.round(totalSecs / 60 / days) : 0
      return { pages, speed, avgMins }
    }
    const thisData = calc(filterMonth(thisYear, thisMonth))
    const lastData = calc(filterMonth(lastYear, lastMonth))
    const hasLast = lastData.pages > 0 || lastData.speed > 0
    const lastMonthName = lastMonthDate.toLocaleString('default', { month: 'long' })
    return { thisData, lastData, hasLast, lastMonthName }
  }, [sessions])

  const heatmapMonthLabels = useMemo(() => {
    const labels: { text: string; col: number }[] = []
    let lastMonth = -1
    for (let week = 0; week < WEEKS; week++) {
      const cell = heatmap[week * 7]
      if (!cell) continue
      const m = cell.date.getMonth()
      if (m !== lastMonth) {
        labels.push({ text: cell.date.toLocaleString('default', { month: 'short' }), col: week })
        lastMonth = m
      }
    }
    return labels
  }, [heatmap])


  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: theme.bg, paddingBottom: 'calc(68px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ flex: 1, padding: '64px 22px 0' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 400, color: theme.fg, letterSpacing: -1, lineHeight: 1.15 }}>Your Reading<br />Life</div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Books', value: String(stats.booksFinished), sub: 'this year', clickable: false },
            { label: 'Pages', value: stats.pagesRead.toLocaleString(), sub: 'this year', clickable: true },
            { label: 'Hours', value: String(stats.hours), sub: 'of reading', clickable: false },
            { label: 'Daily avg', value: `${stats.dailyAvgPages} pg`, sub: 'per day', clickable: false },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              onClick={s.clickable ? () => setShowPagesBreakdown(true) : undefined}
              style={{ background: theme.bgSecondary, borderRadius: 16, padding: '16px 16px 14px', cursor: s.clickable ? 'pointer' : 'default', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.9, textTransform: 'uppercase', color: theme.muted }}>{s.label}</div>
                {s.clickable && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.4 }}>
                    <path d="M2 6H10M10 6L7 3M10 6L7 9" stroke={theme.fg} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
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
          <LightningIcon size={36} color={theme.accent} style={{ opacity: 0.7 }}/>
        </motion.div>

        {/* Heatmap — last 16 weeks */}
        {(() => {
          const HCELL = 13; const HGAP = 3
          const DAY_LABELS = ['M','T','W','T','F','S','S']
          const LABEL_W = 14
          return (
            <div style={{ background: theme.bgSecondary, borderRadius: 16, padding: '16px 16px 14px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.9, textTransform: 'uppercase', color: theme.muted }}>Last 4 months</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 9, color: theme.muted }}>None</span>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: theme.border }} />
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.22)' }} />
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: theme.accent }} />
                  <span style={{ fontSize: 9, color: theme.muted }}>Active</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 0 }}>
                {/* Day labels */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: HGAP, marginRight: 6, paddingTop: 18 }}>
                  {DAY_LABELS.map((d, i) => (
                    <div key={i} style={{ height: HCELL, display: 'flex', alignItems: 'center', fontSize: 9, color: theme.muted, width: LABEL_W, justifyContent: 'flex-end' }}>{i % 2 === 0 ? d : ''}</div>
                  ))}
                </div>
                {/* Grid */}
                <div style={{ flex: 1, overflowX: 'auto' }}>
                  <div style={{ width: WEEKS * (HCELL + HGAP) }}>
                    {/* Month labels */}
                    <div style={{ position: 'relative', height: 16, marginBottom: 2 }}>
                      {heatmapMonthLabels.map(({ text, col }) => (
                        <span key={col} style={{ position: 'absolute', left: col * (HCELL + HGAP), fontSize: 10, fontWeight: 600, color: theme.muted, whiteSpace: 'nowrap' }}>{text}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: HGAP }}>
                      {[...Array(WEEKS)].map((_, week) => (
                        <div key={week} style={{ display: 'flex', flexDirection: 'column', gap: HGAP }}>
                          {[...Array(7)].map((_, day) => {
                            const cell = heatmap[week * 7 + day]
                            const isFuture = cell?.date && cell.date > new Date()
                            if (isFuture) return <div key={day} style={{ width: HCELL, height: HCELL }} />
                            const val = cell?.value ?? 0
                            const isToday = cell?.isToday
                            const bg = val === 0 ? theme.border : val === 1 ? (dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.22)') : theme.accent
                            return (
                              <div key={day} title={cell?.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                style={{ width: HCELL, height: HCELL, borderRadius: 3, background: bg,
                                  boxShadow: isToday ? `0 0 0 2px ${theme.accent}` : 'none',
                                  transition: 'background 0.15s' }} />
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Monthly pages chart */}
        <div style={{ background: theme.bgSecondary, borderRadius: 16, padding: '16px 16px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.9, textTransform: 'uppercase', color: theme.muted, marginBottom: 14 }}>Pages per Month</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 86 }}>
            {monthlyPages.map((pages, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                {pages > 0 && (
                  <span style={{ fontSize: 7, color: theme.muted, textAlign: 'center', lineHeight: 1, marginBottom: 1 }}>{pages >= 1000 ? `${(pages/1000).toFixed(1)}k` : pages}</span>
                )}
                <div title={pages > 0 ? `${pages} pages` : '—'} style={{ width: '100%', height: pages > 0 ? `${Math.max(4, (pages / maxPages) * 58)}px` : 3, background: pages > 0 ? theme.accent : theme.border, borderRadius: '3px 3px 0 0', opacity: i > new Date().getMonth() ? 0.25 : 1 }} />
                <span style={{ fontSize: 8.5, color: theme.muted }}>{months[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Streaks */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Current Streak', value: String(currentStreak), unit: 'days', icon: <FlameIcon size={28} color={theme.accent}/> },
            { label: 'Best Streak', value: String(longestStreak), unit: 'days', icon: <FlameIcon size={28} color={theme.muted}/> },
          ].map(item => (
            <div key={item.label} style={{ background: theme.bgSecondary, borderRadius: 16, padding: '16px 16px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.9, textTransform: 'uppercase', color: theme.muted, marginBottom: 5 }}>{item.label}</div>
                {item.icon}
              </div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 36, color: theme.fg, lineHeight: 1 }}>{item.value}</div>
              <div style={{ fontSize: 11, color: theme.muted, marginTop: 3 }}>{item.unit}</div>
            </div>
          ))}
        </div>

        {/* Reading Goals progress */}
        {(() => {
          const goalBooks  = (profile as any)?.reading_goal_books_per_year
          const goalPages  = (profile as any)?.reading_goal_pages_per_day
          const goalMins   = (profile as any)?.reading_goal_minutes_per_day
          const goalStreak = (profile as any)?.reading_goal_streak_days
          const goals = [
            goalBooks  ? { label: 'Books this year', current: stats.booksFinished, target: goalBooks,  unit: 'books' }      : null,
            goalPages  ? { label: 'Pages today',     current: stats.todayPages,    target: goalPages,  unit: 'pages' }     : null,
            goalMins   ? { label: 'Minutes today',   current: stats.todayMins,     target: goalMins,   unit: 'min' }    : null,
            goalStreak ? { label: 'Reading streak',  current: currentStreak,       target: goalStreak, unit: 'days' }       : null,
          ].filter(Boolean) as { label: string; current: number; target: number; unit: string }[]
          if (goals.length === 0) return null
          return (
            <div style={{ background: theme.bgSecondary, borderRadius: 16, padding: '16px 16px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.9, textTransform: 'uppercase', color: theme.muted, marginBottom: 14 }}>Reading Goals</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {goals.map(g => {
                  const pct = Math.min(100, g.target > 0 ? (g.current / g.target) * 100 : 0)
                  const done = pct >= 100
                  return (
                    <div key={g.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: theme.fg }}>{g.label}</span>
                        <span style={{ fontSize: 12, color: done ? theme.accent : theme.muted, fontWeight: done ? 600 : 400 }}>
                          {g.current} / {g.target} {g.unit}
                        </span>
                      </div>
                      <div style={{ height: 5, background: theme.bg, borderRadius: 3, overflow: 'hidden' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut' }}
                          style={{ height: '100%', background: done ? theme.accent : `${theme.accent}90`, borderRadius: 3 }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Monthly Insights */}
        <div style={{ background: theme.bgSecondary, borderRadius: 16, padding: '16px 16px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.9, textTransform: 'uppercase', color: theme.muted, marginBottom: 14 }}>This Month vs Last</div>
          {monthlyInsights.thisData.pages === 0 && !monthlyInsights.hasLast ? (
            <div style={{ fontSize: 13, color: theme.muted, textAlign: 'center', padding: '8px 0' }}>No reading data yet this month.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Pages read', thisVal: monthlyInsights.thisData.pages, lastVal: monthlyInsights.lastData.pages, unit: 'pages' },
                { label: 'Reading speed', thisVal: monthlyInsights.thisData.speed, lastVal: monthlyInsights.lastData.speed, unit: 'pg/hr' },
                { label: 'Avg daily time', thisVal: monthlyInsights.thisData.avgMins, lastVal: monthlyInsights.lastData.avgMins, unit: 'min/day' },
              ].map(row => {
                const diff = row.lastVal > 0 ? Math.round(((row.thisVal - row.lastVal) / row.lastVal) * 100) : null
                const up = diff !== null && diff > 0; const dn = diff !== null && diff < 0
                return (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, color: theme.fg }}>{row.label}</div>
                      {monthlyInsights.hasLast && <div style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{row.lastVal > 0 ? `${row.lastVal} ${row.unit}` : '—'} in {monthlyInsights.lastMonthName}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: theme.fg, lineHeight: 1 }}>
                        {row.thisVal > 0 ? row.thisVal : '—'}{row.thisVal > 0 && <span style={{ fontSize: 10, color: theme.muted }}> {row.unit}</span>}
                      </div>
                      {diff !== null && (
                        <div style={{ fontSize: 11, color: up ? '#22c55e' : dn ? '#ef4444' : theme.muted, marginTop: 2 }}>
                          {up ? '▲' : dn ? '▼' : '='} {Math.abs(diff)}%
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
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


      </div>

      <TabBar activeTab="stats" onTabChange={t => navigate(`/${t === 'home' ? 'home' : t}`)} theme={theme} />

      {/* Pages breakdown sheet */}
      {showPagesBreakdown && (
        <div
          onClick={() => setShowPagesBreakdown(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', background: theme.bgElevated, borderRadius: '20px 20px 0 0', maxHeight: '78vh', display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            {/* Handle + header */}
            <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: theme.border, margin: '0 auto 16px' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: theme.fg }}>Pages by Book</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: theme.accent }}>{stats.pagesRead.toLocaleString()}</div>
              </div>
              <div style={{ fontSize: 11, color: theme.muted, marginBottom: 16 }}>This year · {pagesBreakdown.length} book{pagesBreakdown.length !== 1 ? 's' : ''}</div>
              <div style={{ height: 1, background: theme.border, marginBottom: 4 }} />
            </div>
            {/* List */}
            <div style={{ overflowY: 'auto', padding: '4px 20px 24px', flex: 1 }}>
              {pagesBreakdown.length === 0 ? (
                <div style={{ fontSize: 13, color: theme.muted, textAlign: 'center', padding: '32px 0' }}>No pages recorded yet this year.</div>
              ) : (
                pagesBreakdown.map((row, i) => {
                  const pct = stats.pagesRead > 0 ? (row.pages / stats.pagesRead) * 100 : 0
                  return (
                    <div key={i} style={{ paddingTop: 14, paddingBottom: 14, borderBottom: i < pagesBreakdown.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        {row.cover ? (
                          <img src={row.cover} alt="" style={{ width: 36, height: 52, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 36, height: 52, borderRadius: 4, background: theme.border, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="10" height="12" rx="1.5" stroke={theme.muted} strokeWidth="1.2"/><path d="M4 5h6M4 7.5h4" stroke={theme.muted} strokeWidth="1" strokeLinecap="round"/></svg>
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: theme.fg, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.title}</div>
                          <div style={{ fontSize: 11, color: theme.muted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.author}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: theme.fg, lineHeight: 1 }}>{row.pages.toLocaleString()}</div>
                          <div style={{ fontSize: 10, color: theme.muted, marginTop: 2 }}>{pct.toFixed(1)}%</div>
                        </div>
                      </div>
                      <div style={{ height: 3, background: theme.border, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: theme.accent, borderRadius: 2 }} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
