import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useAuth, useTheme } from './context/AppContext'
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
import AdminPanel from './pages/admin/AdminPanel'

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
        <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  const { theme } = useTheme()
  return (
    <div style={{ minHeight: '100vh', background: theme.bg, maxWidth: 430, margin: '0 auto', position: 'relative', overflow: 'hidden' }}>
      <AppRoutes />
    </div>
  )
}
