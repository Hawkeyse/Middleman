import { useEffect, useState } from 'react'
import { useAppState } from '../state/AppState.jsx'
import { hashPin, pinStorageKey } from '../utils/pin.js'
import PinInput, { PIN_LENGTH } from './PinInput.jsx'
import './PinGate.css'

const MAX_ATTEMPTS = 5

// A device-local "quick unlock" screen shown after a real email+password
// login already succeeded — not a second authentication factor. The PIN
// never reaches the server: only its SHA-256 hash lives in localStorage,
// scoped to this browser and this account, so even reading localStorage
// directly doesn't recover the PIN. This can only ever gate access on a
// device that's already holding a valid Firebase session; it's a privacy
// screen (stop someone glancing at an unlocked laptop), not a replacement
// for the real login. Mandatory — every account needs one, since the same
// PIN is also required again before money moves (see usePinConfirm).
function PinGate({ children }) {
  const { user, logout } = useAppState()
  const email = user.email
  const storageKey = pinStorageKey(email)
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
    setMode('setup-enter')
  }, [email, sessionKey, storageKey])

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
    if (value.length < PIN_LENGTH || busy) return

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
            <h2>Set up your PIN</h2>
            <p>Choose a 5-digit PIN. You'll use it to unlock Middleman on this device and to confirm deposits, withdrawals, and account changes.</p>
            {error && <div className="pin-gate-error">{error}</div>}
            <PinInput value={value} onChange={setValue} autoFocus />
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
