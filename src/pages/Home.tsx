import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BookCover, TabBar, ProgressBar, SectionLabel } from '../components/UI'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import type { UserBook, ReadingSession } from '../types'

export function HomeScreen() {
  const { theme } = useTheme()
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [currentBooks, setCurrentBooks] = useState<UserBook[]>([])
  const [streak, setStreak] = useState(0)
  const [yearlyCount, setYearlyCount] = useState(0)
  const [yearlyGoal, setYearlyGoal] = useState(12)
  const [weekDays, setWeekDays] = useState<boolean[]>([false,false,false,false,false,false,false])

  const now = new Date()
  const h = now.getHours()
  const greeting = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const username = profile?.username?.split(' ')[0] ?? 'Reader'
  const dayLetters = ['M','T','W','T','F','S','S']

  useEffect(() => {
    if (!user) return

    // fetch current reading books
    supabase.from('user_books').select('*, book:books(*)').eq('user_id', user.id).eq('status', 'reading').limit(3)
      .then(({ data }) => { if (data) setCurrentBooks(data as UserBook[]) })

    // fetch yearly finished count
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString()
    supabase.from('user_books').select('id', { count: 'exact' }).eq('user_id', user.id).eq('status', 'finished').gte('finished_at', startOfYear)
      .then(({ count }) => { if (count !== null) setYearlyCount(count) })

    // reading goal
    if (profile?.reading_goal_books_per_year) setYearlyGoal(profile.reading_goal_books_per_year)

    // streak & heatmap from sessions
    supabase.from('reading_sessions').select('started_at').eq('user_id', user.id).gte('started_at', new Date(Date.now() - 7 * 86400000).toISOString()).order('started_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return
        const sessionDates = new Set(data.map((s: { started_at: string }) => new Date(s.started_at).toDateString()))

        // Week heat (Mon-Sun)
        const week: boolean[] = Array(7).fill(false)
        const today = new Date()
        for (let i = 0; i < 7; i++) {
          const d = new Date(today); d.setDate(today.getDate() - (today.getDay() - 1 + 7 - i) % 7)
          week[i] = sessionDates.has(d.toDateString())
        }
        setWeekDays(week)

        // Streak
        let s = 0; const now = new Date()
        for (let i = 0; i < 366; i++) {
          const d = new Date(now); d.setDate(now.getDate() - i)
          if (sessionDates.has(d.toDateString())) s++
          else if (i > 0) break
        }
        setStreak(s)
      })
  }, [user, profile])

  const activeBook = currentBooks[0]
  const progress = activeBook ? (activeBook.custom_pages ?? activeBook.book?.pages_default ?? 1) > 0
    ? 0.5 : 0 : 0 // placeholder; real progress from session data

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <div style={{ flex: 1, padding: '64px 22px 0' }}>

        {/* Greeting */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 400, color: theme.fg, letterSpacing: -1, lineHeight: 1.15 }}>
            {greeting},<br />{username}
          </div>
          <div style={{ fontSize: 13, color: theme.muted, marginTop: 5 }}>{dateStr}</div>
        </div>

        {/* Currently Reading */}
        {activeBook ? (
          <div style={{ background: theme.bgSecondary, borderRadius: 20, padding: 18, marginBottom: 14 }}>
            <SectionLabel theme={theme}>Currently Reading</SectionLabel>
            <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
              <BookCover index={0} width={70} height={106} coverUrl={activeBook.book?.cover_url} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: theme.fg, lineHeight: 1.3, marginBottom: 3 }}>{activeBook.book?.title}</div>
                  <div style={{ fontSize: 13, color: theme.muted }}>{activeBook.book?.author}</div>
                </div>
                <div>
                  <ProgressBar progress={progress} theme={theme} height={3} />
                </div>
              </div>
            </div>
            <button onClick={() => navigate('/session', { state: { book: activeBook } })} style={{ width: '100%', padding: 13, background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              Continue Reading
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5H11M11 6.5L7 2.5M11 6.5L7 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        ) : (
          <div style={{ background: theme.bgSecondary, borderRadius: 20, padding: 18, marginBottom: 14 }}>
            <SectionLabel theme={theme}>Currently Reading</SectionLabel>
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
              <div style={{ fontSize: 14, color: theme.muted, marginBottom: 16 }}>No books in progress</div>
              <button onClick={() => navigate('/search')} style={{ padding: '10px 20px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500 }}>
                Find a book
              </button>
            </div>
          </div>
        )}

        {/* Streak */}
        <div style={{ background: theme.bgSecondary, borderRadius: 16, padding: '16px 18px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <SectionLabel theme={theme}>Reading Streak</SectionLabel>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontFamily: 'Georgia, serif', fontSize: 36, color: theme.fg, lineHeight: 1 }}>{streak}</span>
                <span style={{ fontSize: 13, color: theme.muted }}>days</span>
              </div>
            </div>
            <div style={{ fontSize: 28, lineHeight: 1, marginTop: 4 }}>🔥</div>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {dayLetters.map((day, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', aspectRatio: '1', borderRadius: 4, background: weekDays[i] ? theme.accent : theme.border }} />
                <span style={{ fontSize: 9, color: theme.muted }}>{day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Goal */}
        <div style={{ background: theme.bgSecondary, borderRadius: 16, padding: '16px 18px', marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <SectionLabel theme={theme}>{new Date().getFullYear()} Goal</SectionLabel>
            <span style={{ fontSize: 13, color: theme.fg, fontWeight: 500 }}>{yearlyCount} / {yearlyGoal} books</span>
          </div>
          <ProgressBar progress={yearlyGoal > 0 ? yearlyCount / yearlyGoal : 0} theme={theme} height={5} />
          <div style={{ fontSize: 12, color: theme.muted, marginTop: 8 }}>
            {yearlyCount >= yearlyGoal ? '🎉 Goal reached!' : `${yearlyGoal - yearlyCount} remaining · Keep going`}
          </div>
        </div>
      </div>

      <TabBar activeTab="home" onTabChange={(t) => navigate(`/${t === 'home' ? 'home' : t}`)} theme={theme} />
    </div>
  )
}

export default function HomeScreenWrapper() {
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ height: '100%' }}><HomeScreen /></motion.div>
}
