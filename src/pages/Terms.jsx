import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import './Terms.css'

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

        <p>These Terms of Service ("Terms") govern your use of Middleman (the "Service"). By creating an account or using the Service, you agree to these Terms. If you don't agree, don't use the Service.</p>

        <h2>1. What Middleman Is</h2>
        <p>Middleman is an escrow-style intermediary for transactions between a buyer and a seller. When a buyer pays into a deal, funds are held by Middleman and are released to the seller only once the buyer confirms delivery, or once a reported dispute is resolved by our team. Middleman is not a party to the underlying sale of goods or services between buyer and seller, and does not guarantee the quality, safety, legality, or accuracy of any item or listing.</p>

        <h2>2. Fees</h2>
        <p>Middleman charges a service fee on each transaction, calculated as a percentage of the listed price (subject to a minimum fee), shown to the buyer before payment is made. The fee is paid by the buyer in addition to the listed price; the seller receives the full listed amount when funds are released. Fees are non-refundable once a transaction is released or otherwise resolved.</p>

        <h2>3. Your Responsibilities</h2>
        <p>You agree to provide accurate information about yourself and any item or service you list, complete identity verification truthfully when required, and use the Service only for legitimate transactions you intend to honor. You're responsible for everything that happens under your account.</p>

        <h2>4. Prohibited Conduct &amp; Fraud</h2>
        <p>You may not use Middleman to defraud, scam, or deceive another user — including but not limited to listing items you don't intend to ship, misrepresenting an item, submitting falsified or someone else's identity documents, or attempting to move a deal's payment outside of Middleman to bypass escrow protection.</p>
        <p>Any account found engaging in fraud or attempted fraud may be suspended or permanently banned immediately, without prior notice. Middleman reserves the right to withhold or reverse any funds connected to a fraudulent transaction, and to report the account holder and all available identifying information to law enforcement for investigation and criminal prosecution. By using the Service, you acknowledge that fraudulent activity may be referred to the police.</p>

        <h2>5. Disputes</h2>
        <p>If a buyer reports a problem with a deal, the funds for that deal are frozen and cannot be released until Middleman's team reviews it. Our team's decision to release the funds to the seller or refund the buyer is made at our reasonable discretion based on the information available, and is final. Middleman is not obligated to resolve a dispute in either party's favor and is not liable for the outcome of that review.</p>

        <h2>6. Limitation of Liability</h2>
        <p>The Service is provided "as is," without warranties of any kind. Middleman acts only as an intermediary holding and releasing funds — we are not responsible for the actions, omissions, or conduct of any buyer or seller, for the condition or delivery of any item exchanged, or for any loss arising from a transaction between users, including losses resulting from a user's own negligence, fraud, or violation of these Terms.</p>
        <p>To the fullest extent permitted by law, Middleman and its team are not liable for any indirect, incidental, special, or consequential damages arising from your use of the Service. Our total liability for any claim relating to the Service is limited to the fee actually paid by you on the transaction giving rise to the claim.</p>

        <h2>7. Account Suspension &amp; Termination</h2>
        <p>We may warn, suspend, or permanently ban any account that violates these Terms, at our discretion. You can stop using the Service at any time; deals already in progress remain subject to these Terms until resolved.</p>

        <h2>8. Changes to These Terms</h2>
        <p>We may update these Terms from time to time. Continued use of the Service after a change means you accept the updated Terms.</p>

        <h2>9. Governing Law</h2>
        <p>These Terms are governed by the laws of the Republic of Ghana, without regard to conflict-of-law principles.</p>

        <h2>10. Contact</h2>
        <p>Questions about these Terms can be sent through the in-app Support chat.</p>
      </div>
    </div>
  )
}

export default Terms
