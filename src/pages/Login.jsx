import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Loader2, Mail } from 'lucide-react'
import { useAppState } from '../state/AppState.jsx'
import { useTransitionNavigate } from '../hooks/useTransitionNavigate.js'
import { signIn, resendVerification, authErrorMessage } from '../utils/auth.js'
import './Auth.css'

const RESEND_COOLDOWN = 45
const POLL_INTERVAL = 3000

function Login() {
  const navigate = useTransitionNavigate()
  const { refreshEmailVerified } = useAppState()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [stage, setStage] = useState('form') // 'form' | 'pending' | 'done'
  const [cooldown, setCooldown] = useState(0)
  const pollRef = useRef(null)

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const goToSignup = (e) => { e.preventDefault(); navigate('/signup') }

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN)
    const id = window.setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { window.clearInterval(id); return 0 }
        return c - 1
      })
    }, 1000)
  }

  const finish = () => {
    setStage('done')
    window.setTimeout(() => navigate('/dashboard'), 900)
  }

  useEffect(() => {
    if (stage !== 'pending') return
    pollRef.current = window.setInterval(async () => {
      const verified = await refreshEmailVerified()
      if (verified) {
        window.clearInterval(pollRef.current)
        finish()
      }
    }, POLL_INTERVAL)
    return () => window.clearInterval(pollRef.current)
  }, [stage])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      setError('Enter your email and password to log in.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const fu = await signIn(form.email, form.password)
      if (fu.emailVerified) finish()
      else setStage('pending')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const checkNow = async () => {
    setError('')
    setSubmitting(true)
    try {
      const verified = await refreshEmailVerified()
      if (verified) finish()
      else setError("Still not verified — click the link in the email we sent you first.")
    } finally {
      setSubmitting(false)
    }
  }

  const resend = async () => {
    if (cooldown > 0) return
    setError('')
    try {
      await resendVerification()
      startCooldown()
    } catch (err) {
      setError(authErrorMessage(err))
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <div className="auth-brand-bg" aria-hidden="true"></div>
        <div className="auth-brand-scrim" aria-hidden="true"></div>
        <div className="auth-brand-top"><img src="/middleman-logo.png" alt="Middleman" /><span>middleman</span></div>
        <div className="auth-brand-mid">
          <h1>Pay safe.<br />Receive first.</h1>
          <p>Your deals, your money, held safe until both sides are happy.</p>
        </div>
        <div className="auth-quote">"No wahala since I started using Middleman for my customers." <b>— Chinedu, Lagos</b></div>
      </aside>

      <div className="auth-form-side">
        <div className="auth-card">
          {stage === 'done' ? (
            <div className="creating-state">
              <div className="creating-icon done"><Check size={26} /></div>
              <h2 className="creating-text">Welcome back!</h2>
              <div className="creating-bar"><i></i></div>
            </div>
          ) : stage === 'pending' ? (
            <>
              <button type="button" className="auth-back" onClick={() => { setStage('form'); setError('') }}><ArrowLeft size={14} /> Back</button>
              <div className="auth-code-icon"><Mail size={22} /></div>
              <h2>Verify your email</h2>
              <p>Your email isn't verified yet — we sent a link to <b>{form.email}</b>. Click it, then come back here.</p>

              {error && <div className="auth-error">{error}</div>}

              <button className="auth-submit" type="button" onClick={checkNow} disabled={submitting}>
                {submitting ? <><Loader2 size={15} className="spin" /> Checking…</> : "I've clicked the link"}
              </button>

              <div className="auth-switch">
                Didn't get it?{' '}
                {cooldown > 0
                  ? <span>Resend in {cooldown}s</span>
                  : <a href="#" onClick={(e) => { e.preventDefault(); resend() }}>Resend email</a>}
              </div>
            </>
          ) : (
            <>
              <Link className="auth-back" to="/"><ArrowLeft size={14} /> Back to home</Link>
              <h2>Welcome back</h2>
              <p>Log in to check on your deals.</p>

              {error && <div className="auth-error">{error}</div>}

              <form onSubmit={submit}>
                <div className="auth-field"><label htmlFor="email">Email</label><input id="email" type="email" placeholder="you@example.com" value={form.email} onChange={update('email')} /></div>
                <div className="auth-field">
                  <label htmlFor="password">Password</label>
                  <input id="password" type="password" placeholder="Your password" value={form.password} onChange={update('password')} />
                  <Link className="auth-forgot-link" to="/forgot-password">Forgot password?</Link>
                </div>
                <button className="auth-submit" type="submit" disabled={submitting}>
                  {submitting ? <><Loader2 size={15} className="spin" /> Signing you in…</> : 'Log in'}
                </button>
              </form>

              <div className="auth-switch">New to Middleman? <a href="/signup" onClick={goToSignup}>Create an account</a></div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
