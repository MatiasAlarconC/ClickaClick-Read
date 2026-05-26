import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BlobShape, BackButton, FormInput, PrimaryButton } from '../components/UI'
import { useAuth, useTheme } from '../context/AppContext'

// ─── Splash ──────────────────────────────────────────────────────────────────
export function SplashScreen() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)

  React.useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ minHeight: '100%', background: theme.bg, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -80, left: -100, width: 340, height: 340, pointerEvents: 'none' }}>
        <BlobShape size="large" fill={theme.blobFill} opacity={0.6} style={{ width: '100%', height: '100%' }} />
      </div>
      <div style={{ position: 'absolute', bottom: 120, right: -70, width: 200, height: 200, pointerEvents: 'none' }}>
        <BlobShape size="medium" fill={theme.blobFill} opacity={0.4} style={{ width: '100%', height: '100%' }} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 36px', paddingTop: 64, opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 0.5s ease, transform 0.5s ease' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 58, fontWeight: 400, color: theme.fg, lineHeight: 0.92, letterSpacing: -2.5 }}>Clicka<br />Click</div>
          </div>
          <div style={{ fontSize: 15, color: theme.muted, lineHeight: 1.6, maxWidth: 220 }}>
            Your reading life,<br />beautifully tracked.
          </div>
        </div>

        <div style={{ paddingBottom: 50, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => navigate('/signup')} style={{ width: '100%', padding: 15, background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 500 }}>
            Get Started
          </button>
          <button onClick={() => navigate('/signin')} style={{ width: '100%', padding: 15, background: 'none', color: theme.muted, border: `1.5px solid ${theme.border}`, borderRadius: 12, fontSize: 15 }}>
            Sign In
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sign Up ─────────────────────────────────────────────────────────────────
export function SignUpScreen() {
  const { theme } = useTheme()
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!name || !email || !password) { setError('All fields required'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true); setError(null)
    const { error: err } = await signUp(email, password, name)
    setLoading(false)
    if (err) { setError(err); return }
    navigate('/home')
  }

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} style={{ minHeight: '100%', background: theme.bg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -20, right: -50, width: 180, height: 180, pointerEvents: 'none' }}>
        <BlobShape size="medium" fill={theme.blobFill} opacity={0.35} style={{ width: '100%', height: '100%' }} />
      </div>
      <div style={{ padding: '24px 32px 48px', paddingTop: 64 }}>
        <BackButton onPress={() => navigate('/')} theme={theme} />
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 38, fontWeight: 400, color: theme.fg, lineHeight: 1.0, letterSpacing: -1.5, marginBottom: 8 }}>Create<br />Account</div>
        <div style={{ fontSize: 14, color: theme.muted, marginBottom: 44 }}>Start your reading journey today</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <FormInput label="Full Name" value={name} onChange={setName} placeholder="Matias Rodriguez" theme={theme} />
          <FormInput label="Email" type="email" value={email} onChange={setEmail} placeholder="matias@example.com" theme={theme} />
          <FormInput label="Password" type="password" value={password} onChange={setPassword} placeholder="Min. 8 characters" theme={theme} />
        </div>

        {error && <div style={{ marginTop: 16, padding: '10px 14px', background: '#ff4444' + '20', borderRadius: 10, fontSize: 13, color: '#ff4444' }}>{error}</div>}

        <PrimaryButton label={loading ? 'Creating account…' : 'Create Account'} onPress={handleSubmit} disabled={loading} theme={theme} style={{ marginTop: 44 }} />

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: theme.muted }}>
          Already have an account?{' '}
          <span onClick={() => navigate('/signin')} style={{ color: theme.fg, cursor: 'pointer', fontWeight: 500 }}>Sign in</span>
        </p>
      </div>
    </motion.div>
  )
}

// ─── Sign In ─────────────────────────────────────────────────────────────────
export function SignInScreen() {
  const { theme } = useTheme()
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!email || !password) { setError('All fields required'); return }
    setLoading(true); setError(null)
    const { error: err } = await signIn(email, password)
    setLoading(false)
    if (err) { setError(err); return }
    navigate('/home')
  }

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} style={{ minHeight: '100%', background: theme.bg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', bottom: 200, left: -70, width: 200, height: 200, pointerEvents: 'none' }}>
        <BlobShape size="medium" fill={theme.blobFill} opacity={0.3} style={{ width: '100%', height: '100%' }} />
      </div>
      <div style={{ padding: '24px 32px 48px', paddingTop: 64 }}>
        <BackButton onPress={() => navigate('/')} theme={theme} />
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 38, fontWeight: 400, color: theme.fg, lineHeight: 1.0, letterSpacing: -1.5, marginBottom: 8 }}>Welcome<br />back</div>
        <div style={{ fontSize: 14, color: theme.muted, marginBottom: 44 }}>Sign in to continue reading</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <FormInput label="Email" type="email" value={email} onChange={setEmail} placeholder="matias@example.com" theme={theme} />
          <FormInput label="Password" type="password" value={password} onChange={setPassword} placeholder="Your password" theme={theme} />
        </div>

        <div style={{ textAlign: 'right', marginTop: 14 }}>
          <span style={{ fontSize: 13, color: theme.muted }}>Forgot password?</span>
        </div>

        {error && <div style={{ marginTop: 16, padding: '10px 14px', background: '#ff4444' + '20', borderRadius: 10, fontSize: 13, color: '#ff4444' }}>{error}</div>}

        <PrimaryButton label={loading ? 'Signing in…' : 'Sign In'} onPress={handleSubmit} disabled={loading} theme={theme} style={{ marginTop: 36 }} />

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: theme.muted }}>
          Don't have an account?{' '}
          <span onClick={() => navigate('/signup')} style={{ color: theme.fg, cursor: 'pointer', fontWeight: 500 }}>Sign up</span>
        </p>
      </div>
    </motion.div>
  )
}
