import React from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useAuth, useTheme, useIsDesktop } from './context/AppContext'
import { Spinner } from './components/UI'

// Pages
import { SplashScreen, SignUpScreen, SignInScreen } from './pages/Auth'
import HomeScreen from './pages/Home'
import SearchScreen from './pages/Search'
import BookDetailScreen from './pages/BookDetail'
import SessionScreen from './pages/Session'
import LibraryScreen from './pages/Library'
import StatsScreen from './pages/Stats'
import ProfileScreen from './pages/Profile'
import YearInReviewScreen from './pages/YearInReview'
import AIRecommendationsScreen from './pages/AIRecommendations'
import AchievementsScreen from './pages/Achievements'
import AdminPanel from './pages/admin/AdminPanel'
import PublicProfileScreen from './pages/PublicProfile'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { theme } = useTheme()
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.bg }}>
      <Spinner color={theme.muted} />
    </div>
  )
  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth()
  const { theme } = useTheme()
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.bg }}>
      <Spinner color={theme.muted} />
    </div>
  )
  if (!user) return <Navigate to="/" replace />
  if (!isAdmin) return <Navigate to="/home" replace />
  return <>{children}</>
}

function AppRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/signup" element={<SignUpScreen />} />
        <Route path="/signin" element={<SignInScreen />} />
        <Route path="/home" element={<ProtectedRoute><HomeScreen /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><SearchScreen /></ProtectedRoute>} />
        <Route path="/detail" element={<ProtectedRoute><BookDetailScreen /></ProtectedRoute>} />
        <Route path="/session" element={<ProtectedRoute><SessionScreen /></ProtectedRoute>} />
        <Route path="/library" element={<ProtectedRoute><LibraryScreen /></ProtectedRoute>} />
        <Route path="/stats" element={<ProtectedRoute><StatsScreen /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfileScreen /></ProtectedRoute>} />
        <Route path="/yearreview" element={<ProtectedRoute><YearInReviewScreen /></ProtectedRoute>} />
        <Route path="/ai" element={<ProtectedRoute><AIRecommendationsScreen /></ProtectedRoute>} />
        <Route path="/achievements" element={<ProtectedRoute><AchievementsScreen /></ProtectedRoute>} />
        <Route path="/profile/:userId" element={<ProtectedRoute><PublicProfileScreen /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}

// ─── Desktop sidebar ──────────────────────────────────────────────────────────
function DesktopSidebar() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  if (!user) return null

  const NAV = [
    { path: '/home',         label: 'Home',        icon: <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><path d="M2 9L11 2L20 9V20C20 20.55 19.55 21 19 21H14V15H8V21H3C2.45 21 2 20.55 2 20V9Z" strokeWidth="1.6" strokeLinejoin="round"/></svg> },
    { path: '/search',       label: 'Discover',    icon: <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><circle cx="10" cy="10" r="6.5" strokeWidth="1.6"/><line x1="15" y1="15" x2="20" y2="20" strokeWidth="1.8" strokeLinecap="round"/></svg> },
    { path: '/library',      label: 'Library',     icon: <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><rect x="3" y="2" width="4" height="18" rx="1.5" strokeWidth="1.6"/><rect x="9" y="2" width="4" height="18" rx="1.5" strokeWidth="1.6"/><path d="M15 3L20 5.5V19L15 16.5V3Z" strokeWidth="1.6" strokeLinejoin="round"/></svg> },
    { path: '/stats',        label: 'Stats',       icon: <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><rect x="2" y="13" width="4" height="7" rx="1" strokeWidth="1.6"/><rect x="9" y="8" width="4" height="12" rx="1" strokeWidth="1.6"/><rect x="16" y="3" width="4" height="17" rx="1" strokeWidth="1.6"/></svg> },
    { path: '/achievements', label: 'Achievements',icon: <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="9" r="6" strokeWidth="1.6"/><path d="M7 14L5 20L11 17L17 20L15 14" strokeWidth="1.6" strokeLinejoin="round"/></svg> },
    { path: '/profile',      label: 'Profile',     icon: <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="7.5" r="3.5" strokeWidth="1.6"/><path d="M3 19C3 15.68 6.58 13 11 13C15.42 13 19 15.68 19 19" strokeWidth="1.6" strokeLinecap="round"/></svg> },
  ]

  return (
    <aside style={{ width: 220, minHeight: '100vh', background: theme.bg, borderRight: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, flexShrink: 0 }}>
      {/* Logo */}
      <div style={{ padding: '28px 24px 24px', borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 400, color: theme.fg, letterSpacing: -0.5 }}>ClickaClick</div>
        <div style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>Read</div>
      </div>
      {/* Nav links */}
      <nav style={{ flex: 1, padding: '16px 12px' }}>
        {NAV.map(({ path, label, icon }) => {
          const active = location.pathname === path
          return (
            <button key={path} onClick={() => navigate(path)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12, background: active ? `${theme.accent}18` : 'transparent', border: 'none', cursor: 'pointer', marginBottom: 2, textAlign: 'left', transition: 'background 0.15s' }}>
              <span style={{ color: active ? theme.accent : theme.muted, display: 'flex', stroke: 'currentColor' }}>
                {icon}
              </span>
              <span style={{ fontSize: 14, fontWeight: active ? 600 : 400, color: active ? theme.fg : theme.muted }}>{label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}

export default function App() {
  const { theme } = useTheme()
  const isDesktop = useIsDesktop()

  if (isDesktop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: theme.bgSecondary }}>
        <DesktopSidebar />
        <main style={{ flex: 1, minHeight: '100vh', background: theme.bg, overflowY: 'auto', position: 'relative' }}>
          <AppRoutes />
        </main>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, maxWidth: 430, margin: '0 auto', position: 'relative', overflow: 'hidden' }}>
      <AppRoutes />
    </div>
  )
}
