import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowRight, Loader2, LockKeyhole, PackageX, Receipt, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useAppState } from '../state/AppState.jsx'
import { getDeal, markDealPaid } from '../state/deals.js'
import { logTransaction } from '../state/transactions.js'
import { payWithPaystack, verifyPaystackPayment } from '../utils/paystack.js'
import { money, symbolFor } from '../utils/currencies.js'
import './Invite.css'

const pendingRefKey = (code) => `mm_pending_ref_${code}`

function Invite() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { authed, user, verification } = useAppState()
  const deal = getDeal(code)
  const [paying, setPaying] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [checkNote, setCheckNote] = useState('')

  // verified comes straight from Paystack's own confirmation (api/paystack/
  // verify.js) — amount/currency there are what was actually charged, which
  // can differ from the deal's nominal amount/currency if it got converted
  // to the merchant account's enabled currency at checkout.
  const finalizeDeposit = ({ dealCode = code, amount: chargedAmount, currency: chargedCurrency } = {}) => {
    logTransaction({
      type: 'deposit', dealCode, itemName: deal.itemName, amount: deal.buyerTotal, currency: deal.currency,
      chargedAmount, chargedCurrency, fee: deal.fee, sellerPayout: deal.sellerPayout,
      buyerEmail: user.email, sellerEmail: deal.sellerEmail, counterparty: deal.sellerName,
    })
    markDealPaid(dealCode, user.email, user.name)
    localStorage.removeItem(pendingRefKey(code))
    navigate('/dashboard')
  }

  const accept = async () => {
    if (!authed) { navigate('/signup', { state: { inviteCode: code } }); return }
    if (verification !== 'verified') { navigate('/verify', { state: { from: `/invite/${code}` } }); return }
    setError('')
    setPaying(true)
    try {
      const reference = await payWithPaystack({
        email: user.email, amount: deal.buyerTotal, currency: deal.currency, dealCode: code,
        onReference: (ref) => localStorage.setItem(pendingRefKey(code), ref),
      })
      const verified = await verifyPaystackPayment(reference)
      if (verified.status !== 'success') throw new Error('Payment was not successful. No funds were moved.')
      finalizeDeposit(verified)
    } catch (err) {
      setError(err.message || 'Payment failed. Please try again.')
      setPaying(false)
    }
  }

  // Recovers from a payment that actually went through on Paystack's side but
  // never got recorded locally — e.g. the tab closed or the app crashed
  // between Paystack's callback and finishing the deal/transaction records.
  const pendingRef = deal?.status === 'pending-acceptance' ? localStorage.getItem(pendingRefKey(code)) : null
  const checkPaymentStatus = async () => {
    if (!pendingRef) return
    setError('')
    setCheckNote('')
    setChecking(true)
    try {
      const verified = await verifyPaystackPayment(pendingRef)
      if (verified.status === 'success') {
        finalizeDeposit(verified)
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

  if (!deal) {
    return (
      <div className="invite-page">
        <div className="invite-card">
          <div className="invite-icon missing"><PackageX size={26} /></div>
          <h2>This invite isn't available</h2>
          <p>The link may have expired, or it was created in a different browser than this one — Middleman invites are currently device-specific in this preview.</p>
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
          <p>Pay into Middleman, not {deal.sellerName || 'the seller'} directly. We hold your money until you confirm the item has arrived — then, and only then, it's released. The seller receives the full {symbolFor(deal.currency)} {money(deal.amount)} listed price.</p>
        </div>

        {deal.currency && deal.currency !== 'GHS' && (
          <p className="invite-fx-note">Charged in Ghana Cedis (₵) at today's rate — you'll see the exact amount on the payment screen before confirming.</p>
        )}

        {checkNote && <p className="invite-note-text">{checkNote}</p>}
        {error && <p className="invite-error"><ShieldAlert size={13} /> {error}</p>}
        <button className="invite-cta" disabled={paying || checking} onClick={accept}>{paying ? <><Loader2 size={16} className="spin" /> Moving funds into escrow…</> : <>Accept &amp; continue <ArrowRight size={16} /></>}</button>

        {pendingRef && !paying && (
          <button className="invite-refresh" disabled={checking} onClick={checkPaymentStatus}>
            {checking ? <><Loader2 size={14} className="spin" /> Checking…</> : <><RefreshCw size={14} /> Already paid? Check payment status</>}
          </button>
        )}

        <p className="invite-fineprint">{authed ? "You'll verify your identity if you haven't already, then your payment is held safe until you confirm delivery." : "You'll create a free Middleman account to pay in and track this deal."}</p>
      </div>
    </div>
  )
}

export default Invite
