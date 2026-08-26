import { useEffect, useRef, useState } from 'react'
import { useAppState } from '../state/AppState.jsx'
import './PinGate.css'

const LENGTH = 5
const MAX_ATTEMPTS = 5

// A device-local "quick unlock" screen shown after a real email+password
// login already succeeded — not a second authentication factor. The PIN
// never reaches the server: only its SHA-256 hash lives in localStorage,
// scoped to this browser and this account, so even reading localStorage
// directly doesn't recover the PIN. This can only ever gate access on a
// device that's already holding a valid Firebase session; it's a privacy
// screen (stop someone glancing at an unlocked laptop), not a replacement
// for the real login.
async function hashPin(pin) {
  const data = new TextEncoder().encode(pin)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function PinBoxes({ value, shake }) {
  return (
    <div className={`pin-boxes${shake ? ' shake' : ''}`}>
      {Array.from({ length: LENGTH }).map((_, i) => (
        <div key={i} className={`pin-box${value[i] ? ' filled' : ''}`}>{value[i] || ''}</div>
      ))}
    </div>
  )
}

// One hidden numeric input drives all 5 boxes — far more robust than
// juggling refs/focus across five separate inputs (still handles paste,
// backspace, and a real numeric keyboard on mobile for free).
function PinInput({ value, onChange, autoFocus, shake, disabled }) {
  const inputRef = useRef(null)
  useEffect(() => { if (autoFocus) inputRef.current?.focus() }, [autoFocus])
  return (
    <div className="pin-input-wrap" onClick={() => inputRef.current?.focus()}>
      <PinBoxes value={value} shake={shake} />
      <input
        ref={inputRef}
        className="pin-hidden-input"
        type="tel"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={LENGTH}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, LENGTH))}
      />
    </div>
  )
}

function PinGate({ children }) {
  const { user, logout } = useAppState()
  const email = user.email
  const storageKey = `mm_pin_hash_${email}`
  const skipKey = `mm_pin_skip_${email}`
  const sessionKey = `mm_pin_unlocked_${email}`

  // user.email lands a beat after `authed` flips true (it's filled in by a
  // separate Firestore read in AppState), so this can't be decided once at
  // mount — it has to re-check whenever email actually becomes known.
  // 'checking' renders nothing rather than the real page in the meantime,
  // so an account that should be locked is never shown even for a flash.
  const [mode, setMode] = useState('checking')

  useEffect(() => {
    if (!email) return
    if (sessionStorage.getItem(sessionKey) === '1') { setMode('none'); return }
    if (localStorage.getItem(storageKey)) { setMode('locked'); return }
    if (localStorage.getItem(skipKey)) { setMode('none'); return }
    setMode('setup-enter')
  }, [email, sessionKey, storageKey, skipKey])
  const [value, setValue] = useState('')
  const [firstEntry, setFirstEntry] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [busy, setBusy] = useState(false)

  const fail = (message) => {
    setError(message)
    setShake(true)
    setValue('')
    window.setTimeout(() => setShake(false), 400)
  }

  useEffect(() => {
    if (value.length < LENGTH || busy) return

    if (mode === 'setup-enter') {
      setFirstEntry(value)
      setValue('')
      setMode('setup-confirm')
      return
    }

    if (mode === 'setup-confirm') {
      if (value !== firstEntry) {
        fail("Those didn't match — let's try again.")
        setFirstEntry('')
        setMode('setup-enter')
        return
      }
      setBusy(true)
      hashPin(value).then((hash) => {
        localStorage.setItem(storageKey, hash)
        sessionStorage.setItem(sessionKey, '1')
        setMode('none')
        setBusy(false)
      })
      return
    }

    if (mode === 'locked') {
      setBusy(true)
      hashPin(value).then((hash) => {
        if (hash === localStorage.getItem(storageKey)) {
          sessionStorage.setItem(sessionKey, '1')
          setMode('none')
        } else {
          const next = attempts + 1
          setAttempts(next)
          fail(next >= MAX_ATTEMPTS ? 'Too many wrong attempts.' : `Wrong PIN — ${MAX_ATTEMPTS - next} attempt${MAX_ATTEMPTS - next === 1 ? '' : 's'} left.`)
        }
        setBusy(false)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  if (mode === 'checking') return null
  if (mode === 'none') return children

  const skip = () => {
    localStorage.setItem(skipKey, '1')
    sessionStorage.setItem(sessionKey, '1')
    setMode('none')
  }

  const forgotPin = () => {
    localStorage.removeItem(storageKey)
    logout()
  }

  return (
    <div className="pin-gate-backdrop">
      <div className="pin-gate-card">
        <div className="pin-gate-mark"><img src="/middleman-logo.png" alt="" /></div>

        {mode === 'setup-enter' && (
          <>
            <h2>Set up a quick PIN</h2>
            <p>Choose a 5-digit PIN so you can unlock Middleman faster on this device next time.</p>
            {error && <div className="pin-gate-error">{error}</div>}
            <PinInput value={value} onChange={setValue} autoFocus />
            <button className="pin-skip" onClick={skip}>Skip for now</button>
          </>
        )}

        {mode === 'setup-confirm' && (
          <>
            <h2>Confirm your PIN</h2>
            <p>Enter it one more time to make sure it's right.</p>
            <PinInput value={value} onChange={setValue} autoFocus shake={shake} disabled={busy} />
          </>
        )}

        {mode === 'locked' && (
          <>
            <h2>Welcome back</h2>
            <p>Enter your PIN to continue as <b>{email}</b>.</p>
            {error && <div className="pin-gate-error">{error}</div>}
            {attempts >= MAX_ATTEMPTS ? (
              <button className="pin-forgot loud" onClick={forgotPin}>Log in with your password instead</button>
            ) : (
              <>
                <PinInput value={value} onChange={setValue} autoFocus shake={shake} disabled={busy} />
                <button className="pin-forgot" onClick={forgotPin}>Forgot PIN?</button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default PinGate
