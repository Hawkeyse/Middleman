import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import './Terms.css'

const sections = [
  { id: 'what', label: 'What Middleman Is' },
  { id: 'eligibility', label: 'Who Can Use Middleman' },
  { id: 'accounts', label: 'Your Account & Identity Verification' },
  { id: 'how-it-works', label: 'How a Deal Actually Works' },
  { id: 'wallet', label: 'Your Middleman Wallet' },
  { id: 'fees', label: 'Fees' },
  { id: 'currency', label: 'Currency & Conversion' },
  { id: 'payouts', label: 'Seller Payouts' },
  { id: 'responsibilities', label: 'Your Responsibilities' },
  { id: 'prohibited', label: 'Prohibited Conduct & Fraud' },
  { id: 'disputes', label: 'Disputes' },
  { id: 'liability', label: 'Limitation of Liability' },
  { id: 'suspension', label: 'Account Suspension & Termination' },
  { id: 'changes', label: 'Changes to These Terms' },
  { id: 'law', label: 'Governing Law' },
  { id: 'contact', label: 'Contact' },
]

function Terms() {
  return (
    <div className="terms-page">
      <header className="terms-nav">
        <Link className="terms-back" to="/"><ArrowLeft size={14} /> Back to Middleman</Link>
        <div className="terms-brand"><img src="/middleman-logo.png" alt="Middleman" /><span>middleman</span></div>
      </header>

      <div className="terms-card">
        <h1>Terms of Service</h1>
        <p className="terms-updated">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <p>These Terms of Service ("Terms") govern your use of Middleman (the "Service"), an escrow platform that holds payment for a deal between a buyer and a seller until the buyer confirms they've received what they paid for. By creating an account or using the Service in any way, you agree to these Terms in full. If you don't agree, please don't use the Service.</p>
        <p>We've tried to write this in plain language rather than dense legal boilerplate, and to actually explain how the product works rather than speak in the abstract — but it's still the binding agreement between you and Middleman.</p>

        <nav className="terms-toc" aria-label="Table of contents">
          <span className="section-label">ON THIS PAGE</span>
          <ol>
            {sections.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.label}</a></li>)}
          </ol>
        </nav>

        <h2 id="what">1. What Middleman Is</h2>
        <p>Middleman is an escrow-style intermediary for transactions between a buyer and a seller — most commonly, someone buying an item or service from someone else they don't fully know or trust yet, such as a stranger they met online. Instead of the buyer paying the seller directly, the buyer pays Middleman. Middleman holds that money — it does not go to the seller — until the buyer confirms the item or service was actually delivered as agreed. Only then is it released to the seller.</p>
        <p>Middleman is not a party to the underlying sale itself. We don't inspect items before they ship, we don't guarantee that a seller's description of an item is accurate, and we don't guarantee the quality, safety, legality, or fitness of anything bought or sold through the Service. Our role is limited to holding and releasing funds according to these Terms, and reviewing disputes when one is raised.</p>

        <h2 id="eligibility">2. Who Can Use Middleman</h2>
        <p>You must be at least 18 years old to create an account, and this is enforced as part of identity verification (see below) — if the date of birth on your submitted document shows you're under 18, your verification will be declined. You must also be able to form a legally binding contract in your country of residence, and you must not be barred from using the Service under the laws of your country or ours.</p>

        <h2 id="accounts">3. Your Account &amp; Identity Verification</h2>
        <p>You need a Middleman account to buy or sell. Signing up requires a working email address, which we verify by sending a link you must click before the account is usable. You're responsible for keeping your password secure and for everything that happens under your account, whether or not you personally did it — if you believe your account has been compromised, contact us immediately through Support.</p>
        <p>Before you can create or accept a deal, you must complete identity verification: submitting a government-issued ID (passport, national ID, driver's license, or another accepted document depending on your country) along with a live selfie, taken through the app at the time of verification. Our team manually reviews each submission and approves or declines it — this can take some time, and we may decline a submission that's unclear, doesn't match, appears altered, or fails an automated pre-check for those same issues. You agree that documents and photos you submit are genuinely yours and unaltered; submitting someone else's identity, or an edited document, is treated as fraud (see Section 10).</p>

        <h2 id="how-it-works">4. How a Deal Actually Works</h2>
        <p>A typical deal on Middleman goes like this:</p>
        <p>1. A seller creates a deal — an item or service, a price, and a currency — and gets a private invite link to send to their buyer.</p>
        <p>2. The buyer opens the link, and if they don't have an account yet, creates one and completes identity verification.</p>
        <p>3. The buyer accepts the deal. This draws the deal's total cost (listed price plus Middleman's fee) from the buyer's Middleman wallet — see Section 5 for how that works if the wallet doesn't already have enough in it.</p>
        <p>4. The money now sits in escrow, held by Middleman. The seller is expected to deliver the item or service as agreed.</p>
        <p>5. Once the buyer has received what they paid for, they confirm delivery in the app. This releases the funds to the seller's Middleman balance.</p>
        <p>6. If something's wrong instead, the buyer can report a problem rather than confirming — see Section 11 on Disputes for what happens next.</p>

        <h2 id="wallet">5. Your Middleman Wallet</h2>
        <p>To accept a deal as a buyer, you first deposit funds into your Middleman wallet — a balance held in your account, separate from any specific deal. Deposits are made through our payment processor and, once confirmed, are added to your wallet immediately.</p>
        <p>When you accept a deal, its full cost is debited from your wallet balance rather than charging you again at that moment. If your wallet doesn't have enough to cover the deal you're trying to accept, you'll be shown exactly how much more you need and asked to deposit that shortfall — once it lands, the deal is accepted automatically.</p>
        <p>You may request a refund of wallet funds you haven't spent on a deal at any time, from your dashboard. The amount you request is set aside out of your spendable balance the moment you ask, so you can't accidentally spend money you've already asked to have refunded — but the refund itself is not instant. Our team processes refund requests manually, and this can take some time. We do not pay interest on wallet balances, and deposited funds are not insured deposits in the way a bank account might be.</p>

        <h2 id="fees">6. Fees</h2>
        <p>Middleman charges a service fee on every deal, calculated from the listed price and shown to the buyer in full — item price, fee, and total — before they accept the deal. The fee is paid by the buyer on top of the listed price; the seller always receives the full amount they listed the item for, with nothing deducted. The exact fee schedule (how much the fee is at a given price point) may change over time; what matters is always what you're shown at checkout for that specific deal, not any number quoted elsewhere. Fees are non-refundable once a deal is released or otherwise resolved, including if a dispute is resolved in the buyer's favor.</p>

        <h2 id="currency">7. Currency &amp; Conversion</h2>
        <p>Deals can be listed in more than one currency. Our payment processor, however, may only be set up to actually charge cards and mobile money in one currency at a time. If a deal you're accepting is listed in a currency our processor isn't currently charging in directly, your payment is automatically converted to a supported currency using the prevailing exchange rate at the moment you pay, and that converted amount — shown to you before you confirm payment — is what's actually charged to your card or mobile money account. This does not change the deal's price for the seller: sellers always receive the full amount in the deal's original listed currency, regardless of what currency the buyer was actually charged in.</p>

        <h2 id="payouts">8. Seller Payouts</h2>
        <p>When a deal you sold is released, the amount is added to your available balance inside Middleman — it isn't sent to your bank account or mobile money automatically. To receive it, you first add a payout method (mobile money number or bank account details, appropriate to your country) in your profile, then request a payout from your available balance. Our team processes payout requests manually and sends the money to the account you've provided; this is not instant, and we're not responsible for delays, errors, or losses caused by incorrect payout details you've provided.</p>

        <h2 id="responsibilities">9. Your Responsibilities</h2>
        <p>When using Middleman, you agree to: provide accurate information about yourself, including during identity verification and when setting up a payout method; describe anything you list for sale honestly and completely; only accept deals you genuinely intend to pay for, and only create deals you genuinely intend to fulfill; keep communication about a deal within the app where reasonably possible, so there's a record if something goes wrong; and comply with all laws that apply to you, including any that apply to the specific item or service being bought or sold. You're solely responsible for the legality of what you buy or sell — Middleman holding payment for a transaction is not an endorsement that the transaction itself is lawful.</p>

        <h2 id="prohibited">10. Prohibited Conduct &amp; Fraud</h2>
        <p>You may not use Middleman to defraud, scam, or deceive another user. This includes, without limitation: listing an item or service you don't intend to actually provide; sending an item that doesn't match what was described in order to collect payment anyway; submitting someone else's identity documents, or documents that have been edited or generated; using a selfie that isn't a live photo of yourself; opening a dispute you know to be false in order to get a refund for something you did receive; or attempting to convince the other party to complete payment outside of Middleman, which removes the escrow protection this Service exists to provide.</p>
        <p>Any account found engaging in fraud or attempted fraud may be suspended or permanently banned immediately, without prior notice, and without needing to complete an ongoing deal first. Middleman reserves the right to withhold or reverse any funds connected to a fraudulent transaction, even after they've been marked released. We will report the account holder and all identifying information available to us — including submitted ID documents, transaction records, and communications — to law enforcement for investigation and criminal prosecution where we believe fraud has occurred. By using the Service, you acknowledge and accept that fraudulent activity may be referred to the police, and you will not be notified in advance of such a referral.</p>

        <h2 id="disputes">11. Disputes</h2>
        <p>If a buyer has a problem with a deal — the item never arrived, doesn't match what was described, or something else went wrong — they can report it instead of confirming delivery. This immediately freezes the deal: the funds cannot be released to the seller by anyone, including the buyer, until our team has reviewed it.</p>
        <p>Once a dispute is open, our team looks at whatever information is available — the deal listing, any messages exchanged in the app, and anything either party wants to submit — and decides whether to release the funds to the seller or refund the buyer. This review is done at our reasonable discretion; we are not a court, we do not guarantee a particular outcome, and our decision on a dispute is final. Middleman is not liable for the outcome of a dispute review, including if either party disagrees with it.</p>

        <h2 id="liability">12. Limitation of Liability</h2>
        <p>The Service is provided "as is" and "as available," without warranties of any kind, express or implied. Middleman acts only as an intermediary that holds and releases funds according to these Terms — we are not responsible for the actions, omissions, honesty, or conduct of any buyer or seller, for the actual condition, quality, or timely delivery of any item or service exchanged, or for any loss arising from a transaction between users, including losses resulting from a user's own negligence, fraud, or violation of these Terms.</p>
        <p>To the fullest extent permitted by law, Middleman and its team are not liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, even if we've been advised of the possibility of such damages. Our total liability for any claim relating to the Service, however framed, is limited to the fee actually paid by you on the specific transaction giving rise to the claim.</p>

        <h2 id="suspension">13. Account Suspension &amp; Termination</h2>
        <p>We may warn, suspend, or permanently ban any account that violates these Terms, at our discretion and without prior notice where we believe it's warranted — for example, in cases of suspected fraud. A banned account loses access to the Service, though this does not automatically resolve any deal already in progress; our team may still need to review and settle it. You may stop using the Service at any time; deals you're already part of remain subject to these Terms until they're resolved (released, refunded, or otherwise closed).</p>

        <h2 id="changes">14. Changes to These Terms</h2>
        <p>We may update these Terms from time to time, including to reflect new features (as we did when the wallet and multi-currency support were added) or to clarify existing language. The "Last updated" date at the top of this page reflects the most recent change. Continued use of the Service after a change means you accept the updated Terms; if you don't agree with a change, you should stop using the Service.</p>

        <h2 id="law">15. Governing Law</h2>
        <p>These Terms are governed by the laws of the Republic of Ghana, without regard to conflict-of-law principles, regardless of the country you're using the Service from.</p>

        <h2 id="contact">16. Contact</h2>
        <p>Questions about these Terms, or about a specific deal, can be sent through the in-app Support chat — a real person on our team will respond.</p>
      </div>
    </div>
  )
}

export default Terms
