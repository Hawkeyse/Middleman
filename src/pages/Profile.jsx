import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, Banknote, Camera, Check, Clock, LogOut, Pencil, ShieldAlert, Smartphone } from 'lucide-react'
import { useAppState } from '../state/AppState.jsx'
import { setPayoutMethod } from '../state/users.js'
import './Profile.css'

const docLabels = { 'ghana-card': 'Ghana Card', 'national-id': 'National ID Card', passport: 'International Passport', license: "Driver's License" }
const momoNetworks = ['MTN', 'Telecel', 'AirtelTigo']
const emptyPayout = { type: 'momo', network: momoNetworks[0], accountNumber: '', accountName: '', bankName: '' }

function Profile() {
  const navigate = useNavigate()
  const { user, setUser, verification, verificationMeta, logout, refreshVerification, accountStatus, refreshAccountStatus } = useAppState()
  const [form, setForm] = useState(user)
  const [saved, setSaved] = useState(false)

  const payoutMethod = accountStatus?.payoutMethod || null
  const [editingPayout, setEditingPayout] = useState(false)
  const [payoutForm, setPayoutForm] = useState(payoutMethod || emptyPayout)
  const [payoutSaved, setPayoutSaved] = useState(false)

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

  const savePayout = (e) => {
    e.preventDefault()
    setPayoutMethod(user.email, payoutForm)
    refreshAccountStatus()
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
              <div><b>{form.name || 'Your name'}</b><span>{form.email || 'No email yet'}</span></div>
            </div>
            <div className="profile-field"><label htmlFor="p-name">Full name</label><input id="p-name" value={form.name} onChange={update('name')} /></div>
            <div className="profile-field"><label htmlFor="p-email">Email</label><input id="p-email" type="email" value={form.email} onChange={update('email')} /></div>
            <div className="profile-field"><label htmlFor="p-phone">Phone number</label><input id="p-phone" type="tel" value={form.phone} onChange={update('phone')} /></div>
            <button className="profile-save" type="submit">{saved ? <><Check size={15} /> Saved</> : 'Save changes'}</button>
          </form>

          <div className="profile-card verification-card">
            <span className="section-label">IDENTITY VERIFICATION</span>

            {verification === 'verified' && (
              <>
                <div className="verify-status verified"><BadgeCheck size={18} /> Verified</div>
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
                <div className="verify-status pending"><Clock size={18} /> Pending review</div>
                <p>Your document and selfie are with our team. Please be patient — deals unlock as soon as you're approved. You can't submit again while this is pending.</p>
              </>
            )}

            {verification === 'declined' && (
              <>
                <div className="verify-status unverified"><ShieldAlert size={18} /> Declined</div>
                <p>{verificationMeta?.reason || 'Your documents did not pass review.'} You can fix the issue and resubmit.</p>
                <button className="profile-verify-cta" onClick={() => navigate('/verify', { state: { from: '/profile' } })}><Camera size={15} /> Try again</button>
              </>
            )}

            {verification === 'unverified' && (
              <>
                <div className="verify-status unverified"><ShieldAlert size={18} /> Not verified</div>
                <p>Verify your identity to unlock sending and confirming deals on Middleman.</p>
                <button className="profile-verify-cta" onClick={() => navigate('/verify', { state: { from: '/profile' } })}><Camera size={15} /> Verify identity</button>
              </>
            )}
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
                <div className="payout-type-toggle">
                  <button type="button" className={payoutForm.type === 'momo' ? 'active' : ''} onClick={() => setPayoutForm((f) => ({ ...f, type: 'momo' }))}><Smartphone size={14} /> Mobile Money</button>
                  <button type="button" className={payoutForm.type === 'bank' ? 'active' : ''} onClick={() => setPayoutForm((f) => ({ ...f, type: 'bank' }))}><Banknote size={14} /> Bank Account</button>
                </div>

                {payoutForm.type === 'momo' ? (
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
                    <div className="profile-field"><label htmlFor="p-bank">Bank name</label><input id="p-bank" required value={payoutForm.bankName} onChange={updatePayout('bankName')} placeholder="GCB Bank" /></div>
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
