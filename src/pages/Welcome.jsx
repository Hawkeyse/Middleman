import { useNavigate, Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Globe, Lock, ShieldCheck, Sparkles, Star } from 'lucide-react'
import './Welcome.css'

const steps = [
  { icon: '/steps/pay.png', tag: '01 · SEND', title: 'You pay Middleman', body: 'Not the seller. Your money moves into your Middleman wallet, locked and untouchable.' },
  { icon: '/steps/hold.png', tag: '02 · HOLD', title: 'We hold it safe', body: 'Seller ships once payment is confirmed. Funds stay locked until you get your package.' },
  { icon: '/steps/checked.png', tag: '03 · RELEASE', title: 'You confirm, we release', body: 'Package don land? One tap and the seller gets paid instantly. Everybody wins.' },
]

const stats = [
  { value: '$2.4M+', label: 'moved safely' },
  { value: '1,200+', label: 'deals closed' },
  { value: '4.9 / 5', label: 'buyer trust' },
]

function Welcome() {
  const navigate = useNavigate()

  return (
    <div className="welcome">
      <div className="hero-viewport">
        <div className="welcome-bg" aria-hidden="true"></div>
        <div className="welcome-scrim" aria-hidden="true"></div>
        <div className="star-field" aria-hidden="true">
          {Array.from({ length: 26 }).map((_, i) => <i key={i} style={{ top: `${(i * 37) % 60}%`, left: `${(i * 53) % 100}%`, animationDelay: `${(i % 7) * 0.6}s`, animationDuration: `${2.4 + (i % 5) * 0.5}s` }}></i>)}
        </div>

        <header className="welcome-nav animate-in">
          <div className="welcome-brand"><img src="/middleman-logo.png" alt="Middleman" /><span>middleman</span></div>
          <nav>
            <a href="#how-it-works">How it works</a>
            <Link className="ghost-button" to="/login">Log in</Link>
            <button className="cta-button" onClick={() => navigate('/signup')}>Get started <ArrowRight size={16} /></button>
          </nav>
        </header>

        <main className="welcome-hero">
          <div className="welcome-copy animate-in" style={{ animationDelay: '80ms' }}>
            <span className="corridor-chip"><Globe size={14} /> WORLDWIDE · ESCROW PROTECTED</span>
            <h1 className="wordmark">MIDDLEMAN</h1>
            <p className="tagline">Pay safe. Receive first.</p>
            <p className="hero-sub">Buying something from a stranger online? Don't send money direct — send it to us. We hold it safe until your package lands, then release it to the seller. Anywhere in the world, no wahala.</p>
            <div className="hero-actions">
              <button className="cta-button large" onClick={() => navigate('/signup')}>Get started — it's free <ArrowRight size={17} /></button>
              <a className="ghost-link" href="#how-it-works">See how it works <ArrowUpRight size={15} /></a>
            </div>
            <div className="hero-stats">
              {stats.map((stat) => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}
            </div>
          </div>

          <div className="hero-card-float animate-in" style={{ animationDelay: '200ms' }}>
            <div className="float-top"><ShieldCheck size={17} /> Deal protected</div>
            <div className="float-amount">$4,250.00<small>held securely</small></div>
            <div className="float-route"><span>GH</span><i></i><span>NG</span></div>
            <div className="float-badge"><Sparkles size={13} /> Funds release on confirmation</div>
          </div>
        </main>
      </div>

      <section className="how-it-works" id="how-it-works">
        <div className="section-intro animate-in">
          <span className="corridor-chip light"><Star size={13} /> HOW IT WORKS</span>
          <h2>Three steps. Zero wahala.</h2>
        </div>
        <div className="steps-grid">
          {steps.map((step, i) => (
            <div className="step-card animate-in" key={step.title} style={{ animationDelay: `${i * 110}ms` }}>
              <div className="step-icon"><img src={step.icon} alt="" /></div>
              <span className="step-tag">{step.tag}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
        <button className="cta-button large center" onClick={() => navigate('/signup')}>Get started — it's free <ArrowRight size={17} /></button>
      </section>

      <footer className="welcome-footer">
        <span>© 2026 Middleman. Built for buyers and sellers everywhere.</span>
        <div className="welcome-footer-links">
          <Link className="ghost-link" to="/terms">Terms of Service</Link>
          <Link className="ghost-link team-link" to="/team" title="Middleman Team" aria-label="Middleman Team"><Lock size={13} /></Link>
          <Link className="ghost-link" to="/login">Log in <ArrowUpRight size={14} /></Link>
        </div>
      </footer>
    </div>
  )
}

export default Welcome
