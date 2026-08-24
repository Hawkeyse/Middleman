import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowDownLeft, ArrowUpRight, Bell, Check, ChevronDown, CircleHelp, Copy, Flag, Image as ImageIcon,
  Link2, LockKeyhole, Loader2, Plus, Send, ShieldCheck, Sparkles,
} from 'lucide-react'
import Icon from '../components/Icon.jsx'
import { useAppState } from '../state/AppState.jsx'
import { useChatNotify } from '../hooks/useChatNotify.js'
import { cancelDeal, createDeal, disputeDeal, listDealsFor, releaseDeal } from '../state/deals.js'
import { listTransactionsFor } from '../state/transactions.js'
import { creditDeposit, getWalletBalance, requestRefund } from '../state/wallet.js'
import { requestPayout } from '../state/payoutRequests.js'
import { payWithProvider, verifyProviderPayment } from '../utils/payments.js'
import { CURRENCIES, money, symbolFor } from '../utils/currencies.js'
import { calcTrustScore } from '../utils/trustScore.js'
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

const statusLabel = { 'pending-acceptance': 'Awaiting payment', paid: 'In escrow', released: 'Completed', disputed: 'Under review', refunded: 'Refunded', cancelled: 'Cancelled' }
const activityIcon = { deposit: <ArrowDownLeft size={16} />, release: <ArrowUpRight size={16} />, payout: <ArrowUpRight size={16} /> }
const activityLabel = { deposit: 'Paid into escrow', release: 'Funds released', payout: 'Payout sent' }

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
  const [dealForm, setDealForm] = useState({ itemName: '', amount: '', currency: 'GHS', buyerContact: '', image: null })
  const [createdDeal, setCreatedDeal] = useState(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [disputeTarget, setDisputeTarget] = useState(null)
  const [disputeReason, setDisputeReason] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null)

  // Buyer vs seller is a view/mode toggle, not a separate account — anyone
  // can do both. Selling shows the existing create-a-deal flow; buying shows
  // the wallet you fund and spend from when accepting invites.
  const [mode, setMode] = useState('seller')
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef(null)
  const [depositOpen, setDepositOpen] = useState(false)
  const [depositForm, setDepositForm] = useState({ currency: 'GHS', amount: '' })
  const [depositing, setDepositing] = useState(false)
  const [depositError, setDepositError] = useState('')
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundForm, setRefundForm] = useState({ currency: 'GHS', amount: '', note: '' })
  const [refundError, setRefundError] = useState('')
  const [refundSent, setRefundSent] = useState(false)
  const [payoutRequestOpen, setPayoutRequestOpen] = useState(false)
  const [payoutRequestForm, setPayoutRequestForm] = useState({ currency: 'GHS', amount: '', note: '' })
  const [payoutRequestError, setPayoutRequestError] = useState('')
  const [payoutRequestSent, setPayoutRequestSent] = useState(false)

  // Firestore-backed now (see src/state/deals.js, transactions.js, wallet.js)
  // so it's loaded async and re-polled, not read straight off the render —
  // the whole point is that this now stays in sync across devices, not just
  // across components on this one page. Any action that mutates something
  // (release, cancel, dispute, deposit, refund, payout, new deal) calls
  // loadData() itself afterward so it doesn't wait for the next poll tick.
  const [deals, setDeals] = useState([])
  const [transactions, setTransactions] = useState([])
  const [walletBalances, setWalletBalances] = useState({ GHS: 0, NGN: 0, USD: 0 })

  const loadData = useCallback(async () => {
    if (!user.email) return
    const [d, t, ghs, ngn, usd] = await Promise.all([
      listDealsFor(user.email), listTransactionsFor(user.email),
      getWalletBalance(user.email, 'GHS'), getWalletBalance(user.email, 'NGN'), getWalletBalance(user.email, 'USD'),
    ])
    setDeals(d)
    setTransactions(t)
    setWalletBalances({ GHS: ghs, NGN: ngn, USD: usd })
  }, [user.email])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    const id = window.setInterval(loadData, 4000)
    return () => window.clearInterval(id)
  }, [loadData])

  // Balances are tracked per currency — summing dollars and cedis into one
  // number would be meaningless. CURRENCIES has a fixed set, so calling
  // useCountUp a fixed number of times below stays rules-of-hooks-safe.
  const balances = { GHS: 0, NGN: 0, USD: 0 }
  for (const t of transactions) {
    if (t.sellerEmail !== user.email) continue
    const cur = t.currency || 'GHS'
    if (t.type === 'release') balances[cur] = (balances[cur] || 0) + Number(t.amount)
    else if (t.type === 'payout') balances[cur] = (balances[cur] || 0) - Number(t.amount)
  }

  const completedCount = deals.filter((d) => d.status === 'released').length
  const warningsCount = accountStatus?.warnings?.length || 0
  const trustScoreTarget = calcTrustScore({ completedCount, warningsCount })

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
  const balanceGHS = useCountUp(balances.GHS, 1300)
  const balanceNGN = useCountUp(balances.NGN, 1300)
  const balanceUSD = useCountUp(balances.USD, 1300)
  const balanceDisplay = Object.entries(CURRENCIES)
    .map(([cur]) => [cur, { GHS: balanceGHS, NGN: balanceNGN, USD: balanceUSD }[cur]])
    .filter(([cur]) => balances[cur] > 0)
    .map(([cur, val]) => `${symbolFor(cur)} ${money(val)}`)
    .join(' · ') || '₵ 0.00'
  const walletGHS = useCountUp(walletBalances.GHS, 1300)
  const walletNGN = useCountUp(walletBalances.NGN, 1300)
  const walletUSD = useCountUp(walletBalances.USD, 1300)
  const walletBalanceDisplay = Object.entries(CURRENCIES)
    .map(([cur]) => [cur, { GHS: walletGHS, NGN: walletNGN, USD: walletUSD }[cur]])
    .filter(([cur]) => walletBalances[cur] > 0)
    .map(([cur, val]) => `${symbolFor(cur)} ${money(val)}`)
    .join(' · ') || '₵ 0.00'
  const trustScore = useCountUp(trustScoreTarget, 1400)

  useEffect(() => {
    const el = navRefs.current[activeTab]
    if (el) setPillStyle({ transform: `translateY(${el.offsetTop}px)`, height: `${el.offsetHeight}px` })
  }, [activeTab])

  useEffect(() => {
    if (!notifOpen) return
    // A plain "close on any click" listener fires on its own opening click —
    // the effect attaches it while that same native click is still bubbling
    // (past this component) up to window, so it immediately self-closes.
    // Checking containment instead of just closing unconditionally fixes it:
    // the bell button is inside notifRef, so its own click is correctly
    // treated as "inside" and ignored.
    const close = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false) }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [notifOpen])

  const copyId = () => {
    if (!activeDeal) return
    navigator.clipboard?.writeText(activeDeal.code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const closeModal = () => { setShowModal(false); setReleased(false); setReleaseTarget(null) }
  const openRelease = (deal) => { setReleaseTarget(deal); setShowModal(true) }
  const [releaseError, setReleaseError] = useState('')
  const releaseFunds = async () => {
    if (!releaseTarget) return
    setReleaseError('')
    try {
      await releaseDeal(releaseTarget.code)
      setReleased(true)
      await loadData()
      window.setTimeout(closeModal, 2200)
    } catch (err) {
      setReleaseError(err.message || 'Could not release funds. Please try again.')
    }
  }

  const openCancel = (deal) => setCancelTarget(deal)
  const closeCancel = () => setCancelTarget(null)
  const confirmCancel = async () => {
    if (!cancelTarget) return
    await cancelDeal(cancelTarget.code, user.email)
    closeCancel()
    loadData()
  }

  const openDispute = (deal) => { setDisputeTarget(deal); setDisputeReason(''); setDisputeOpen(true) }
  const closeDispute = () => { setDisputeOpen(false); setDisputeTarget(null); setDisputeReason('') }
  const submitDispute = async (e) => {
    e.preventDefault()
    if (!disputeTarget || !disputeReason.trim()) return
    await disputeDeal(disputeTarget.code, user.email, disputeReason.trim())
    closeDispute()
    loadData()
  }

  const openDeposit = () => { setDepositForm({ currency: 'GHS', amount: '' }); setDepositError(''); setDepositOpen(true) }
  const closeDeposit = () => { if (!depositing) setDepositOpen(false) }
  const submitDeposit = async (e) => {
    e.preventDefault()
    setDepositError('')
    setDepositing(true)
    try {
      const { provider, reference } = await payWithProvider({
        email: user.email, amount: Number(depositForm.amount), currency: depositForm.currency,
        dealCode: `WALLET-${Date.now().toString(36).toUpperCase()}`,
      })
      const verified = await verifyProviderPayment(provider, reference)
      if (verified.status !== 'success') throw new Error('Payment was not successful. No funds were moved.')
      await creditDeposit(provider, reference)
      await loadData()
      setDepositOpen(false)
    } catch (err) {
      setDepositError(err.message || 'Deposit failed. Please try again.')
    } finally {
      setDepositing(false)
    }
  }

  const openRefund = () => { setRefundForm({ currency: 'GHS', amount: '', note: '' }); setRefundError(''); setRefundSent(false); setRefundOpen(true) }
  const submitRefund = async (e) => {
    e.preventDefault()
    const amt = Number(refundForm.amount)
    const available = walletBalances[refundForm.currency] || 0
    if (!amt || amt <= 0) { setRefundError('Enter an amount.'); return }
    if (amt > available) { setRefundError(`You only have ${symbolFor(refundForm.currency)} ${money(available)} available.`); return }
    try {
      await requestRefund({ amount: amt, currency: refundForm.currency, note: refundForm.note })
      setRefundError('')
      setRefundSent(true)
      loadData()
    } catch (err) {
      setRefundError(err.message || 'Could not request a refund. Please try again.')
    }
  }

  const openPayoutRequest = () => { setPayoutRequestForm({ currency: 'GHS', amount: '', note: '' }); setPayoutRequestError(''); setPayoutRequestSent(false); setPayoutRequestOpen(true) }
  const submitPayoutRequest = async (e) => {
    e.preventDefault()
    const amt = Number(payoutRequestForm.amount)
    const available = balances[payoutRequestForm.currency] || 0
    if (!amt || amt <= 0) { setPayoutRequestError('Enter an amount.'); return }
    if (amt > available) { setPayoutRequestError(`You only have ${symbolFor(payoutRequestForm.currency)} ${money(available)} available.`); return }
    if (!hasPayoutMethod) { setPayoutRequestError('Add a payout method in your profile first.'); return }
    try {
      await requestPayout({ amount: amt, currency: payoutRequestForm.currency, note: payoutRequestForm.note })
      setPayoutRequestError('')
      setPayoutRequestSent(true)
      loadData()
    } catch (err) {
      setPayoutRequestError(err.message || 'Could not request a payout. Please try again.')
    }
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

  const closeNewDeal = () => { setNewDealOpen(false); setNewDealStep('form'); setDealForm({ itemName: '', amount: '', currency: 'GHS', buyerContact: '', image: null }); setCreatedDeal(null) }

  const handleDealImage = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setDealForm((f) => ({ ...f, image: reader.result }))
    reader.readAsDataURL(file)
  }

  const submitNewDeal = async (e) => {
    e.preventDefault()
    const deal = await createDeal({ ...dealForm, amount: Number(dealForm.amount), sellerName: user.name || 'A Middleman seller', sellerEmail: user.email })
    setCreatedDeal(deal)
    setNewDealStep('success')
    loadData()
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
    if (!activeDeal) {
      if (mode === 'buyer') requireVerified(openDeposit)
      else requireSellerReady(() => setNewDealOpen(true))
      return
    }
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
        <button className="brand-lockup" onClick={() => navigate('/dashboard')}><div className="brand-mark"><img src="/middleman-logo.png" alt="Middleman" /></div><div><strong>middleman</strong><span>Pay safe. Receive first</span></div></button>
        <div className="workspace-switcher"><span className="avatar avatar-blue">{(user.name || 'A')[0].toUpperCase()}</span><span><b>{user.name ? `${user.name.split(' ')[0]}'s space` : 'Your space'}</b><small>Personal workspace</small></span><ChevronDown size={15} /></div>
        <div className="mode-toggle">
          <button className={mode === 'seller' ? 'active' : ''} onClick={() => setMode('seller')}><Icon name="selling" size={14} /> Selling</button>
          <button className={mode === 'buyer' ? 'active' : ''} onClick={() => setMode('buyer')}><Icon name="buying" size={14} /> Buying</button>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          <div className="nav-pill" style={pillStyle}></div>
          {['Overview', 'My deals', 'Wallet', 'Contacts'].map((item, index) => <button key={item} ref={(el) => { navRefs.current[item] = el }} className={activeTab === item ? 'nav-item active' : 'nav-item'} onClick={() => setActiveTab(item)}>{index === 0 ? <Icon name="dashboard" size={18} /> : index === 1 ? <Icon name="agreement" size={18} /> : index === 2 ? <Icon name="wallet" size={18} /> : <CircleHelp size={18} />}{item}{item === 'My deals' && deals.length > 0 && <span className="nav-count">{deals.length}</span>}</button>)}
        </nav>
        <div className="sidebar-bottom">
          {verification !== 'verified' && <button className="trust-note gate-note" onClick={() => navigate('/verify', { state: { from: '/dashboard' } })}><Icon name={verification === 'pending' ? 'pending' : 'alarm'} size={19} /><div><b>{verification === 'pending' ? 'Verification pending' : 'Verify your identity'}</b><span>{verification === 'pending' ? "We're reviewing your documents." : 'Required before you can deal.'}</span></div></button>}
          {verification === 'verified' && <div className="trust-note"><Icon name="verified" size={19} /><div><b>Protected by design</b><span>Your money moves when you say so.</span></div></div>}
          <button className="nav-item" onClick={() => setSupportOpen(true)}><Icon name="support" size={18} />Help center</button>
          <Link className="profile" to="/profile"><span className="avatar avatar-orange">{(user.name || 'A')[0].toUpperCase()}</span><span><b>{user.name || 'Complete your profile'}</b><small>{user.email || 'Add your email'}</small></span><ChevronDown size={15} /></Link>
        </div>
      </aside>

      <main className="content">
        <header className="topbar"><div className="crumbs"><span>Workspace</span><span>/</span><b>{activeTab}</b></div><div className="top-actions"><div className="notif-wrap" ref={notifRef}><button className="icon-button" aria-label="Notifications" onClick={() => setNotifOpen((o) => !o)}><Bell size={19} /><i></i></button>{notifOpen && (
          <div className="notif-panel" onClick={(e) => e.stopPropagation()}>
            <div className="notif-panel-head"><b>Notifications</b><button onClick={() => setNotifOpen(false)} aria-label="Close"><Icon name="close" size={14} /></button></div>
            <div className="notif-panel-body">
              <h4>Middleman is currently under development</h4>
              <p>Please note that our payment and account registration systems are still under development. We'll notify you once Middleman is fully launched and ready to use.</p>
              <p>Thank you for checking in and for your interest in Middleman!</p>
            </div>
          </div>
        )}</div><Link className="icon-button mobile-profile-link" to="/profile" aria-label="Profile"><Icon name="profile" size={19} /></Link><button className="support-button" onClick={() => setSupportOpen(true)}><Icon name="support" size={16} /> <span className="support-button-label">Support</span>{unreadSupport > 0 && <i className="unread-dot">{unreadSupport}</i>}</button>{mode === 'buyer' ? <button className="new-deal" onClick={() => requireVerified(openDeposit)}><Icon name="wallet" size={17} /> Deposit funds</button> : <button className="new-deal" onClick={() => requireSellerReady(() => setNewDealOpen(true))}><Plus size={17} /> New deal</button>}</div></header>

        {accountStatus?.status === 'warned' && !warningDismissed && <div className="warning-banner animate-in"><Icon name="alarm" size={16} /><span><b>Warning from the Middleman team:</b> {accountStatus.warnings[accountStatus.warnings.length - 1]?.reason}</span><button onClick={() => setWarningDismissed(true)} aria-label="Dismiss"><Icon name="close" size={14} /></button></div>}

        <div className="page-intro animate-in" style={{ animationDelay: '30ms' }}><div><div className="eyebrow"><Sparkles size={15} /> {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</div><h1>Good morning{user.name ? `, ${user.name.split(' ')[0]}` : ''}<span>.</span></h1><p>Keep your deals moving with confidence.</p></div><div className="balance-pill"><div className="balance-icon"><Icon name="wallet" size={18} /></div><span><small>{mode === 'buyer' ? 'Wallet balance' : 'Available balance'}</small><b>{mode === 'buyer' ? walletBalanceDisplay : balanceDisplay}</b></span>{mode === 'buyer' ? <button className="wallet-refund-link" title="Request a refund" onClick={() => requireVerified(openRefund)}><Icon name="refund" size={15} /></button> : <button className="wallet-refund-link" title="Request payout" onClick={() => requireVerified(openPayoutRequest)}><Icon name="refund" size={15} /></button>}</div></div>

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
                    <p><b>{activityLabel[t.type] || t.type}</b><small>{t.itemName} <span>•</span> {t.counterparty} <span>•</span> {new Date(t.at).toLocaleDateString()}</small></p>
                    <strong className={t.type === 'release' ? 'positive' : 'negative'}>{t.type === 'release' ? '+' : '−'}{symbolFor(t.currency)} {money(t.amount)}</strong>
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
                  const seller = d.sellerEmail === user.email
                  const counterpart = buyer ? (d.sellerName || 'Seller') : (d.buyerName || d.buyerEmail || 'Awaiting buyer')
                  const icon = d.status === 'released' ? <Check size={16} /> : d.status === 'disputed' ? <Flag size={16} /> : d.status === 'refunded' ? <ArrowUpRight size={16} /> : d.status === 'cancelled' ? <Icon name="close" size={16} /> : d.status === 'paid' ? <LockKeyhole size={16} /> : <Send size={16} />
                  const iconColor = d.status === 'released' ? 'green' : d.status === 'disputed' ? 'orange' : d.status === 'refunded' ? 'orange' : d.status === 'cancelled' ? 'grey' : d.status === 'paid' ? 'blue' : 'orange'
                  return (
                    <div className="wallet-row" key={d.code}>
                      <span className={`activity-icon ${iconColor}`}>{icon}</span>
                      <p><b>{d.itemName}</b><small>{counterpart} <span>•</span> {d.code} <span>•</span> {new Date(d.createdAt).toLocaleDateString()}</small></p>
                      <span className={`deal-status-badge ${d.status}`}>{statusLabel[d.status]}</span>
                      {buyer && d.status === 'paid' && <button className="deal-row-action" onClick={() => requireVerified(() => openRelease(d))}>Confirm</button>}
                      {buyer && d.status === 'paid' && <button className="deal-row-action ghost" onClick={() => openDispute(d)}>Report</button>}
                      {seller && d.status === 'pending-acceptance' && <button className="deal-row-action ghost" onClick={() => openCancel(d)}>Cancel</button>}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        ) : (
        <>
        <section className="hero-grid animate-in" style={{ animationDelay: '110ms' }}>
          <div className="hero-card"><div className="hero-copy"><span className="status-chip"><span className="pulse-dot"></span> {heroChip}</span><h2>One step closer<br /><em>to a safe delivery.</em></h2><p>{activeDeal ? 'Your payment is locked and protected. Confirm when your package arrives, and we will release it instantly.' : mode === 'buyer' ? 'Top up your wallet so you\'re ready to accept an invite the moment one comes in — no separate payment needed at accept-time.' : 'Create a deal and we\'ll hand you an invite link — your buyer pays into escrow, and the money stays locked until you both agree it\'s done.'}</p><button className="hero-cta" onClick={heroAction}>{activeDeal ? 'Review current deal' : mode === 'buyer' ? 'Deposit funds' : 'Create your first deal'} <ArrowUpRight size={17} /></button></div><div className="orb orb-one"></div><div className="orb orb-two"></div>{activeDeal && <div className="hero-stamp"><LockKeyhole size={17} /><span>{symbolFor(activeDeal.currency)} {money(activeDeal.amount)}<br /><small>held securely</small></span></div>}</div>
          <div className="stats-card"><div className="section-label">YOUR TRUST SCORE <span>?</span></div><div className="score-row"><strong>{Math.round(trustScore)}</strong><span>/ 100</span><div className="score-ring"><ShieldCheck size={24} /></div></div><p>{trustScoreTarget >= 90 ? 'Excellent. You are building a trusted track record.' : trustScoreTarget >= 70 ? 'Good standing — keep completing deals cleanly.' : 'Complete deals without issues to raise this.'}</p><div className="mini-bars"><i style={{ height: '44%' }}></i><i style={{ height: '63%' }}></i><i style={{ height: '56%' }}></i><i style={{ height: '80%' }}></i><i className="hot" style={{ height: '96%' }}></i><i style={{ height: '72%' }}></i><i style={{ height: '86%' }}></i></div>{completedCount > 0 ? <small className="trend"><ArrowUpRight size={13} /> {completedCount} deal{completedCount === 1 ? '' : 's'} completed</small> : <small className="trend neutral">Complete a deal to start building trust.</small>}</div>
        </section>

        {activeDeal && (
        <section className="current-deal animate-in" id="current-deal" style={{ animationDelay: '190ms' }}>
          <div className="section-heading"><div><div className="section-label">{activeDeal.status === 'released' ? 'COMPLETED DEAL' : activeDeal.status === 'disputed' ? 'DISPUTED DEAL' : activeDeal.status === 'refunded' ? 'REFUNDED DEAL' : 'LIVE DEAL'}</div><h2>{activeDeal.itemName}</h2><p>{statusLabel[activeDeal.status]}</p></div><button className="more-button"><span></span><span></span><span></span></button></div>
          <div className="deal-body">
            <div className="deal-person buyer"><div className="person-avatar">{(iAmBuyer ? (activeDeal.sellerName || 'S') : (activeDeal.buyerName || activeDeal.buyerEmail || 'B'))[0].toUpperCase()}</div><div><small>{iAmBuyer ? 'YOU ARE BUYING FROM' : 'YOU ARE SELLING TO'}</small><b>{iAmBuyer ? (activeDeal.sellerName || 'Seller') : (activeDeal.buyerName || activeDeal.buyerEmail || 'Awaiting buyer')}</b>{iAmBuyer && <span>Seller <Icon name="verify" size={13} /></span>}</div></div>
            <div className="deal-amount"><small>AMOUNT HELD</small><strong>{symbolFor(activeDeal.currency)} {money(dealAmount)}</strong><button onClick={copyId}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> {activeDeal.code}</>}</button></div>
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
          {activeDeal.status === 'pending-acceptance' && (
            <div className="deal-action-row">
              <button className="confirm-button" onClick={copyActiveDealLink}>{linkCopied ? <><Check size={17} /> Link copied</> : <><Link2 size={17} /> Copy invite link</>}</button>
              {activeDeal.sellerEmail === user.email && <button className="dispute-button" onClick={() => openCancel(activeDeal)}><Icon name="close" size={15} /> Cancel deal</button>}
            </div>
          )}
        </section>
        )}

        <section className="bottom-grid animate-in" style={{ animationDelay: '260ms' }}>
          <div className="activity">
            <div className="section-heading"><div><div className="section-label">RECENT ACTIVITY</div><h2>Everything in one place</h2></div>{transactions.length > 0 && <button className="text-button" onClick={() => setActiveTab('Wallet')}>View all <ArrowUpRight size={15} /></button>}</div>
            <div className="activity-list">
              {transactions.length === 0 ? <div className="wallet-empty">Nothing yet — activity shows up here once a deal moves.</div> : transactions.slice(0, 3).map((t) => (
                <div key={t.id}><span className={t.type === 'release' ? 'activity-icon green' : 'activity-icon blue'}>{activityIcon[t.type]}</span><p><b>{t.type === 'deposit' ? 'Payment protected' : activityLabel[t.type] || t.type}</b><small>{t.itemName} <span>•</span> {new Date(t.at).toLocaleDateString()}</small></p><strong>{symbolFor(t.currency)} {money(t.amount)}</strong></div>
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
          <h2>{symbolFor(releaseTarget?.currency)} {money(releaseTarget?.amount)} sent to {releaseTarget?.sellerName || 'the seller'}.</h2>
          <p>Nice one, deal complete. Your trust score just went up.</p>
        </> : <>
          <button className="modal-close" onClick={closeModal}><Icon name="close" size={18} /></button>
          <div className="modal-icon"><LockKeyhole size={22} /></div>
          <div className="section-label">DELIVERY CONFIRMATION</div>
          <h2>Has your package arrived safely?</h2>
          <p>Confirming delivery releases <b>{symbolFor(releaseTarget?.currency)} {money(releaseTarget?.amount)}</b> to {releaseTarget?.sellerName || 'the seller'}. This action cannot be undone.</p>
          {releaseError && <p className="invite-error"><Icon name="alarm" size={13} /> {releaseError}</p>}
          <div className="modal-actions"><button className="cancel-button" onClick={closeModal}>Not yet</button><button className="confirm-button" onClick={releaseFunds}>Yes, release funds <Check size={17} /></button></div>
        </>}
      </div></div>}

      {gateOpen && <div className="modal-backdrop" onClick={() => setGateOpen(false)}><div className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={() => setGateOpen(false)}><Icon name="close" size={18} /></button>
        <div className="modal-icon gate"><Icon name="alarm" size={22} /></div>
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
        <button className="modal-close" onClick={() => setPayoutGateOpen(false)}><Icon name="close" size={18} /></button>
        <div className="modal-icon gate"><Icon name="wallet" size={22} /></div>
        <div className="section-label">PAYOUT METHOD</div>
        <h2>Add where you get paid first</h2>
        <p>Before you can sell on Middleman, add a mobile money number or bank account in your profile — that's where we send your money once a buyer releases a deal.</p>
        <div className="modal-actions">
          <button className="cancel-button" onClick={() => setPayoutGateOpen(false)}>Not now</button>
          <button className="confirm-button" onClick={() => navigate('/profile')}>Add payout method <Icon name="wallet" size={17} /></button>
        </div>
      </div></div>}

      {disputeOpen && <div className="modal-backdrop" onClick={closeDispute}><div className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={closeDispute}><Icon name="close" size={18} /></button>
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

      {cancelTarget && <div className="modal-backdrop" onClick={closeCancel}><div className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={closeCancel}><Icon name="close" size={18} /></button>
        <div className="modal-icon gate"><Icon name="close" size={22} /></div>
        <div className="section-label">CANCEL DEAL</div>
        <h2>Cancel this invite?</h2>
        <p>{cancelTarget.buyerContact || 'Your buyer'} won't be able to accept <b>{cancelTarget.itemName}</b> anymore — the invite link stops working. This can't be undone.</p>
        <div className="modal-actions"><button className="cancel-button" onClick={closeCancel}>Keep it</button><button className="dispute-button" onClick={confirmCancel}><Icon name="close" size={15} /> Yes, cancel deal</button></div>
      </div></div>}

      {newDealOpen && <div className="modal-backdrop" onClick={closeNewDeal}><div className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={closeNewDeal}><Icon name="close" size={18} /></button>
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
            <div className="deal-form-row">
              <div className="deal-form-field"><label htmlFor="item-currency">Currency</label><select id="item-currency" value={dealForm.currency} onChange={(e) => setDealForm((f) => ({ ...f, currency: e.target.value }))}>{Object.values(CURRENCIES).map((c) => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}</select></div>
              <div className="deal-form-field"><label htmlFor="item-amount">Amount</label><input id="item-amount" required type="number" min="1" step="0.01" value={dealForm.amount} onChange={(e) => setDealForm((f) => ({ ...f, amount: e.target.value }))} placeholder="4250.00" /></div>
            </div>
            <div className="deal-form-field"><label htmlFor="buyer-contact">Buyer's email or phone (optional)</label><input id="buyer-contact" value={dealForm.buyerContact} onChange={(e) => setDealForm((f) => ({ ...f, buyerContact: e.target.value }))} placeholder="buyer@example.com" /></div>
            <button className="confirm-button deal-submit" type="submit">Create invite <Link2 size={16} /></button>
          </form>
        </> : <>
          <div className="modal-icon success"><Check size={22} /></div>
          <div className="section-label">INVITE READY</div>
          <h2>Send this to your buyer</h2>
          <div className="deal-preview">
            {createdDeal.image && <img src={createdDeal.image} alt={createdDeal.itemName} />}
            <div><b>{createdDeal.itemName}</b><span>{symbolFor(createdDeal.currency)} {money(createdDeal.amount)}</span></div>
          </div>
          <div className="invite-link-row">
            <input readOnly value={inviteUrl} onFocus={(e) => e.target.select()} />
            <button onClick={copyInvite}>{linkCopied ? <Check size={15} /> : <Copy size={15} />}</button>
          </div>
          <p className="deal-invite-note">Once your buyer accepts and pays, the money is held safe with Middleman until you ship and they confirm delivery.</p>
          <button className="confirm-button deal-submit" onClick={closeNewDeal}>Done</button>
        </>}
      </div></div>}

      {depositOpen && <div className="modal-backdrop" onClick={closeDeposit}><div className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={closeDeposit}><Icon name="close" size={18} /></button>
        <div className="modal-icon"><Icon name="wallet" size={22} /></div>
        <div className="section-label">DEPOSIT FUNDS</div>
        <h2>Add money to your wallet</h2>
        <p>Top up your Middleman wallet — spend it on any deal you accept, whenever you accept it.</p>
        {depositError && <p className="invite-error"><Icon name="alarm" size={13} /> {depositError}</p>}
        <form onSubmit={submitDeposit}>
          <div className="deal-form-row">
            <div className="deal-form-field"><label htmlFor="deposit-currency">Currency</label><select id="deposit-currency" value={depositForm.currency} onChange={(e) => setDepositForm((f) => ({ ...f, currency: e.target.value }))}>{Object.values(CURRENCIES).map((c) => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}</select></div>
            <div className="deal-form-field"><label htmlFor="deposit-amount">Amount</label><input id="deposit-amount" required type="number" min="1" step="0.01" value={depositForm.amount} onChange={(e) => setDepositForm((f) => ({ ...f, amount: e.target.value }))} placeholder="100.00" /></div>
          </div>
          <button className="confirm-button deal-submit" type="submit" disabled={depositing}>{depositing ? <><Loader2 size={16} className="spin" /> Processing…</> : 'Deposit'}</button>
        </form>
      </div></div>}

      {refundOpen && <div className="modal-backdrop" onClick={() => setRefundOpen(false)}><div className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={() => setRefundOpen(false)}><Icon name="close" size={18} /></button>
        <div className="modal-icon gate"><Icon name="refund" size={22} /></div>
        <div className="section-label">REQUEST REFUND</div>
        {refundSent ? (
          <>
            <h2>Refund requested</h2>
            <p>We've reserved {symbolFor(refundForm.currency)} {money(Number(refundForm.amount))} out of your spendable balance. Our team sends refunds manually — this can take a little while.</p>
            <button className="confirm-button deal-submit" onClick={() => setRefundOpen(false)}>Done</button>
          </>
        ) : (
          <>
            <h2>Pull unused funds back out</h2>
            <p>Refunds are handled manually by the team, not automatically — this just puts in the request.</p>
            {refundError && <p className="invite-error"><Icon name="alarm" size={13} /> {refundError}</p>}
            <form onSubmit={submitRefund}>
              <div className="deal-form-row">
                <div className="deal-form-field"><label htmlFor="refund-currency">Currency</label><select id="refund-currency" value={refundForm.currency} onChange={(e) => setRefundForm((f) => ({ ...f, currency: e.target.value }))}>{Object.values(CURRENCIES).map((c) => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}</select></div>
                <div className="deal-form-field"><label htmlFor="refund-amount">Amount</label><input id="refund-amount" required type="number" min="1" step="0.01" value={refundForm.amount} onChange={(e) => setRefundForm((f) => ({ ...f, amount: e.target.value }))} placeholder="100.00" /></div>
              </div>
              <div className="deal-form-field"><label htmlFor="refund-note">Note (optional)</label><input id="refund-note" value={refundForm.note} onChange={(e) => setRefundForm((f) => ({ ...f, note: e.target.value }))} placeholder="Why you're asking for it back" /></div>
              <button className="confirm-button deal-submit" type="submit">Request refund</button>
            </form>
          </>
        )}
      </div></div>}

      {payoutRequestOpen && <div className="modal-backdrop" onClick={() => setPayoutRequestOpen(false)}><div className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={() => setPayoutRequestOpen(false)}><Icon name="close" size={18} /></button>
        <div className="modal-icon gate"><Icon name="refund" size={22} /></div>
        <div className="section-label">REQUEST PAYOUT</div>
        {payoutRequestSent ? (
          <>
            <h2>Payout requested</h2>
            <p>Our team sends payouts manually to the payout method on your profile — this can take a little while.</p>
            <button className="confirm-button deal-submit" onClick={() => setPayoutRequestOpen(false)}>Done</button>
          </>
        ) : (
          <>
            <h2>Get your earnings sent out</h2>
            <p>Payouts go to the mobile money/bank details on your profile, handled manually by the team.</p>
            {payoutRequestError && <p className="invite-error"><Icon name="alarm" size={13} /> {payoutRequestError}</p>}
            <form onSubmit={submitPayoutRequest}>
              <div className="deal-form-row">
                <div className="deal-form-field"><label htmlFor="payout-currency">Currency</label><select id="payout-currency" value={payoutRequestForm.currency} onChange={(e) => setPayoutRequestForm((f) => ({ ...f, currency: e.target.value }))}>{Object.values(CURRENCIES).map((c) => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}</select></div>
                <div className="deal-form-field"><label htmlFor="payout-amount">Amount</label><input id="payout-amount" required type="number" min="1" step="0.01" value={payoutRequestForm.amount} onChange={(e) => setPayoutRequestForm((f) => ({ ...f, amount: e.target.value }))} placeholder="100.00" /></div>
              </div>
              <div className="deal-form-field"><label htmlFor="payout-note">Note (optional)</label><input id="payout-note" value={payoutRequestForm.note} onChange={(e) => setPayoutRequestForm((f) => ({ ...f, note: e.target.value }))} /></div>
              <button className="confirm-button deal-submit" type="submit">Request payout</button>
            </form>
          </>
        )}
      </div></div>}

      {supportOpen && <SupportChat email={user.email} name={user.name} onClose={() => setSupportOpen(false)} />}
    </div>
  )
}

export default Dashboard
