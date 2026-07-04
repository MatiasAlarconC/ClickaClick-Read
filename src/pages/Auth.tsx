import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BlobShape, BackButton, FormInput, PrimaryButton } from '../components/UI'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'

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
      <style>{`input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus,input:-webkit-autofill:active{-webkit-box-shadow:0 0 0px 1000px ${theme.bg} inset !important;-webkit-text-fill-color:${theme.fg} !important;caret-color:${theme.fg};transition:background-color 5000s ease-in-out 0s;}`}</style>
      <div style={{ position: 'absolute', top: -20, right: -50, width: 180, height: 180, pointerEvents: 'none' }}>
        <BlobShape size="medium" fill={theme.blobFill} opacity={0.35} style={{ width: '100%', height: '100%' }} />
      </div>
      <div style={{ padding: '24px 32px 48px', paddingTop: 64 }}>
        <BackButton onPress={() => navigate('/')} theme={theme} />
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 38, fontWeight: 400, color: theme.fg, lineHeight: 1.0, letterSpacing: -1.5, marginBottom: 8 }}>Create<br />Account</div>
        <div style={{ fontSize: 14, color: theme.muted, marginBottom: 44 }}>Start your reading journey today</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <FormInput label="Full Name" value={name} onChange={setName} placeholder="Matias Rodriguez" theme={theme} autoComplete="name" />
          <FormInput label="Email" type="email" value={email} onChange={setEmail} placeholder="matias@example.com" theme={theme} autoComplete="username" />
          <FormInput label="Password" type="password" value={password} onChange={setPassword} placeholder="Min. 8 characters" theme={theme} autoComplete="new-password" />
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
  const [showForgotPw, setShowForgotPw] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'newpass' | 'done'>('email')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)
  const [otpDigits, setOtpDigits] = useState<string[]>(['','','','','',''])
  const [resendCooldown, setResendCooldown] = useState(0)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')

  const handleSubmit = async () => {
    if (!email || !password) { setError('All fields required'); return }
    setLoading(true); setError(null)
    const { error: err } = await signIn(email, password)
    setLoading(false)
    if (err) { setError(err); return }
    navigate('/home')
  }

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const handleSendOtp = async () => {
    if (!forgotEmail) return
    setForgotLoading(true); setForgotError(null)
    const { error } = await supabase.auth.signInWithOtp({ email: forgotEmail, options: { shouldCreateUser: false } })
    setForgotLoading(false)
    if (error) { setForgotError(error.message); return }
    setResendCooldown(120)
    setOtpDigits(['','','','','',''])
    setForgotStep('otp')
  }

  const handleVerifyOtp = async () => {
    const code = otpDigits.join('')
    if (code.length !== 6) { setForgotError('Enter the 6-digit code'); return }
    setForgotLoading(true); setForgotError(null)
    const { error } = await supabase.auth.verifyOtp({ email: forgotEmail, token: code, type: 'email' })
    setForgotLoading(false)
    if (error) { setForgotError('Invalid code — try again'); return }
    setForgotStep('newpass')
  }

  const handleSetNewPassword = async () => {
    if (!newPassword || newPassword.length < 8) { setForgotError('At least 8 characters'); return }
    if (newPassword !== newPasswordConfirm) { setForgotError('Passwords do not match'); return }
    setForgotLoading(true); setForgotError(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setForgotLoading(false)
    if (error) { setForgotError(error.message); return }
    setForgotStep('done')
    setTimeout(() => { setShowForgotPw(false); setForgotStep('email'); setOtpDigits(['','','','','','']); setResendCooldown(0); setNewPassword(''); setNewPasswordConfirm(''); setForgotEmail('') }, 2000)
  }

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} style={{ minHeight: '100%', background: theme.bg, position: 'relative', overflow: 'hidden' }}>
      <style>{`input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus,input:-webkit-autofill:active{-webkit-box-shadow:0 0 0px 1000px ${theme.bg} inset !important;-webkit-text-fill-color:${theme.fg} !important;caret-color:${theme.fg};transition:background-color 5000s ease-in-out 0s;}`}</style>
      <div style={{ position: 'absolute', bottom: 200, left: -70, width: 200, height: 200, pointerEvents: 'none' }}>
        <BlobShape size="medium" fill={theme.blobFill} opacity={0.3} style={{ width: '100%', height: '100%' }} />
      </div>
      <div style={{ padding: '24px 32px 48px', paddingTop: 64 }}>
        <BackButton onPress={() => navigate('/')} theme={theme} />
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 38, fontWeight: 400, color: theme.fg, lineHeight: 1.0, letterSpacing: -1.5, marginBottom: 8 }}>Welcome<br />back</div>
        <div style={{ fontSize: 14, color: theme.muted, marginBottom: 44 }}>Sign in to continue reading</div>

        {!showForgotPw ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <FormInput label="Email" type="email" value={email} onChange={setEmail} placeholder="matias@example.com" theme={theme} autoComplete="username" />
              <FormInput label="Password" type="password" value={password} onChange={setPassword} placeholder="Your password" theme={theme} autoComplete="current-password" />
            </div>

            <div style={{ textAlign: 'right', marginTop: 14 }}>
              <span onClick={() => { setShowForgotPw(true); setForgotEmail(email) }} style={{ fontSize: 13, color: theme.accent, cursor: 'pointer' }}>Forgot password?</span>
            </div>

            {error && <div style={{ marginTop: 16, padding: '10px 14px', background: '#ff4444' + '20', borderRadius: 10, fontSize: 13, color: '#ff4444' }}>{error}</div>}

            <PrimaryButton label={loading ? 'Signing in…' : 'Sign In'} onPress={handleSubmit} disabled={loading} theme={theme} style={{ marginTop: 36 }} />

            <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: theme.muted }}>
              Don't have an account?{' '}
              <span onClick={() => navigate('/signup')} style={{ color: theme.fg, cursor: 'pointer', fontWeight: 500 }}>Sign up</span>
            </p>
          </>
        ) : (
          <motion.div key={forgotStep} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {forgotStep === 'email' && (
              <>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: theme.fg, marginBottom: 6 }}>Forgot password?</div>
                <div style={{ fontSize: 14, color: theme.muted, marginBottom: 28, lineHeight: 1.6 }}>
                  We'll send a 6-digit code to your email — enter it here to reset your password without leaving the app.
                </div>
                <FormInput label="Email" type="email" value={forgotEmail} onChange={e => { setForgotEmail(e); setForgotError(null) }} placeholder="matias@example.com" theme={theme} autoComplete="email" />
                {forgotError && <div style={{ marginTop: 12, fontSize: 13, color: '#ff4444' }}>{forgotError}</div>}
                <PrimaryButton label={forgotLoading ? 'Sending…' : 'Send code'} onPress={handleSendOtp} disabled={forgotLoading || !forgotEmail} theme={theme} style={{ marginTop: 28 }} />
              </>
            )}
            {forgotStep === 'otp' && (
              <>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: theme.fg, marginBottom: 6 }}>Enter code</div>
                <div style={{ fontSize: 14, color: theme.muted, marginBottom: 28, lineHeight: 1.6 }}>
                  We sent a 6-digit code to <strong style={{ color: theme.fg }}>{forgotEmail}</strong>. Check your inbox.
                </div>
                <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, display: 'block', marginBottom: 12 }}>Verification code</label>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
                  {otpDigits.map((d, i) => (
                    <input
                      key={i}
                      ref={el => { otpRefs.current[i] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={e => {
                        const v = e.target.value.replace(/[^0-9]/g, '').slice(-1)
                        const next = [...otpDigits]; next[i] = v; setOtpDigits(next); setForgotError(null)
                        if (v && i < 5) otpRefs.current[i + 1]?.focus()
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Backspace' && !otpDigits[i] && i > 0) otpRefs.current[i - 1]?.focus()
                      }}
                      onPaste={e => {
                        e.preventDefault()
                        const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6)
                        const next = [...otpDigits]
                        pasted.split('').forEach((ch, idx) => { if (idx < 6) next[idx] = ch })
                        setOtpDigits(next)
                        const focusIdx = Math.min(pasted.length, 5)
                        otpRefs.current[focusIdx]?.focus()
                      }}
                      style={{ width: 46, height: 58, background: theme.bgSecondary, border: `1.5px solid ${d ? theme.fg : theme.border}`, borderRadius: 12, fontSize: 26, fontWeight: 600, color: theme.fg, textAlign: 'center', fontFamily: 'monospace', outline: 'none', caretColor: theme.fg, transition: 'border-color 0.15s' }}
                    />
                  ))}
                </div>
                {forgotError && <div style={{ fontSize: 13, color: '#ff4444', marginTop: 8, marginBottom: 4 }}>{forgotError}</div>}
                <PrimaryButton label={forgotLoading ? 'Verifying…' : 'Verify'} onPress={handleVerifyOtp} disabled={forgotLoading || otpDigits.join('').length !== 6} theme={theme} style={{ marginTop: 20 }} />
                <button
                  onClick={resendCooldown > 0 ? undefined : handleSendOtp}
                  disabled={resendCooldown > 0 || forgotLoading}
                  style={{ marginTop: 16, background: 'none', border: 'none', color: resendCooldown > 0 ? theme.muted : theme.fg, fontSize: 13, cursor: resendCooldown > 0 ? 'default' : 'pointer', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 6, opacity: resendCooldown > 0 ? 0.6 : 1 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M12 7A5 5 0 1 1 9.5 2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <path d="M9.5 1v2.5H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {resendCooldown > 0
                    ? `Retry in ${Math.floor(resendCooldown / 60)}:${String(resendCooldown % 60).padStart(2, '0')}`
                    : 'Resend code'}
                </button>
              </>
            )}
            {forgotStep === 'newpass' && (
              <>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: theme.fg, marginBottom: 6 }}>New password</div>
                <div style={{ fontSize: 14, color: theme.muted, marginBottom: 28 }}>Choose a strong password for your account.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <FormInput label="New Password" type="password" value={newPassword} onChange={e => { setNewPassword(e); setForgotError(null) }} placeholder="At least 8 characters" theme={theme} autoComplete="new-password" />
                  <FormInput label="Confirm Password" type="password" value={newPasswordConfirm} onChange={e => { setNewPasswordConfirm(e); setForgotError(null) }} placeholder="Repeat your password" theme={theme} autoComplete="new-password" />
                </div>
                {forgotError && <div style={{ marginTop: 12, fontSize: 13, color: '#ff4444' }}>{forgotError}</div>}
                <PrimaryButton label={forgotLoading ? 'Saving…' : 'Set New Password'} onPress={handleSetNewPassword} disabled={forgotLoading || !newPassword || !newPasswordConfirm} theme={theme} style={{ marginTop: 28 }} />
              </>
            )}
            {forgotStep === 'done' && (
              <div style={{ paddingTop: 16, textAlign: 'center' }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: `${theme.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L19 7" stroke={theme.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: theme.fg, marginBottom: 6 }}>Password updated!</div>
                <div style={{ fontSize: 14, color: theme.muted }}>Signing you in…</div>
              </div>
            )}
            {forgotStep !== 'done' && (
              <button onClick={() => { setShowForgotPw(false); setForgotStep('email'); setForgotError(null); setOtpDigits(['','','','','','']); setResendCooldown(0); setNewPassword(''); setNewPasswordConfirm('') }}
                style={{ marginTop: 20, background: 'none', border: 'none', color: theme.muted, fontSize: 14, cursor: 'pointer', padding: '8px 0' }}>
                ← Back to sign in
              </button>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Reset Password ───────────────────────────────────────────────────────────
export function ResetPasswordScreen() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setSessionReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async () => {
    if (!password) { setError('Enter a new password'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true); setError(null)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => navigate('/home'), 2200)
  }

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} style={{ minHeight: '100%', background: theme.bg, position: 'relative', overflow: 'hidden' }}>
      <style>{`input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus,input:-webkit-autofill:active{-webkit-box-shadow:0 0 0px 1000px ${theme.bg} inset !important;-webkit-text-fill-color:${theme.fg} !important;caret-color:${theme.fg};transition:background-color 5000s ease-in-out 0s;}`}</style>
      <div style={{ position: 'absolute', top: -20, right: -50, width: 180, height: 180, pointerEvents: 'none' }}>
        <BlobShape size="medium" fill={theme.blobFill} opacity={0.35} style={{ width: '100%', height: '100%' }} />
      </div>
      <div style={{ padding: '24px 32px 48px', paddingTop: 64 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 38, fontWeight: 400, color: theme.fg, lineHeight: 1.0, letterSpacing: -1.5, marginBottom: 8, whiteSpace: 'pre-line' }}>
          {done ? 'Password\nupdated.' : 'New\nPassword'}
        </div>
        <div style={{ fontSize: 14, color: theme.muted, marginBottom: 44 }}>
          {done ? 'Redirecting you to the app…' : 'Choose a strong password for your account.'}
        </div>

        {done ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: `${theme.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L19 7" stroke={theme.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ fontSize: 15, color: theme.muted }}>All set!</div>
          </div>
        ) : !sessionReady ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: theme.muted, fontSize: 14 }}>
            Verifying reset link…
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <FormInput label="New Password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" theme={theme} autoComplete="new-password" />
              <FormInput label="Confirm Password" type="password" value={confirm} onChange={setConfirm} placeholder="Repeat your password" theme={theme} autoComplete="new-password" />
            </div>
            {error && <div style={{ marginTop: 16, padding: '10px 14px', background: '#ff444420', borderRadius: 10, fontSize: 13, color: '#ff4444' }}>{error}</div>}
            <PrimaryButton label={loading ? 'Updating…' : 'Set New Password'} onPress={handleSubmit} disabled={loading || !password || !confirm} theme={theme} style={{ marginTop: 36 }} />
          </>
        )}
      </div>
    </motion.div>
  )
}
