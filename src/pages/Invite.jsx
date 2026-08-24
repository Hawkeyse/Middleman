import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowRight, Loader2, LockKeyhole, Receipt, ShieldCheck } from 'lucide-react'
import Icon from '../components/Icon.jsx'
import { useAppState } from '../state/AppState.jsx'
import { acceptDeal, getDeal } from '../state/deals.js'
import { creditDeposit, getWalletBalance } from '../state/wallet.js'
import { payWithProvider, verifyProviderPayment } from '../utils/payments.js'
import { money, symbolFor } from '../utils/currencies.js'
import './Invite.css'

const pendingRefKey = (code) => `mm_pending_topup_ref_${code}`

function Invite() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { authed, user, verification } = useAppState()
  const [deal, setDeal] = useState(null)
  const [dealLoading, setDealLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')

  const [topUpOpen, setTopUpOpen] = useState(false)
  const [shortfall, setShortfall] = useState(0)
  const [payingTopUp, setPayingTopUp] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkNote, setCheckNote] = useState('')

  useEffect(() => {
    let cancelled = false
    setDealLoading(true)
    getDeal(code).then((d) => { if (!cancelled) { setDeal(d); setDealLoading(false) } })
    return () => { cancelled = true }
  }, [code])

  // Accepting a deal spends straight from the buyer's Middleman wallet —
  // a single atomic server call (see api/deals/accept.js) instead of
  // charging Paystack fresh every time.
  const spendAndAccept = async () => {
    try {
      await acceptDeal(code, user.name)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Could not accept this deal. Please try again.')
      setAccepting(false)
    }
  }

  const accept = async () => {
    if (!authed) { navigate('/signup', { state: { inviteCode: code } }); return }
    if (verification !== 'verified') { navigate('/verify', { state: { from: `/invite/${code}` } }); return }
    setError('')
    setAccepting(true)
    const balance = await getWalletBalance(user.email, deal.currency)
    if (balance < deal.buyerTotal) {
      setShortfall(Math.round((deal.buyerTotal - balance) * 100) / 100)
      setTopUpOpen(true)
      setAccepting(false)
      return
    }
    await spendAndAccept()
  }

  const topUpAndAccept = async () => {
    setError('')
    setPayingTopUp(true)
    try {
      const { provider, reference } = await payWithProvider({
        email: user.email, amount: shortfall, currency: deal.currency, dealCode: `WALLET-${code}`,
        onReference: (ref) => localStorage.setItem(pendingRefKey(code), JSON.stringify(ref)),
      })
      const verified = await verifyProviderPayment(provider, reference)
      if (verified.status !== 'success') throw new Error('Payment was not successful. No funds were moved.')
      await creditDeposit(provider, reference)
      localStorage.removeItem(pendingRefKey(code))
      setTopUpOpen(false)
      await spendAndAccept()
    } catch (err) {
      setError(err.message || 'Payment failed. Please try again.')
    } finally {
      setPayingTopUp(false)
    }
  }

  // Recovers a top-up that actually succeeded on the provider's side but never
  // got credited locally (tab closed mid-flow, etc.) — same idea as the
  // deposit recovery this replaced, just scoped to the wallet top-up now.
  // The saved value carries which provider (Paystack/Flutterwave) it belongs
  // to, since verifying needs to hit the right one.
  const pendingRefRaw = deal ? localStorage.getItem(pendingRefKey(code)) : null
  let pendingRef = null
  try { pendingRef = pendingRefRaw ? JSON.parse(pendingRefRaw) : null } catch { pendingRef = null }
  const checkPendingTopUp = async () => {
    if (!pendingRef) return
    setError('')
    setCheckNote('')
    setChecking(true)
    try {
      const verified = await verifyProviderPayment(pendingRef.provider, pendingRef.reference)
      if (verified.status === 'success') {
        await creditDeposit(pendingRef.provider, pendingRef.reference)
        localStorage.removeItem(pendingRefKey(code))
        setChecking(false)
        setTopUpOpen(false)
        await spendAndAccept()
      } else {
        localStorage.removeItem(pendingRefKey(code))
        setCheckNote("That payment attempt didn't go through — no funds were moved. Feel free to try again.")
        setChecking(false)
      }
    } catch (err) {
      setError(err.message || 'Could not check payment status. Please try again.')
      setChecking(false)
    }
  }

  if (dealLoading) {
    return (
      <div className="invite-page">
        <div className="invite-card"><Loader2 size={26} className="spin" /></div>
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="invite-page">
        <div className="invite-card">
          <div className="invite-icon missing"><Icon name="forbidden" size={26} /></div>
          <h2>This invite isn't available</h2>
          <p>The link may have expired, or it was created in a different browser than this one — Middleman invites are currently device-specific in this preview.</p>
          <Link className="invite-cta" to="/">Go to Middleman</Link>
        </div>
      </div>
    )
  }

  if (deal.status === 'cancelled') {
    return (
      <div className="invite-page">
        <div className="invite-card">
          <div className="invite-icon missing"><Icon name="forbidden" size={26} /></div>
          <h2>This invite was cancelled</h2>
          <p>{deal.sellerName || 'The seller'} cancelled this deal before it was accepted. Ask them for a new invite if you still want to go ahead.</p>
          <Link className="invite-cta" to="/">Go to Middleman</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="invite-page">
      <div className="invite-card">
        <div className="invite-brand"><img src="/middleman-logo.png" alt="Middleman" /><span>middleman</span></div>
        <span className="invite-eyebrow"><LockKeyhole size={13} /> DEAL INVITE FROM {(deal.sellerName || 'a seller').toUpperCase()}</span>

        {deal.image && <img className="invite-item-image" src={deal.image} alt={deal.itemName} />}
        <h2>{deal.itemName}</h2>
        <div className="invite-amount">{symbolFor(deal.currency)} {money(deal.buyerTotal ?? deal.amount)}</div>

        {deal.fee != null && (
          <div className="invite-fee-breakdown">
            <Receipt size={14} />
            <div>
              <div><span>Item price</span><b>{symbolFor(deal.currency)} {money(deal.amount)}</b></div>
              <div><span>Middleman fee ({Math.round(deal.feeRate * 1000) / 10}%)</span><b>{symbolFor(deal.currency)} {money(deal.fee)}</b></div>
              <div className="total"><span>You pay</span><b>{symbolFor(deal.currency)} {money(deal.buyerTotal)}</b></div>
            </div>
          </div>
        )}

        <div className="invite-explainer">
          <ShieldCheck size={16} />
          <p>This comes out of your Middleman wallet — top up if you need to. We hold it until you confirm the item has arrived, then it's released. The seller receives the full {symbolFor(deal.currency)} {money(deal.amount)} listed price.</p>
        </div>

        {error && <p className="invite-error"><Icon name="alarm" size={13} /> {error}</p>}
        <button className="invite-cta" disabled={accepting} onClick={accept}>{accepting ? <><Loader2 size={16} className="spin" /> Checking your wallet…</> : <>Accept &amp; continue <ArrowRight size={16} /></>}</button>
        <p className="invite-fineprint">{authed ? "You'll verify your identity if you haven't already, then it's covered by your wallet balance." : "You'll create a free Middleman account to accept and track this deal."}</p>
      </div>

      {topUpOpen && (
        <div className="modal-backdrop" onClick={() => !payingTopUp && setTopUpOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setTopUpOpen(false)}><Icon name="close" size={18} /></button>
            <div className="modal-icon"><Icon name="wallet" size={22} /></div>
            <div className="section-label">TOP UP TO ACCEPT</div>
            <h2>Your wallet is short {symbolFor(deal.currency)} {money(shortfall)}</h2>
            <p>This deal costs {symbolFor(deal.currency)} {money(deal.buyerTotal)}. Top up the difference now and we'll accept the deal automatically once it lands.</p>
            {checkNote && <p className="invite-note-text">{checkNote}</p>}
            <div className="modal-actions">
              <button className="cancel-button" onClick={() => setTopUpOpen(false)} disabled={payingTopUp || checking}>Cancel</button>
              <button className="confirm-button" onClick={topUpAndAccept} disabled={payingTopUp || checking}>
                {payingTopUp ? <><Loader2 size={16} className="spin" /> Processing…</> : <>Top up {symbolFor(deal.currency)} {money(shortfall)} &amp; accept</>}
              </button>
            </div>
            {pendingRef && !payingTopUp && (
              <button className="invite-refresh" disabled={checking} onClick={checkPendingTopUp}>
                {checking ? <><Loader2 size={14} className="spin" /> Checking…</> : 'Already paid? Check payment status'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Invite
