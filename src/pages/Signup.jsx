import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Loader2, Mail, ShieldCheck } from 'lucide-react'
import Icon from '../components/Icon.jsx'
import { useAppState } from '../state/AppState.jsx'
import { useTransitionNavigate } from '../hooks/useTransitionNavigate.js'
import { signUp, resendVerification, authErrorMessage } from '../utils/auth.js'
import { claimUsername, isUsernameAvailable, normalizeUsername, suggestUsernames, usernameError } from '../state/users.js'
import './Auth.css'

const RESEND_COOLDOWN = 45
const POLL_INTERVAL = 3000

function Signup() {
  const navigate = useTransitionNavigate()
  const { setUser, refreshEmailVerified } = useAppState()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', username: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  const [usernameStatus, setUsernameStatus] = useState('idle')
  const [usernameSuggestions, setUsernameSuggestions] = useState([])
  const usernameCheckRef = useRef(0)

  const [stage, setStage] = useState('form') // 'form' | 'pending' | 'done'
  const [cooldown, setCooldown] = useState(0)
  const pollRef = useRef(null)

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  // Debounced live "is this taken" check as they type — the real guarantee
  // against a race is the transaction in claimUsername at submit time, this
  // is just fast feedback so they're not surprised later.
  useEffect(() => {
    const raw = form.username
    if (!raw) { setUsernameStatus('idle'); setUsernameSuggestions([]); return }
    if (usernameError(raw)) { setUsernameStatus('invalid'); setUsernameSuggestions([]); return }
    setUsernameStatus('checking')
    const myCheck = ++usernameCheckRef.current
    const id = window.setTimeout(async () => {
      const available = await isUsernameAvailable(raw)
      if (usernameCheckRef.current !== myCheck) return // a newer keystroke superseded this check
      setUsernameStatus(available ? 'available' : 'taken')
      if (!available) {
        const suggestions = await suggestUsernames(raw)
        if (usernameCheckRef.current === myCheck) setUsernameSuggestions(suggestions)
      } else {
        setUsernameSuggestions([])
      }
    }, 400)
    return () => window.clearTimeout(id)
  }, [form.username])

  const pickSuggestion = (name) => update('username')({ target: { value: name } })

  const goToLogin = (e) => { e.preventDefault(); navigate('/login') }

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

  // While waiting on the pending screen, keep checking whether they've clicked
  // the verification link yet, so they don't have to do anything manually.
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
    if (!form.name || !form.email || !form.phone || !form.password || !form.username) {
      setError('Fill in every field to create your account.')
      return
    }
    const unameErr = usernameError(form.username)
    if (unameErr) { setError(unameErr); return }
    if (usernameStatus === 'taken') { setError('That username is already taken.'); return }
    if (form.password.length < 6) {
      setError('Password should be at least 6 characters.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await signUp(form.name, form.email, form.password)
      setUser({ name: form.name, email: form.email, phone: form.phone })
      // Doesn't block the rest of signup if it fails (e.g. someone else won
      // the race a moment ago) — the account still exists either way, and a
      // username can be set later from Profile.
      try { await claimUsername(form.email, form.name, form.username) } catch { /* handled from Profile later */ }
      setStage('pending')
      startCooldown()
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
          <h1>Join the safe side of online trade.</h1>
          <p>Create your account to start sending or receiving protected payments, wherever you and the other side are.</p>
        </div>
        <div className="auth-quote">"I don buy things from Instagram sellers I've never met — Middleman made it feel safe for the first time." <b>— Amaka, Accra</b></div>
      </aside>

      <div className="auth-form-side">
        <div className="auth-card">
          {stage === 'done' ? (
            <div className="creating-state">
              <div className="creating-icon done"><Check size={26} /></div>
              <h2 className="creating-text">There you go!</h2>
              <div className="creating-bar"><i></i></div>
            </div>
          ) : stage === 'pending' ? (
            <>
              <button type="button" className="auth-back" onClick={() => { setStage('form'); setError('') }}><ArrowLeft size={14} /> Back</button>
              <div className="auth-code-icon"><Mail size={22} /></div>
              <h2>Check your email</h2>
              <p>We sent a verification link to <b>{form.email}</b>. Click it to confirm your account — this page will move on automatically once you do.</p>

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
              <h2>Create your account</h2>
              <p>Free to join. Takes less than a minute.</p>

              {error && <div className="auth-error">{error}</div>}

              <form onSubmit={submit}>
                <div className="auth-field"><label htmlFor="name">Full name</label><input id="name" type="text" placeholder="Amaka Owusu" value={form.name} onChange={update('name')} /></div>
                <div className="auth-field">
                  <label htmlFor="username">Username</label>
                  <div className={`auth-username-wrap ${usernameStatus}`}>
                    <span className="auth-username-at">@</span>
                    <input id="username" type="text" autoCapitalize="none" placeholder="amaka_o" value={form.username} onChange={(e) => update('username')({ target: { value: normalizeUsername(e.target.value) } })} />
                    <span className="auth-username-status">
                      {usernameStatus === 'checking' && <Loader2 size={14} className="spin" />}
                      {usernameStatus === 'available' && <Check size={14} />}
                      {usernameStatus === 'taken' && <Icon name="close" size={14} />}
                    </span>
                  </div>
                  {usernameStatus === 'taken' && (
                    <small className="auth-username-hint">
                      Already taken.{usernameSuggestions.length > 0 && <> Try: {usernameSuggestions.map((s, i) => <span key={s}>{i > 0 && ', '}<a href="#" onClick={(e) => { e.preventDefault(); pickSuggestion(s) }}>@{s}</a></span>)}</>}
                    </small>
                  )}
                  {usernameStatus === 'invalid' && form.username && <small className="auth-username-hint">3-20 characters: lowercase letters, numbers, underscores.</small>}
                  {usernameStatus === 'available' && <small className="auth-username-hint ok">It's yours.</small>}
                </div>
                <div className="auth-field"><label htmlFor="email">Email</label><input id="email" type="email" placeholder="you@example.com" value={form.email} onChange={update('email')} /></div>
                <div className="auth-field"><label htmlFor="phone">Phone number</label><input id="phone" type="tel" placeholder="+233 24 000 0000" value={form.phone} onChange={update('phone')} /></div>
                <div className="auth-field"><label htmlFor="password">Password</label><input id="password" type="password" placeholder="At least 6 characters" value={form.password} onChange={update('password')} /></div>
                <button className="auth-submit" type="submit" disabled={submitting}>
                  {submitting ? <><Loader2 size={15} className="spin" /> Creating account…</> : 'Create account'}
                </button>
                <p className="auth-terms-note">By creating an account, you agree to Middleman's <Link to="/terms">Terms of Service</Link>.</p>
              </form>

              <div className="auth-note"><ShieldCheck size={15} /> You'll verify your identity before your first deal — it only takes a minute and keeps everyone on Middleman safe.</div>
              <div className="auth-switch">Already have an account? <a href="/login" onClick={goToLogin}>Log in</a></div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Signup
