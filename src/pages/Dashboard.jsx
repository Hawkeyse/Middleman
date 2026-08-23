import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowDownLeft, ArrowUpRight, Bell, Check, ChevronDown, CircleHelp, Copy, Flag, Grid2X2, Image as ImageIcon,
  LayoutList, Link2, LockKeyhole, Plus, Send, ShieldAlert, ShieldCheck, Sparkles, Wallet, X,
} from 'lucide-react'
import { useAppState } from '../state/AppState.jsx'
import { useChatNotify } from '../hooks/useChatNotify.js'
import { createDeal, disputeDeal, listDealsFor, releaseDeal } from '../state/deals.js'
import { logTransaction, listTransactionsFor } from '../state/transactions.js'
import SupportChat from '../components/SupportChat.jsx'
import './Dashboard.css'

function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let frame
    const start = performance.now()
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(target * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return value
}

const money = (value) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const statusLabel = { 'pending-acceptance': 'Awaiting payment', paid: 'In escrow', released: 'Completed', disputed: 'Under review', refunded: 'Refunded' }
const activityIcon = { deposit: <ArrowDownLeft size={16} />, release: <ArrowUpRight size={16} /> }

function Dashboard() {
  const navigate = useNavigate()
  const { user, verification, accountStatus } = useAppState()
  const unreadSupport = useChatNotify({ email: user.email, role: 'customer', title: 'Middleman Support' })
  const [activeTab, setActiveTab] = useState('Overview')
  const [warningDismissed, setWarningDismissed] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [released, setReleased] = useState(false)
  const [releaseTarget, setReleaseTarget] = useState(null)
  const navRefs = useRef({})
  const [pillStyle, setPillStyle] = useState({})

  const [gateOpen, setGateOpen] = useState(false)
  const [payoutGateOpen, setPayoutGateOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [newDealOpen, setNewDealOpen] = useState(false)
  const [newDealStep, setNewDealStep] = useState('form')
  const [dealForm, setDealForm] = useState({ itemName: '', amount: '', buyerContact: '', image: null })
  const [createdDeal, setCreatedDeal] = useState(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [disputeTarget, setDisputeTarget] = useState(null)
  const [disputeReason, setDisputeReason] = useState('')

  // Recomputed fresh on every render straight from localStorage (see
  // src/state/deals.js and transactions.js) so any mutation — a new deal, a
  // payment landing, a release — shows up immediately without extra plumbing.
  const deals = listDealsFor(user.email)
  const transactions = listTransactionsFor(user.email)

  const balance = transactions
    .filter((t) => t.type === 'release' && t.sellerEmail === user.email)
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const completedCount = deals.filter((d) => d.status === 'released').length
  const warningsCount = accountStatus?.warnings?.length || 0
  const trustScoreTarget = Math.max(0, Math.min(100, 80 + completedCount * 3 - warningsCount * 10))

  // The one deal most worth surfacing on the overview: a live dispute first
  // (both sides want eyes on that), then something needing the signed-in
  // user's action, otherwise the most recent thing they're part of.
  const activeDeal =
    deals.find((d) => d.status === 'disputed') ||
    deals.find((d) => d.status === 'paid' && d.buyerEmail === user.email) ||
    deals.find((d) => d.status === 'paid' && d.sellerEmail === user.email) ||
    deals.find((d) => d.status === 'pending-acceptance') ||
    deals[0] || null

  const iAmBuyer = activeDeal?.buyerEmail === user.email
  const dealAmount = useCountUp(Number(activeDeal?.amount || 0), 1300)
  const balanceCount = useCountUp(balance, 1300)
  const trustScore = useCountUp(trustScoreTarget, 1400)

  useEffect(() => {
    const el = navRefs.current[activeTab]
    if (el) setPillStyle({ transform: `translateY(${el.offsetTop}px)`, height: `${el.offsetHeight}px` })
  }, [activeTab])

  const copyId = () => {
    if (!activeDeal) return
    navigator.clipboard?.writeText(activeDeal.code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const closeModal = () => { setShowModal(false); setReleased(false); setReleaseTarget(null) }
  const openRelease = (deal) => { setReleaseTarget(deal); setShowModal(true) }
  const releaseFunds = () => {
    if (!releaseTarget) return
    const updated = releaseDeal(releaseTarget.code, user.email)
    if (!updated) return
    logTransaction({ type: 'release', dealCode: updated.code, itemName: updated.itemName, amount: updated.sellerPayout ?? updated.amount, buyerEmail: updated.buyerEmail, sellerEmail: updated.sellerEmail, counterparty: updated.sellerName })
    setReleased(true)
    window.setTimeout(closeModal, 2200)
  }

  const openDispute = (deal) => { setDisputeTarget(deal); setDisputeReason(''); setDisputeOpen(true) }
  const closeDispute = () => { setDisputeOpen(false); setDisputeTarget(null); setDisputeReason('') }
  const submitDispute = (e) => {
    e.preventDefault()
    if (!disputeTarget || !disputeReason.trim()) return
    disputeDeal(disputeTarget.code, user.email, disputeReason.trim())
    closeDispute()
  }

  // Deal-affecting actions require identity verification first.
  const requireVerified = (action) => {
    if (verification === 'verified') action()
    else setGateOpen(true)
  }

  // Selling requires a payout method on file too — otherwise a release has
  // nowhere for the team to actually send the seller's money.
  const hasPayoutMethod = !!accountStatus?.payoutMethod
  const requireSellerReady = (action) => requireVerified(() => {
    if (hasPayoutMethod) action()
    else setPayoutGateOpen(true)
  })

  const closeNewDeal = () => { setNewDealOpen(false); setNewDealStep('form'); setDealForm({ itemName: '', amount: '', buyerContact: '', image: null }); setCreatedDeal(null) }

  const handleDealImage = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setDealForm((f) => ({ ...f, image: reader.result }))
    reader.readAsDataURL(file)
  }

  const submitNewDeal = (e) => {
    e.preventDefault()
    const deal = createDeal({ ...dealForm, amount: Number(dealForm.amount), sellerName: user.name || 'A Middleman seller', sellerEmail: user.email })
    setCreatedDeal(deal)
    setNewDealStep('success')
  }

  const inviteUrl = createdDeal ? `${window.location.origin}/invite/${createdDeal.code}` : ''
  const copyInvite = () => {
    navigator.clipboard?.writeText(inviteUrl)
    setLinkCopied(true)
    window.setTimeout(() => setLinkCopied(false), 1600)
  }

  const copyActiveDealLink = () => {
    if (!activeDeal) return
    navigator.clipboard?.writeText(`${window.location.origin}/invite/${activeDeal.code}`)
    setLinkCopied(true)
    window.setTimeout(() => setLinkCopied(false), 1600)
  }

  const heroChip = !activeDeal
    ? 'No deals yet'
    : iAmBuyer && activeDeal.status === 'paid'
      ? '1 delivery to confirm'
      : activeDeal.sellerEmail === user.email && activeDeal.status === 'paid'
        ? 'Payment secured, awaiting delivery'
        : activeDeal.sellerEmail === user.email && activeDeal.status === 'pending-acceptance'
          ? 'Invite sent, awaiting payment'
          : 'All caught up'

  const heroAction = () => {
    if (!activeDeal) { requireSellerReady(() => setNewDealOpen(true)); return }
    document.getElementById('current-deal')?.scrollIntoView({ behavior: 'smooth' })
  }

  // deal-progress step index: 1 created, 2 payment protected, 3 confirm delivery, 4 released
  // (disputed/refunded both freeze at 3 — neither ever reached a real release)
  const stepIndex = !activeDeal ? 0
    : activeDeal.status === 'pending-acceptance' ? 2
    : activeDeal.status === 'released' ? 4
    : 3

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand-lockup" onClick={() => navigate('/')}><div className="brand-mark"><img src="/middleman-logo.png" alt="Middleman" /></div><div><strong>middleman</strong><span>Pay safe. Receive first</span></div></button>
        <div className="workspace-switcher"><span className="avatar avatar-blue">{(user.name || 'A')[0].toUpperCase()}</span><span><b>{user.name ? `${user.name.split(' ')[0]}'s space` : 'Your space'}</b><small>Personal workspace</small></span><ChevronDown size={15} /></div>
        <nav className="main-nav" aria-label="Main navigation">
          <div className="nav-pill" style={pillStyle}></div>
          {['Overview', 'My deals', 'Wallet', 'Contacts'].map((item, index) => <button key={item} ref={(el) => { navRefs.current[item] = el }} className={activeTab === item ? 'nav-item active' : 'nav-item'} onClick={() => setActiveTab(item)}>{index === 0 ? <Grid2X2 size={18} /> : index === 1 ? <LayoutList size={18} /> : index === 2 ? <Wallet size={18} /> : <CircleHelp size={18} />}{item}{item === 'My deals' && deals.length > 0 && <span className="nav-count">{deals.length}</span>}</button>)}
        </nav>
        <div className="sidebar-bottom">
          {verification !== 'verified' && <button className="trust-note gate-note" onClick={() => navigate('/verify', { state: { from: '/dashboard' } })}><ShieldAlert size={19} /><div><b>{verification === 'pending' ? 'Verification pending' : 'Verify your identity'}</b><span>{verification === 'pending' ? "We're reviewing your documents." : 'Required before you can deal.'}</span></div></button>}
          {verification === 'verified' && <div className="trust-note"><ShieldCheck size={19} /><div><b>Protected by design</b><span>Your money moves when you say so.</span></div></div>}
          <button className="nav-item"><CircleHelp size={18} />Help center</button>
          <Link className="profile" to="/profile"><span className="avatar avatar-orange">{(user.name || 'A')[0].toUpperCase()}</span><span><b>{user.name || 'Complete your profile'}</b><small>{user.email || 'Add your email'}</small></span><ChevronDown size={15} /></Link>
        </div>
      </aside>

      <main className="content">
        <header className="topbar"><div className="crumbs"><span>Workspace</span><span>/</span><b>{activeTab}</b></div><div className="top-actions"><button className="icon-button" aria-label="Notifications"><Bell size={19} /><i></i></button><button className="support-button" onClick={() => setSupportOpen(true)}><CircleHelp size={16} /> Support{unreadSupport > 0 && <i className="unread-dot">{unreadSupport}</i>}</button><button className="new-deal" onClick={() => requireSellerReady(() => setNewDealOpen(true))}><Plus size={17} /> New deal</button></div></header>

        {accountStatus?.status === 'warned' && !warningDismissed && <div className="warning-banner animate-in"><ShieldAlert size={16} /><span><b>Warning from the Middleman team:</b> {accountStatus.warnings[accountStatus.warnings.length - 1]?.reason}</span><button onClick={() => setWarningDismissed(true)} aria-label="Dismiss"><X size={14} /></button></div>}

        <div className="page-intro animate-in" style={{ animationDelay: '30ms' }}><div><div className="eyebrow"><Sparkles size={15} /> {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</div><h1>Good morning{user.name ? `, ${user.name.split(' ')[0]}` : ''}<span>.</span></h1><p>Keep your deals moving with confidence.</p></div><div className="balance-pill"><div className="balance-icon"><Wallet size={18} /></div><span><small>Available balance</small><b>₵ {money(balanceCount)}</b></span><ArrowUpRight size={17} /></div></div>

        {activeTab === 'Wallet' ? (
          <section className="wallet-view animate-in" style={{ animationDelay: '110ms' }}>
            <div className="section-heading"><div><div className="section-label">TRANSACTION HISTORY</div><h2>Everything that's moved</h2></div></div>
            {transactions.length === 0 ? (
              <div className="wallet-empty">No transactions yet — they'll show up here once a deal is paid into or released from escrow.</div>
            ) : (
              <div className="wallet-list">
                {transactions.map((t) => (
                  <div className="wallet-row" key={t.id}>
                    <span className={t.type === 'deposit' ? 'activity-icon blue' : 'activity-icon green'}>{activityIcon[t.type]}</span>
                    <p><b>{t.type === 'deposit' ? 'Paid into escrow' : 'Funds released'}</b><small>{t.itemName} <span>•</span> {t.counterparty} <span>•</span> {new Date(t.at).toLocaleDateString()}</small></p>
                    <strong className={t.type === 'deposit' ? 'negative' : 'positive'}>{t.type === 'deposit' ? '−' : '+'}₵ {money(t.amount)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : activeTab === 'My deals' ? (
          <section className="wallet-view animate-in" style={{ animationDelay: '110ms' }}>
            <div className="section-heading"><div><div className="section-label">YOUR DEALS</div><h2>Everything you're part of</h2></div></div>
            {deals.length === 0 ? (
              <div className="wallet-empty">No deals yet — start one and we'll create an invite link for your buyer.</div>
            ) : (
              <div className="wallet-list">
                {deals.map((d) => {
                  const buyer = d.buyerEmail === user.email
                  const counterpart = buyer ? (d.sellerName || 'Seller') : (d.buyerName || d.buyerEmail || 'Awaiting buyer')
                  const icon = d.status === 'released' ? <Check size={16} /> : d.status === 'disputed' ? <Flag size={16} /> : d.status === 'refunded' ? <ArrowUpRight size={16} /> : d.status === 'paid' ? <LockKeyhole size={16} /> : <Send size={16} />
                  const iconColor = d.status === 'released' ? 'green' : d.status === 'disputed' ? 'orange' : d.status === 'refunded' ? 'orange' : d.status === 'paid' ? 'blue' : 'orange'
                  return (
                    <div className="wallet-row" key={d.code}>
                      <span className={`activity-icon ${iconColor}`}>{icon}</span>
                      <p><b>{d.itemName}</b><small>{counterpart} <span>•</span> {d.code} <span>•</span> {new Date(d.createdAt).toLocaleDateString()}</small></p>
                      <span className={`deal-status-badge ${d.status}`}>{statusLabel[d.status]}</span>
                      {buyer && d.status === 'paid' && <button className="deal-row-action" onClick={() => requireVerified(() => openRelease(d))}>Confirm</button>}
                      {buyer && d.status === 'paid' && <button className="deal-row-action ghost" onClick={() => openDispute(d)}>Report</button>}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        ) : (
        <>
        <section className="hero-grid animate-in" style={{ animationDelay: '110ms' }}>
          <div className="hero-card"><div className="hero-copy"><span className="status-chip"><span className="pulse-dot"></span> {heroChip}</span><h2>One step closer<br /><em>to a safe delivery.</em></h2><p>{activeDeal ? 'Your payment is locked and protected. Confirm when your package arrives, and we will release it instantly.' : 'Create a deal and we\'ll hand you an invite link — your buyer pays into escrow, and the money stays locked until you both agree it\'s done.'}</p><button className="hero-cta" onClick={heroAction}>{activeDeal ? 'Review current deal' : 'Create your first deal'} <ArrowUpRight size={17} /></button></div><div className="orb orb-one"></div><div className="orb orb-two"></div>{activeDeal && <div className="hero-stamp"><LockKeyhole size={17} /><span>₵ {money(activeDeal.amount)}<br /><small>held securely</small></span></div>}</div>
          <div className="stats-card"><div className="section-label">YOUR TRUST SCORE <span>?</span></div><div className="score-row"><strong>{Math.round(trustScore)}</strong><span>/ 100</span><div className="score-ring"><ShieldCheck size={24} /></div></div><p>{trustScoreTarget >= 90 ? 'Excellent. You are building a trusted track record.' : trustScoreTarget >= 70 ? 'Good standing — keep completing deals cleanly.' : 'Complete deals without issues to raise this.'}</p><div className="mini-bars"><i style={{ height: '44%' }}></i><i style={{ height: '63%' }}></i><i style={{ height: '56%' }}></i><i style={{ height: '80%' }}></i><i className="hot" style={{ height: '96%' }}></i><i style={{ height: '72%' }}></i><i style={{ height: '86%' }}></i></div>{completedCount > 0 ? <small className="trend"><ArrowUpRight size={13} /> {completedCount} deal{completedCount === 1 ? '' : 's'} completed</small> : <small className="trend neutral">Complete a deal to start building trust.</small>}</div>
        </section>

        {activeDeal && (
        <section className="current-deal animate-in" id="current-deal" style={{ animationDelay: '190ms' }}>
          <div className="section-heading"><div><div className="section-label">{activeDeal.status === 'released' ? 'COMPLETED DEAL' : activeDeal.status === 'disputed' ? 'DISPUTED DEAL' : activeDeal.status === 'refunded' ? 'REFUNDED DEAL' : 'LIVE DEAL'}</div><h2>{activeDeal.itemName}</h2><p>{statusLabel[activeDeal.status]}</p></div><button className="more-button"><span></span><span></span><span></span></button></div>
          <div className="deal-body">
            <div className="deal-person buyer"><div className="person-avatar">{(iAmBuyer ? (activeDeal.sellerName || 'S') : (activeDeal.buyerName || activeDeal.buyerEmail || 'B'))[0].toUpperCase()}</div><div><small>{iAmBuyer ? 'YOU ARE BUYING FROM' : 'YOU ARE SELLING TO'}</small><b>{iAmBuyer ? (activeDeal.sellerName || 'Seller') : (activeDeal.buyerName || activeDeal.buyerEmail || 'Awaiting buyer')}</b>{iAmBuyer && <span>Seller <ShieldCheck size={13} /></span>}</div></div>
            <div className="deal-amount"><small>AMOUNT HELD</small><strong>₵ {money(dealAmount)}</strong><button onClick={copyId}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> {activeDeal.code}</>}</button></div>
            <div className="deal-person seller"><div className="person-avatar orange">{(iAmBuyer ? user.name : (activeDeal.buyerName || activeDeal.buyerEmail || 'A'))?.[0]?.toUpperCase() || 'A'}</div><div><small>{iAmBuyer ? 'ITEM SHIPS TO' : 'PAYMENT RELEASES TO'}</small><b>{iAmBuyer ? (user.name || 'You') : 'You'}</b></div></div>
          </div>
          <div className="deal-progress"><div className="deal-progress-fill" style={{ animationName: 'none', width: `${(stepIndex / 4) * 100}%` }}></div>
            <div className={`step ${stepIndex > 1 ? 'complete' : 'current'}`}><span>{stepIndex > 1 ? <Check size={14} /> : 1}</span><b>Deal created</b><small>{new Date(activeDeal.createdAt).toLocaleDateString()}</small></div>
            <div className={`step ${stepIndex > 2 ? 'complete' : stepIndex === 2 ? 'current' : ''}`}><span>{stepIndex > 2 ? <Check size={14} /> : 2}</span><b>Payment protected</b><small>{activeDeal.paidAt ? new Date(activeDeal.paidAt).toLocaleDateString() : 'Pending'}</small></div>
            <div className={`step ${stepIndex > 3 ? 'complete' : stepIndex === 3 ? 'current' : ''}`}><span>{stepIndex > 3 ? <Check size={14} /> : 3}</span><b>Confirm delivery</b><small>{stepIndex === 3 ? 'Up next' : ''}</small></div>
            <div className={`step ${stepIndex > 3 ? 'complete' : ''}`}><span>{stepIndex > 3 ? <Check size={14} /> : 4}</span><b>Funds released</b><small>{activeDeal.releasedAt ? new Date(activeDeal.releasedAt).toLocaleDateString() : ''}</small></div>
          </div>
          {activeDeal.status === 'disputed' && (
            <div className="deal-dispute-note"><Flag size={14} /> This deal is under review by our team{activeDeal.disputeReason ? `: "${activeDeal.disputeReason}"` : '.'} Funds stay locked until it's resolved.</div>
          )}
          {activeDeal.status === 'refunded' && (
            <div className="deal-dispute-note resolved"><ArrowUpRight size={14} /> This dispute was resolved in the buyer's favor — refunded outside the app by the team.</div>
          )}
          {iAmBuyer && activeDeal.status === 'paid' && (
            <div className="deal-action-row">
              <button className="confirm-button" onClick={() => requireVerified(() => openRelease(activeDeal))}>Confirm delivery <Check size={17} /></button>
              <button className="dispute-button" onClick={() => openDispute(activeDeal)}><Flag size={15} /> Report a problem</button>
            </div>
          )}
          {!iAmBuyer && activeDeal.status === 'paid' && <div className="deal-waiting-note"><LockKeyhole size={14} /> Waiting for {activeDeal.buyerName || 'your buyer'} to confirm delivery.</div>}
          {activeDeal.status === 'pending-acceptance' && <button className="confirm-button" onClick={copyActiveDealLink}>{linkCopied ? <><Check size={17} /> Link copied</> : <><Link2 size={17} /> Copy invite link</>}</button>}
        </section>
        )}

        <section className="bottom-grid animate-in" style={{ animationDelay: '260ms' }}>
          <div className="activity">
            <div className="section-heading"><div><div className="section-label">RECENT ACTIVITY</div><h2>Everything in one place</h2></div>{transactions.length > 0 && <button className="text-button" onClick={() => setActiveTab('Wallet')}>View all <ArrowUpRight size={15} /></button>}</div>
            <div className="activity-list">
              {transactions.length === 0 ? <div className="wallet-empty">Nothing yet — activity shows up here once a deal moves.</div> : transactions.slice(0, 3).map((t) => (
                <div key={t.id}><span className={t.type === 'deposit' ? 'activity-icon blue' : 'activity-icon green'}>{activityIcon[t.type]}</span><p><b>{t.type === 'deposit' ? 'Payment protected' : 'Funds released'}</b><small>{t.itemName} <span>•</span> {new Date(t.at).toLocaleDateString()}</small></p><strong>₵ {money(t.amount)}</strong></div>
              ))}
            </div>
          </div>
          <div className="tip-card"><div className="tip-icon"><Sparkles size={20} /></div><div><div className="section-label">MIDDLEMAN TIP</div><h3>Trust is a two-way street.</h3><p>Always keep your conversations and payments inside the deal. We have your back.</p></div></div>
        </section>
        </>)}
      </main>

      {showModal && <div className="modal-backdrop" onClick={closeModal}><div className={released ? 'modal modal-success' : 'modal'} onClick={(event) => event.stopPropagation()}>
        {released ? <>
          <div className="confetti">{Array.from({ length: 20 }).map((_, i) => <i key={i} style={{ '--x': `${Math.round(((i * 53) % 220) - 110)}px`, '--r': `${Math.round(((i * 97) % 500) - 250)}deg`, '--d': `${(0.9 + (i % 5) * 0.14).toFixed(2)}s`, left: `${8 + i * 4.3}%`, background: ['#2754ea', '#ff835d', '#20aa78', '#ffd166'][i % 4] }}></i>)}</div>
          <div className="modal-icon success"><Check size={26} /></div>
          <div className="section-label">FUNDS RELEASED</div>
          <h2>₵ {money(releaseTarget?.amount)} sent to {releaseTarget?.sellerName || 'the seller'}.</h2>
          <p>Nice one, deal complete. Your trust score just went up.</p>
        </> : <>
          <button className="modal-close" onClick={closeModal}><X size={18} /></button>
          <div className="modal-icon"><LockKeyhole size={22} /></div>
          <div className="section-label">DELIVERY CONFIRMATION</div>
          <h2>Has your package arrived safely?</h2>
          <p>Confirming delivery releases <b>₵ {money(releaseTarget?.amount)}</b> to {releaseTarget?.sellerName || 'the seller'}. This action cannot be undone.</p>
          <div className="modal-actions"><button className="cancel-button" onClick={closeModal}>Not yet</button><button className="confirm-button" onClick={releaseFunds}>Yes, release funds <Check size={17} /></button></div>
        </>}
      </div></div>}

      {gateOpen && <div className="modal-backdrop" onClick={() => setGateOpen(false)}><div className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={() => setGateOpen(false)}><X size={18} /></button>
        <div className="modal-icon gate"><ShieldAlert size={22} /></div>
        <div className="section-label">IDENTITY VERIFICATION</div>
        {verification === 'pending'
          ? <><h2>Your verification is pending</h2><p>Our team is reviewing the documents you submitted. Deals unlock automatically as soon as you're approved — please be patient.</p></>
          : verification === 'declined'
            ? <><h2>Your last verification was declined</h2><p>Fix the issue and resubmit your documents to unlock sending and confirming deals.</p></>
            : <><h2>Verify your identity first</h2><p>To keep every deal on Middleman safe, you'll need to verify who you are before you can create or confirm one. It only takes a minute.</p></>}
        <div className="modal-actions">
          <button className="cancel-button" onClick={() => setGateOpen(false)}>Not now</button>
          {verification !== 'pending' && <button className="confirm-button" onClick={() => navigate('/verify', { state: { from: '/dashboard' } })}>Verify identity <ShieldCheck size={17} /></button>}
        </div>
      </div></div>}

      {payoutGateOpen && <div className="modal-backdrop" onClick={() => setPayoutGateOpen(false)}><div className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={() => setPayoutGateOpen(false)}><X size={18} /></button>
        <div className="modal-icon gate"><Wallet size={22} /></div>
        <div className="section-label">PAYOUT METHOD</div>
        <h2>Add where you get paid first</h2>
        <p>Before you can sell on Middleman, add a mobile money number or bank account in your profile — that's where we send your money once a buyer releases a deal.</p>
        <div className="modal-actions">
          <button className="cancel-button" onClick={() => setPayoutGateOpen(false)}>Not now</button>
          <button className="confirm-button" onClick={() => navigate('/profile')}>Add payout method <Wallet size={17} /></button>
        </div>
      </div></div>}

      {disputeOpen && <div className="modal-backdrop" onClick={closeDispute}><div className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={closeDispute}><X size={18} /></button>
        <div className="modal-icon gate"><Flag size={22} /></div>
        <div className="section-label">REPORT A PROBLEM</div>
        <h2>What went wrong?</h2>
        <p>This locks the deal — no one can release these funds until our team looks into it and resolves it.</p>
        <form onSubmit={submitDispute}>
          <textarea className="dispute-textarea" required rows={4} value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="e.g. item never arrived, doesn't match what was listed, seller stopped responding…" />
          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={closeDispute}>Cancel</button>
            <button className="confirm-button" type="submit"><Flag size={16} /> Report &amp; freeze funds</button>
          </div>
        </form>
      </div></div>}

      {newDealOpen && <div className="modal-backdrop" onClick={closeNewDeal}><div className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={closeNewDeal}><X size={18} /></button>
        {newDealStep === 'form' ? <>
          <div className="modal-icon"><Plus size={22} /></div>
          <div className="section-label">NEW DEAL</div>
          <h2>What are you selling?</h2>
          <p>Fill this in and we'll create an invite link you can send your buyer.</p>
          <form className="deal-form" onSubmit={submitNewDeal}>
            <label className="deal-image-upload">
              {dealForm.image ? <img src={dealForm.image} alt="Item" /> : <><ImageIcon size={20} /><span>Add a photo</span></>}
              <input type="file" accept="image/*" onChange={handleDealImage} hidden />
            </label>
            <div className="deal-form-field"><label htmlFor="item-name">Item name</label><input id="item-name" required value={dealForm.itemName} onChange={(e) => setDealForm((f) => ({ ...f, itemName: e.target.value }))} placeholder="Wireless headphones" /></div>
            <div className="deal-form-field"><label htmlFor="item-amount">Amount (₵)</label><input id="item-amount" required type="number" min="1" step="0.01" value={dealForm.amount} onChange={(e) => setDealForm((f) => ({ ...f, amount: e.target.value }))} placeholder="4250.00" /></div>
            <div className="deal-form-field"><label htmlFor="buyer-contact">Buyer's email or phone (optional)</label><input id="buyer-contact" value={dealForm.buyerContact} onChange={(e) => setDealForm((f) => ({ ...f, buyerContact: e.target.value }))} placeholder="buyer@example.com" /></div>
            <button className="confirm-button deal-submit" type="submit">Create invite <Link2 size={16} /></button>
          </form>
        </> : <>
          <div className="modal-icon success"><Check size={22} /></div>
          <div className="section-label">INVITE READY</div>
          <h2>Send this to your buyer</h2>
          <div className="deal-preview">
            {createdDeal.image && <img src={createdDeal.image} alt={createdDeal.itemName} />}
            <div><b>{createdDeal.itemName}</b><span>₵ {money(createdDeal.amount)}</span></div>
          </div>
          <div className="invite-link-row">
            <input readOnly value={inviteUrl} onFocus={(e) => e.target.select()} />
            <button onClick={copyInvite}>{linkCopied ? <Check size={15} /> : <Copy size={15} />}</button>
          </div>
          <p className="deal-invite-note">Once your buyer accepts and pays, the money is held safe with Middleman until you ship and they confirm delivery.</p>
          <button className="confirm-button deal-submit" onClick={closeNewDeal}>Done</button>
        </>}
      </div></div>}

      {supportOpen && <SupportChat email={user.email} name={user.name} onClose={() => setSupportOpen(false)} />}
    </div>
  )
}

export default Dashboard
