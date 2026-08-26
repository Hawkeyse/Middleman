import { useEffect, useState } from 'react'
import { useAppState } from '../state/AppState.jsx'
import { verifyPin } from '../utils/pin.js'
import PinInput, { PIN_LENGTH } from './PinInput.jsx'
import './PinGate.css'

const MAX_ATTEMPTS = 5

// Re-confirms the PIN right before a sensitive action (deposit, withdrawal,
// password change) actually fires — even on a device that's already
// unlocked. Being logged into an unattended device shouldn't be enough on
// its own to move money; this is the step-up check that stops that.
function PinConfirmModal({ email, onSuccess, onCancel }) {
  const { logout } = useAppState()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (value.length < PIN_LENGTH || busy) return
    setBusy(true)
    verifyPin(email, value).then((ok) => {
      if (ok) { onSuccess(); return }
      const next = attempts + 1
      setAttempts(next)
      setError(next >= MAX_ATTEMPTS ? 'Too many wrong attempts.' : `Wrong PIN — ${MAX_ATTEMPTS - next} attempt${MAX_ATTEMPTS - next === 1 ? '' : 's'} left.`)
      setShake(true)
      setValue('')
      window.setTimeout(() => setShake(false), 400)
      setBusy(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className="pin-gate-backdrop">
      <div className="pin-gate-card">
        <div className="pin-gate-mark"><img src="/middleman-logo.png" alt="" /></div>
        <h2>Confirm your PIN</h2>
        <p>Enter your PIN to continue.</p>
        {error && <div className="pin-gate-error">{error}</div>}
        {attempts >= MAX_ATTEMPTS ? (
          <button className="pin-forgot loud" onClick={logout}>Log in with your password instead</button>
        ) : (
          <>
            <PinInput value={value} onChange={setValue} autoFocus shake={shake} disabled={busy} />
            <button className="pin-skip" onClick={onCancel}>Cancel</button>
          </>
        )}
      </div>
    </div>
  )
}

export default PinConfirmModal
