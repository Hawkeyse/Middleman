import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Banknote, Camera, Check, Loader2, LogOut, Pencil, Smartphone } from 'lucide-react'
import Icon from '../components/Icon.jsx'
import { useAppState } from '../state/AppState.jsx'
import { claimUsername, isUsernameAvailable, normalizeUsername, renameUsername, setPayoutMethod, suggestUsernames, usernameError } from '../state/users.js'
import { payoutOptionsForCountry } from '../state/payoutOptions.js'
import { listDealsFor } from '../state/deals.js'
import { calcTrustScore } from '../utils/trustScore.js'
import TrustCard from '../components/TrustCard.jsx'
import './Profile.css'

const docLabels = { 'ghana-card': 'Ghana Card', 'national-id': 'National ID Card', passport: 'International Passport', license: "Driver's License" }

function Profile() {
  const navigate = useNavigate()
  const { user, setUser, verification, verificationMeta, logout, refreshVerification, accountStatus, refreshAccountStatus } = useAppState()
  const [form, setForm] = useState(user)
  const [saved, setSaved] = useState(false)

  // Which payout options make sense depends on the seller's verified
  // country — Ghana is mobile-money-first, Nigeria is bank/fintech-account-
  // first with no equivalent telco mobile money, everyone else gets a
  // generic free-text bank field. See src/state/payoutOptions.js.
  const { momoNetworks, bankOptions } = payoutOptionsForCountry(verificationMeta?.country)
  const emptyPayout = { type: momoNetworks ? 'momo' : 'bank', network: momoNetworks?.[0] || '', accountNumber: '', accountName: '', bankName: '' }

  const payoutMethod = accountStatus?.payoutMethod || null
  const [editingPayout, setEditingPayout] = useState(false)
  const [payoutForm, setPayoutForm] = useState(payoutMethod || emptyPayout)
  const [payoutSaved, setPayoutSaved] = useState(false)

  // Claiming a username here covers accounts created before this feature
  // existed, or a signup where the claim failed (e.g. lost a naming race).
  // Once set it's shown read-only — no renames in v1 (see firestore.rules).
  const [usernameDraft, setUsernameDraft] = useState('')
  const [usernameStatus, setUsernameStatus] = useState('idle')
  const [usernameSuggestions, setUsernameSuggestions] = useState([])
  const [claimingUsername, setClaimingUsername] = useState(false)
  const [usernameSaveError, setUsernameSaveError] = useState('')
  const usernameCheckRef = useRef(0)

  useEffect(() => {
    if (!usernameDraft) { setUsernameStatus('idle'); setUsernameSuggestions([]); return }
    if (usernameError(usernameDraft)) { setUsernameStatus('invalid'); setUsernameSuggestions([]); return }
    setUsernameStatus('checking')
    const myCheck = ++usernameCheckRef.current
    const id = window.setTimeout(async () => {
      const available = await isUsernameAvailable(usernameDraft)
      if (usernameCheckRef.current !== myCheck) return
      setUsernameStatus(available ? 'available' : 'taken')
      if (!available) {
        const suggestions = await suggestUsernames(usernameDraft)
        if (usernameCheckRef.current === myCheck) setUsernameSuggestions(suggestions)
      } else {
        setUsernameSuggestions([])
      }
    }, 400)
    return () => window.clearTimeout(id)
  }, [usernameDraft, usernameCheckRef])

  const saveUsername = async (e) => {
    e.preventDefault()
    setUsernameSaveError('')
    setClaimingUsername(true)
    try {
      await claimUsername(user.email, user.name, usernameDraft)
      await refreshAccountStatus()
      setUsernameDraft('')
    } catch (err) {
      setUsernameSaveError(err.message)
    } finally {
      setClaimingUsername(false)
    }
  }

  // Renaming an already-claimed username — rate-limited to once a month
  // server-side (see api/customer.js's renameUsername); cooldownDaysLeft here is just for
  // display, the real enforcement happens on the server.
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')
  const [renameStatus, setRenameStatus] = useState('idle')
  const [renameSuggestions, setRenameSuggestions] = useState([])
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState('')
  const renameCheckRef = useRef(0)

  useEffect(() => {
    if (!renameDraft) { setRenameStatus('idle'); setRenameSuggestions([]); return }
    if (usernameError(renameDraft)) { setRenameStatus('invalid'); setRenameSuggestions([]); return }
    setRenameStatus('checking')
    const myCheck = ++renameCheckRef.current
    const id = window.setTimeout(async () => {
      const available = await isUsernameAvailable(renameDraft)
      if (renameCheckRef.current !== myCheck) return
      setRenameStatus(available ? 'available' : 'taken')
      if (!available) {
        const suggestions = await suggestUsernames(renameDraft)
        if (renameCheckRef.current === myCheck) setRenameSuggestions(suggestions)
      } else {
        setRenameSuggestions([])
      }
    }, 400)
    return () => window.clearTimeout(id)
  }, [renameDraft])

  const cooldownMsLeft = accountStatus?.lastUsernameChangeAt
    ? new Date(accountStatus.lastUsernameChangeAt).getTime() + 30 * 24 * 60 * 60 * 1000 - Date.now()
    : 0
  const cooldownDaysLeft = cooldownMsLeft > 0 ? Math.ceil(cooldownMsLeft / (24 * 60 * 60 * 1000)) : 0

  const submitRename = async () => {
    setRenameError('')
    setRenaming(true)
    try {
      await renameUsername(renameDraft)
      await refreshAccountStatus()
      setRenameDraft('')
      setRenameOpen(false)
    } catch (err) {
      setRenameError(err.message)
    } finally {
      setRenaming(false)
    }
  }

  // Same formula Dashboard uses (src/utils/trustScore.js), so the shareable
  // card below always matches what's shown live on the dashboard.
  const deals = listDealsFor(user.email)
  const completedCount = deals.filter((d) => d.status === 'released').length
  const boughtCount = deals.filter((d) => d.status === 'released' && d.buyerEmail === user.email).length
  const soldCount = deals.filter((d) => d.status === 'released' && d.sellerEmail === user.email).length
  const trustScoreTarget = calcTrustScore({ completedCount, warningsCount: accountStatus?.warnings?.length || 0 })
  const memberSince = accountStatus?.createdAt ? new Date(accountStatus.createdAt).getFullYear() : null

  // Pick up a team decision made from /team earlier in this browser session.
  useEffect(() => { refreshVerification() }, [refreshVerification])

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const updatePayout = (key) => (e) => setPayoutForm((f) => ({ ...f, [key]: e.target.value }))

  const save = (e) => {
    e.preventDefault()
    setUser(form)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  const startEditPayout = () => {
    setPayoutForm(payoutMethod || emptyPayout)
    setEditingPayout(true)
  }

  const savePayout = async (e) => {
    e.preventDefault()
    await setPayoutMethod(user.email, payoutForm)
    await refreshAccountStatus()
    setEditingPayout(false)
    setPayoutSaved(true)
    window.setTimeout(() => setPayoutSaved(false), 1800)
  }

  const signOut = () => { logout(); navigate('/') }

  return (
    <div className="profile-page">
      <header className="profile-nav">
        <Link className="profile-back" to="/dashboard"><ArrowLeft size={14} /> Back to dashboard</Link>
        <button className="profile-logout" onClick={signOut}><LogOut size={14} /> Log out</button>
      </header>

      <main className="profile-main">
        <h1>Your profile</h1>
        <p className="profile-sub">Manage your details and identity verification.</p>

        <div className="profile-grid">
          <form className="profile-card" onSubmit={save}>
            <div className="profile-avatar-row">
              <div className="profile-avatar">{(form.name || 'M')[0].toUpperCase()}</div>
              <div><b>{form.name || 'Your name'}</b><span>{accountStatus?.username ? `@${accountStatus.username}` : (form.email || 'No email yet')}</span></div>
            </div>

            {!accountStatus?.username && (
              <div className="profile-field">
                <label htmlFor="p-username">Username</label>
                <div className={`auth-username-wrap ${usernameStatus}`}>
                  <span className="auth-username-at">@</span>
                  <input id="p-username" type="text" placeholder="amaka_o" value={usernameDraft} onChange={(e) => setUsernameDraft(normalizeUsername(e.target.value))} />
                  <span className="auth-username-status">
                    {usernameStatus === 'checking' && <Loader2 size={14} className="spin" />}
                    {usernameStatus === 'available' && <Check size={14} />}
                  </span>
                </div>
                {usernameSaveError && <small className="auth-username-hint">{usernameSaveError}</small>}
                {usernameStatus === 'taken' && (
                  <small className="auth-username-hint">
                    Already taken.{usernameSuggestions.length > 0 && <> Try: {usernameSuggestions.map((s, i) => <span key={s}>{i > 0 && ', '}<a href="#" onClick={(e) => { e.preventDefault(); setUsernameDraft(s) }}>@{s}</a></span>)}</>}
                  </small>
                )}
                {usernameStatus === 'available' && (
                  <button type="button" className="profile-username-claim" onClick={saveUsername} disabled={claimingUsername}>
                    {claimingUsername ? 'Claiming…' : 'Claim @' + usernameDraft}
                  </button>
                )}
              </div>
            )}

            {accountStatus?.username && (
              <div className="profile-field">
                <label>Username</label>
                <div className="profile-username-current">
                  <span>@{accountStatus.username}</span>
                  <Link to={`/u/${accountStatus.username}`} target="_blank" className="profile-username-view">View public profile</Link>
                </div>
                {accountStatus.usernameHistory?.length > 0 && (
                  <small className="profile-username-history">Previously: {accountStatus.usernameHistory.map((h) => `@${h.username}`).join(', ')}</small>
                )}

                {!renameOpen ? (
                  <button type="button" className="profile-username-rename-toggle" onClick={() => setRenameOpen(true)} disabled={cooldownDaysLeft > 0}>
                    {cooldownDaysLeft > 0 ? `Change again in ${cooldownDaysLeft} day${cooldownDaysLeft === 1 ? '' : 's'}` : 'Change username'}
                  </button>
                ) : (
                  <div className="profile-username-rename">
                    <div className={`auth-username-wrap ${renameStatus}`}>
                      <span className="auth-username-at">@</span>
                      <input type="text" autoFocus placeholder="new_handle" value={renameDraft} onChange={(e) => setRenameDraft(normalizeUsername(e.target.value))} />
                      <span className="auth-username-status">
                        {renameStatus === 'checking' && <Loader2 size={14} className="spin" />}
                        {renameStatus === 'available' && <Check size={14} />}
                      </span>
                    </div>
                    {renameError && <small className="auth-username-hint">{renameError}</small>}
                    {renameStatus === 'taken' && (
                      <small className="auth-username-hint">
                        Already taken.{renameSuggestions.length > 0 && <> Try: {renameSuggestions.map((s, i) => <span key={s}>{i > 0 && ', '}<a href="#" onClick={(e) => { e.preventDefault(); setRenameDraft(s) }}>@{s}</a></span>)}</>}
                      </small>
                    )}
                    <div className="profile-username-rename-actions">
                      <button type="button" className="cancel-button" onClick={() => { setRenameOpen(false); setRenameDraft(''); setRenameError('') }}>Cancel</button>
                      {renameStatus === 'available' && (
                        <button type="button" className="profile-username-claim" onClick={submitRename} disabled={renaming}>
                          {renaming ? 'Saving…' : 'Save new username'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="profile-field"><label htmlFor="p-name">Full name</label><input id="p-name" value={form.name} onChange={update('name')} /></div>
            <div className="profile-field"><label htmlFor="p-email">Email</label><input id="p-email" type="email" value={form.email} onChange={update('email')} /></div>
            <div className="profile-field"><label htmlFor="p-phone">Phone number</label><input id="p-phone" type="tel" value={form.phone} onChange={update('phone')} /></div>
            <button className="profile-save" type="submit">{saved ? <><Check size={15} /> Saved</> : 'Save changes'}</button>
          </form>

          <div className="profile-card verification-card">
            <span className="section-label">IDENTITY VERIFICATION</span>

            {verification === 'verified' && (
              <>
                <div className="verify-status verified"><Icon name="verified" size={18} /> Verified</div>
                <p>You're all set — you can start and confirm deals freely.</p>
                <div className="verify-meta">
                  <div><small>DOCUMENT</small><b>{docLabels[verificationMeta?.docType] || '—'}</b></div>
                  <div><small>COUNTRY</small><b>{verificationMeta?.country || '—'}</b></div>
                  <div><small>AGE</small><b>{verificationMeta?.age ?? '—'}</b></div>
                  <div><small>VERIFIED ON</small><b>{verificationMeta?.decidedAt ? new Date(verificationMeta.decidedAt).toLocaleDateString() : '—'}</b></div>
                </div>
              </>
            )}

            {verification === 'pending' && (
              <>
                <div className="verify-status pending"><Icon name="pending" size={18} /> Pending review</div>
                <p>Your document and selfie are with our team. Please be patient — deals unlock as soon as you're approved. You can't submit again while this is pending.</p>
              </>
            )}

            {verification === 'declined' && (
              <>
                <div className="verify-status unverified"><Icon name="alarm" size={18} /> Declined</div>
                <p>{verificationMeta?.reason || 'Your documents did not pass review.'} You can fix the issue and resubmit.</p>
                <button className="profile-verify-cta" onClick={() => navigate('/verify', { state: { from: '/profile' } })}><Camera size={15} /> Try again</button>
              </>
            )}

            {verification === 'unverified' && (
              <>
                <div className="verify-status unverified"><Icon name="alarm" size={18} /> Not verified</div>
                <p>Verify your identity to unlock sending and confirming deals on Middleman.</p>
                <button className="profile-verify-cta" onClick={() => navigate('/verify', { state: { from: '/profile' } })}><Camera size={15} /> Verify identity</button>
              </>
            )}
          </div>

          <div className="profile-card trust-card-panel">
            <span className="section-label">YOUR MIDDLEMAN CARD</span>
            <p>Your trust score and deal history — download it to show off wherever you like.</p>
            <TrustCard
              name={user.name}
              trustScore={trustScoreTarget}
              boughtCount={boughtCount}
              soldCount={soldCount}
              verified={verification === 'verified'}
              memberSince={memberSince}
            />
          </div>

          <div className="profile-card payout-card">
            <span className="section-label">PAYOUT METHOD</span>
            <p>Where we send your share when a buyer releases a deal you sold. Payouts are handled manually by the team for now.</p>
            {payoutSaved && <div className="payout-saved-note"><Check size={13} /> Payout method saved</div>}

            {!editingPayout ? (
              payoutMethod ? (
                <div className="payout-current">
                  <div className="payout-icon">{payoutMethod.type === 'bank' ? <Banknote size={18} /> : <Smartphone size={18} />}</div>
                  <div>
                    <b>{payoutMethod.type === 'bank' ? payoutMethod.bankName : `${payoutMethod.network} Mobile Money`}</b>
                    <span>{payoutMethod.accountNumber}{payoutMethod.accountName ? ` · ${payoutMethod.accountName}` : ''}</span>
                  </div>
                  <button type="button" className="payout-edit" onClick={startEditPayout}><Pencil size={13} /> Edit</button>
                </div>
              ) : (
                <button type="button" className="profile-verify-cta" onClick={startEditPayout}><Smartphone size={15} /> Add payout method</button>
              )
            ) : (
              <form className="payout-form" onSubmit={savePayout}>
                {momoNetworks && (
                  <div className="payout-type-toggle">
                    <button type="button" className={payoutForm.type === 'momo' ? 'active' : ''} onClick={() => setPayoutForm((f) => ({ ...f, type: 'momo' }))}><Smartphone size={14} /> Mobile Money</button>
                    <button type="button" className={payoutForm.type === 'bank' ? 'active' : ''} onClick={() => setPayoutForm((f) => ({ ...f, type: 'bank' }))}><Banknote size={14} /> Bank Account</button>
                  </div>
                )}

                {payoutForm.type === 'momo' && momoNetworks ? (
                  <>
                    <div className="profile-field">
                      <label htmlFor="p-network">Network</label>
                      <select id="p-network" value={payoutForm.network} onChange={updatePayout('network')}>
                        {momoNetworks.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div className="profile-field"><label htmlFor="p-momo-number">Mobile money number</label><input id="p-momo-number" required value={payoutForm.accountNumber} onChange={updatePayout('accountNumber')} placeholder="024 000 0000" /></div>
                  </>
                ) : (
                  <>
                    <div className="profile-field">
                      <label htmlFor="p-bank">Bank</label>
                      {bankOptions ? (
                        <select id="p-bank" required value={payoutForm.bankName} onChange={updatePayout('bankName')}>
                          <option value="" disabled>Select your bank</option>
                          {bankOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                        </select>
                      ) : (
                        <input id="p-bank" required value={payoutForm.bankName} onChange={updatePayout('bankName')} placeholder="Bank name" />
                      )}
                    </div>
                    <div className="profile-field"><label htmlFor="p-account-number">Account number</label><input id="p-account-number" required value={payoutForm.accountNumber} onChange={updatePayout('accountNumber')} /></div>
                  </>
                )}
                <div className="profile-field"><label htmlFor="p-account-name">Account holder name</label><input id="p-account-name" required value={payoutForm.accountName} onChange={updatePayout('accountName')} placeholder="Matches your ID" /></div>

                <div className="payout-form-actions">
                  <button type="button" className="payout-cancel" onClick={() => setEditingPayout(false)}>Cancel</button>
                  <button className="profile-save" type="submit">Save payout method</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default Profile
