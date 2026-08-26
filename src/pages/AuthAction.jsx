import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Loader2 } from 'lucide-react'
import { verifyResetCode, confirmReset, verifyEmailCode, authErrorMessage } from '../utils/auth.js'
import './Auth.css'

// Where the branded verify-email / reset-password emails link to (instead
// of Firebase's own generic hosted action-handler page) — see
// api/auth-email.js's handleCodeInApp.
function AuthAction() {
  const [params] = useSearchParams()
  const mode = params.get('mode')
  const oobCode = params.get('oobCode')

  const [stage, setStage] = useState('loading') // 'loading' | 'reset-form' | 'reset-done' | 'verify-done' | 'error'
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!oobCode || !mode) { setStage('error'); setError('This link is missing information — it may be incomplete or corrupted.'); return }

    if (mode === 'resetPassword') {
      verifyResetCode(oobCode)
        .then((resolvedEmail) => { setEmail(resolvedEmail); setStage('reset-form') })
        .catch((err) => { setStage('error'); setError(authErrorMessage(err)) })
    } else if (mode === 'verifyEmail') {
      verifyEmailCode(oobCode)
        .then(() => setStage('verify-done'))
        .catch((err) => { setStage('error'); setError(authErrorMessage(err)) })
    } else {
      setStage('error')
      setError("This link isn't recognized.")
    }
  }, [mode, oobCode])

  const submitReset = async (e) => {
    e.preventDefault()
    if (!form.password || form.password.length < 6) { setError('Password should be at least 6 characters.'); return }
    if (form.password !== form.confirm) { setError("Passwords don't match."); return }
    setError('')
    setSubmitting(true)
    try {
      await confirmReset(oobCode, form.password)
      setStage('reset-done')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setSubmitting(false)
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
          {stage === 'loading' && (
            <div className="creating-state">
              <Loader2 size={26} className="spin" />
              <h2 className="creating-text">Checking your link…</h2>
            </div>
          )}

          {stage === 'error' && (
            <>
              <h2>Link didn't work</h2>
              <p>{error}</p>
              <div className="auth-switch">
                <Link to="/forgot-password">Request a new reset link</Link> or <Link to="/login">back to login</Link>
              </div>
            </>
          )}

          {stage === 'verify-done' && (
            <div className="creating-state">
              <div className="creating-icon done"><Check size={26} /></div>
              <h2 className="creating-text">Email verified!</h2>
              <p>You're all set.</p>
              <div className="auth-switch"><Link to="/login">Continue to login</Link></div>
            </div>
          )}

          {stage === 'reset-form' && (
            <>
              <h2>Set a new password</h2>
              <p>Choose a new password for <b>{email}</b>.</p>

              {error && <div className="auth-error">{error}</div>}

              <form onSubmit={submitReset}>
                <div className="auth-field"><label htmlFor="password">New password</label><input id="password" type="password" placeholder="At least 6 characters" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} /></div>
                <div className="auth-field"><label htmlFor="confirm">Confirm password</label><input id="confirm" type="password" placeholder="Type it again" value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} /></div>
                <button className="auth-submit" type="submit" disabled={submitting}>
                  {submitting ? <><Loader2 size={15} className="spin" /> Saving…</> : 'Save new password'}
                </button>
              </form>
            </>
          )}

          {stage === 'reset-done' && (
            <div className="creating-state">
              <div className="creating-icon done"><Check size={26} /></div>
              <h2 className="creating-text">Password updated!</h2>
              <div className="auth-switch"><Link to="/login">Continue to login</Link></div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AuthAction
