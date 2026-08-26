import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import './Faq.css'

const faqs = [
  {
    q: 'What is Middleman?',
    a: "Middleman is an escrow service for deals between a buyer and a seller who don't fully know or trust each other yet — often strangers who met online. Instead of paying the seller directly, the buyer pays Middleman. We hold that money until the buyer confirms they actually received what they paid for, then release it to the seller.",
  },
  {
    q: 'Is my money actually safe while a deal is in progress?',
    a: "Yes — once a buyer accepts a deal, the funds sit in escrow. They can't be released to the seller until the buyer confirms delivery, and they can't be pulled back out by the buyer either once the deal is accepted. Nobody can move that money unilaterally while a deal is open.",
  },
  {
    q: 'Why do I need to verify my identity?',
    a: "Identity verification (a government-issued ID plus a live selfie) is required before you can create or accept a deal. It's what keeps Middleman a platform where people are accountable for what they buy and sell, rather than an anonymous free-for-all — it's the main thing that discourages scammers in the first place.",
  },
  {
    q: 'How do I pay for a deal?',
    a: "You deposit into your Middleman wallet first, through Paystack or Flutterwave. When you accept a deal, its full cost (item price plus our fee) is drawn from that wallet balance. If your wallet doesn't have enough, you're shown exactly how much more you need and can top up on the spot — the deal accepts automatically once it lands.",
  },
  {
    q: 'How much does Middleman charge?',
    a: "We charge a service fee on top of the listed price, shown to the buyer in full — item price, fee, and total — before they accept. The seller always receives exactly what they listed the item for; the fee never comes out of their side.",
  },
  {
    q: 'What happens if the item never arrives, or isn’t what was described?',
    a: "Report a problem instead of confirming delivery. That immediately freezes the deal so the funds can't be released to anyone until our team reviews it — we look at the listing, any in-app messages, and whatever either side submits, then decide whether to release the funds or refund the buyer.",
  },
  {
    q: 'How does the seller get paid?',
    a: "Once a buyer confirms delivery, the amount lands in the seller's Middleman balance — not their bank account directly. To cash out, they add a payout method (mobile money or bank details) in their profile and request a payout, which our team processes manually.",
  },
  {
    q: 'Can I get a refund on money I haven’t spent yet?',
    a: "Yes. Any wallet balance you haven't put into a deal can be refunded on request from your dashboard at any time. It's set aside the moment you ask so you can't accidentally spend it, but the payout itself is processed manually and isn't instant.",
  },
  {
    q: 'What currencies does Middleman support?',
    a: 'Deals can be listed in GHS, NGN, or USD. If our payment processor isn’t charging directly in a deal’s listed currency, your payment is converted automatically at the prevailing rate before you confirm — the seller still receives the full amount in the deal’s original currency either way.',
  },
  {
    q: 'What if the other person tries to pay or get paid outside the app?',
    a: "Don't. Moving payment outside Middleman removes the escrow protection entirely — at that point there's nothing holding either side accountable. Keep the deal, and ideally the conversation, inside the app.",
  },
  {
    q: 'What counts as a scam or prohibited use?',
    a: "Listing something you don't intend to provide, sending something that doesn't match the listing, using someone else's ID or an edited document, or opening a false dispute to get money back for something you did receive. Any of this can get an account suspended or banned immediately, and fraud is reported to law enforcement with the identifying information we have.",
  },
  {
    q: 'How do I reach support?',
    a: 'Use the Support chat inside the app — a real person on our team responds, and it keeps a record tied to your account and any relevant deal.',
  },
]

function FaqItem({ item, open, onToggle }) {
  return (
    <div className={`faq-item${open ? ' open' : ''}`}>
      <button className="faq-question" onClick={onToggle} aria-expanded={open}>
        <span>{item.q}</span>
        <ChevronDown size={17} className="faq-chevron" />
      </button>
      {open && <p className="faq-answer">{item.a}</p>}
    </div>
  )
}

function Faq() {
  const [openIndex, setOpenIndex] = useState(0)

  return (
    <div className="terms-page">
      <header className="terms-nav">
        <Link className="terms-back" to="/"><ArrowLeft size={14} /> Back to Middleman</Link>
        <div className="terms-brand"><img src="/middleman-logo.png" alt="Middleman" /><span>middleman</span></div>
      </header>

      <div className="terms-card">
        <h1>Frequently Asked Questions</h1>
        <p className="terms-updated">Everything most people ask before their first deal.</p>

        <div className="faq-list">
          {faqs.map((item, i) => (
            <FaqItem
              key={item.q}
              item={item}
              open={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
            />
          ))}
        </div>

        <p className="faq-footer-note">Still have a question? Reach us through the in-app Support chat, or read the full <Link to="/terms">Terms of Service</Link>.</p>
      </div>
    </div>
  )
}

export default Faq
