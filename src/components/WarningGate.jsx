import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { useAppState } from '../state/AppState.jsx'
import { acknowledgeWarning, completeCooldown } from '../state/users.js'
import './WarningGate.css'

function formatRemaining(ms) {
  if (ms <= 60000) return 'less than a minute'
  const mins = Math.ceil(ms / 60000)
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'}`
  const hours = Math.ceil(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.ceil(hours / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}

// Renders around any authed page (see App.jsx's RequireAuth). Three stages
// driven off users/{email}'s activeWarning (set by api/team.js's warn
// action, cleared by api/customer.js's completeCooldown):
//   'warned'   — just issued, not yet acknowledged: full block until Accept.
//   'cooldown' — acknowledged, cooldownUntil still in the future: content
//                stays usable (support chat etc.) but dimmed with a banner —
//                the actual restriction is enforced server-side, see
//                api/customer.js's assertNoActiveCooldown.
//   'notice'   — cooldown has passed: full block until "I Agree".
function WarningGate({ children }) {
  const { accountStatus, refreshAccountStatus } = useAppState()
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())
  const w = accountStatus?.activeWarning || null

  useEffect(() => {
    if (!w?.acknowledged) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [w?.acknowledged])

  if (!w) return children

  const cooldownEndsAt = w.cooldownUntil ? new Date(w.cooldownUntil).getTime() : now
  const stage = !w.acknowledged ? 'warned' : now < cooldownEndsAt ? 'cooldown' : 'notice'

  const accept = async () => {
    setBusy(true)
    try { await acknowledgeWarning() } catch { /* retried by the next poll tick regardless */ }
    await refreshAccountStatus()
    setBusy(false)
  }
  const agree = async () => {
    setBusy(true)
    try { await completeCooldown() } catch { /* if the cooldown hasn't actually ended server-side, the next poll re-syncs the real state */ }
    await refreshAccountStatus()
    setBusy(false)
  }

  return (
    <div className="warning-gate-wrap">
      <div className={stage === 'cooldown' ? 'warning-gate-content dimmed' : 'warning-gate-content blurred'}>{children}</div>

      {stage === 'cooldown' && (
        <div className="cooldown-banner">
          <Icon name="warn" size={15} />
          <span>Some actions are restricted for {formatRemaining(cooldownEndsAt - now)} — {w.reason}</span>
        </div>
      )}

      {(stage === 'warned' || stage === 'notice') && (
        <div className="warning-gate-backdrop">
          <div className="warning-gate-card">
            {stage === 'warned' ? (
              <>
                <div className="warning-gate-icon"><Icon name="warn" size={26} /></div>
                <h2>You've received a warning</h2>
                <p>{w.reason}</p>
                {w.cooldownUntil && now < cooldownEndsAt && (
                  <p className="warning-gate-cooldown-note">Some actions will be restricted for {formatRemaining(cooldownEndsAt - now)}.</p>
                )}
                <button disabled={busy} onClick={accept}>{busy ? 'Please wait…' : 'Accept'}</button>
              </>
            ) : (
              <>
                <h2>Account Notice</h2>
                <div className="warning-gate-markdown">
                  <p>Your restriction period has ended. Before you continue:</p>
                  <ul>
                    <li>Reason for the warning: {w.reason}</li>
                    <li>This warning has lowered your trust score.</li>
                    <li>Further violations may lead to a permanent ban.</li>
                  </ul>
                  <p>By continuing, you agree to keep following Middleman's Terms of Service.</p>
                </div>
                <button className="agree-button" disabled={busy} onClick={agree}>
                  <img src="/icons/agree.svg" alt="" width={16} height={16} /> {busy ? 'Please wait…' : 'I Agree'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default WarningGate
