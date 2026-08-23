import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowRight, Loader2, LockKeyhole, PackageX, Receipt, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useAppState } from '../state/AppState.jsx'
import { getDeal, markDealPaid } from '../state/deals.js'
import { logTransaction } from '../state/transactions.js'
import { payWithPaystack, verifyPaystackPayment } from '../utils/paystack.js'
import './Invite.css'

const money = (value) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Invite() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { authed, user, verification } = useAppState()
  const deal = getDeal(code)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')

  const accept = async () => {
    if (!authed) { navigate('/signup', { state: { inviteCode: code } }); return }
    if (verification !== 'verified') { navigate('/verify', { state: { from: `/invite/${code}` } }); return }
    setError('')
    setPaying(true)
    try {
      const reference = await payWithPaystack({ email: user.email, amount: deal.buyerTotal, dealCode: code })
      const verified = await verifyPaystackPayment(reference)
      if (verified.status !== 'success') throw new Error('Payment was not successful. No funds were moved.')

      logTransaction({ type: 'deposit', dealCode: code, itemName: deal.itemName, amount: deal.buyerTotal, fee: deal.fee, sellerPayout: deal.sellerPayout, buyerEmail: user.email, sellerEmail: deal.sellerEmail, counterparty: deal.sellerName })
      markDealPaid(code, user.email, user.name)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Payment failed. Please try again.')
      setPaying(false)
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
        <div className="invite-amount">₵ {money(deal.buyerTotal ?? deal.amount)}</div>

        {deal.fee != null && (
          <div className="invite-fee-breakdown">
            <Receipt size={14} />
            <div>
              <div><span>Item price</span><b>₵ {money(deal.amount)}</b></div>
              <div><span>Middleman fee ({Math.round(deal.feeRate * 1000) / 10}%)</span><b>₵ {money(deal.fee)}</b></div>
              <div className="total"><span>You pay</span><b>₵ {money(deal.buyerTotal)}</b></div>
            </div>
          </div>
        )}

        <div className="invite-explainer">
          <ShieldCheck size={16} />
          <p>Pay into Middleman, not {deal.sellerName || 'the seller'} directly. We hold your money until you confirm the item has arrived — then, and only then, it's released. The seller receives the full ₵ {money(deal.amount)} listed price.</p>
        </div>

        {error && <p className="invite-error"><ShieldAlert size={13} /> {error}</p>}
        <button className="invite-cta" disabled={paying} onClick={accept}>{paying ? <><Loader2 size={16} className="spin" /> Moving funds into escrow…</> : <>Accept &amp; continue <ArrowRight size={16} /></>}</button>
        <p className="invite-fineprint">{authed ? "You'll verify your identity if you haven't already, then your payment is held safe until you confirm delivery." : "You'll create a free Middleman account to pay in and track this deal."}</p>
      </div>
    </div>
  )
}

export default Invite
