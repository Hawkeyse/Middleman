import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Mail } from 'lucide-react'
import { requestPasswordReset, authErrorMessage } from '../utils/auth.js'
import './Auth.css'

function ForgotPassword() {
  const [stage, setStage] = useState('email') // 'email' | 'sent'
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const sendCode = async (e) => {
    e.preventDefault()
    if (!email) { setError('Enter your email.'); return }
    setError('')
    setSubmitting(true)
    try {
      await requestPasswordReset(email)
      setStage('sent')
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
          {stage === 'sent' ? (
            <>
              <div className="auth-code-icon"><Mail size={22} /></div>
              <h2>Check your email</h2>
              <p>If an account exists for <b>{email}</b>, we've sent a link to reset your password. Open it and follow the steps there.</p>
              <div className="auth-switch">Remembered it? <Link to="/login">Log in</Link></div>
            </>
          ) : (
            <>
              <Link className="auth-back" to="/login"><ArrowLeft size={14} /> Back to login</Link>
              <h2>Forgot your password?</h2>
              <p>Enter the email on your account and we'll send you a link to reset it.</p>

              {error && <div className="auth-error">{error}</div>}

              <form onSubmit={sendCode}>
                <div className="auth-field"><label htmlFor="email">Email</label><input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <button className="auth-submit" type="submit" disabled={submitting}>
                  {submitting ? <><Loader2 size={15} className="spin" /> Sending…</> : 'Send reset link'}
                </button>
              </form>

              <div className="auth-switch">Remembered it? <Link to="/login">Log in</Link></div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
