import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownLeft, ArrowLeft, ArrowUpRight, BadgeCheck, Ban, Check, Flag, Headset, IdCard,
  Lock, Receipt, TriangleAlert, Users as UsersIcon, ZoomIn,
} from 'lucide-react'
import Icon from '../components/Icon.jsx'
import { listThreads, sendMessage, getUnreadCount, markRead, joinThread, closeThread, setTyping, getTypingRole } from '../state/chat.js'
import { teamFetch } from '../utils/teamFetch.js'
import { requestNotifyPermission } from '../utils/notify.js'
import { useChatNotify } from '../hooks/useChatNotify.js'
import { money, symbolFor } from '../utils/currencies.js'
import ChatThread from '../components/ChatThread.jsx'
import './Team.css'

const docLabels = { 'ghana-card': 'Ghana Card', 'national-id': 'National ID Card', passport: 'International Passport', license: "Driver's License" }
const filters = ['pending', 'verified', 'declined', 'all']

function TeamGate({ onUnlock }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  // Verified server-side (api/team.js's login resource) against TEAM_PASSCODE — the old
  // version compared against a passcode sitting in plaintext in the shipped
  // JS bundle, readable by anyone via view-source.
  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setChecking(true)
    try {
      const res = await fetch('/api/team?resource=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-team-passcode': code },
      })
      if (!res.ok) throw new Error()
      sessionStorage.setItem('mm_team_unlocked', 'true')
      sessionStorage.setItem('mm_team_agent_name', name.trim() || 'Middleman Team')
      sessionStorage.setItem('mm_team_code', code)
      onUnlock()
    } catch {
      setError('Wrong passcode.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="team-gate">
      <div className="team-gate-card">
        <div className="team-gate-icon"><Lock size={22} /></div>
        <h2>Middleman Team</h2>
        <p>Staff only. Enter your name and the team passcode to review verifications, users and support chats.</p>
        {error && <div className="team-error">{error}</div>}
        <form onSubmit={submit}>
          <input type="text" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          <input type="password" value={code} onChange={(e) => { setCode(e.target.value); setError('') }} placeholder="Team passcode" />
          <button type="submit" disabled={checking}>{checking ? 'Checking…' : 'Unlock'}</button>
        </form>
        <Link className="team-gate-back" to="/">Back to Middleman</Link>
      </div>
    </div>
  )
}

function Team() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('mm_team_unlocked') === 'true')
  const agentName = sessionStorage.getItem('mm_team_agent_name') || 'Middleman Team'
  const [section, setSection] = useState('verifications')
  const unreadTotal = useChatNotify({ role: 'team', title: 'Middleman Support', active: unlocked })

  const [records, setRecords] = useState([])
  const [filter, setFilter] = useState('pending')
  const [selectedId, setSelectedId] = useState(null)
  const [reasonDraft, setReasonDraft] = useState('')
  const [lightbox, setLightbox] = useState(null)

  const [threads, setThreads] = useState([])
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [customerTyping, setCustomerTyping] = useState(false)

  const [users, setUsers] = useState([])
  const [selectedUserEmail, setSelectedUserEmail] = useState(null)
  const [actionDraft, setActionDraft] = useState('')

  const [transactions, setTransactions] = useState([])

  const [deals, setDeals] = useState([])
  const [disputeFilter, setDisputeFilter] = useState('open')
  const [selectedDealCode, setSelectedDealCode] = useState(null)

  const [refunds, setRefunds] = useState([])
  const [payouts, setPayouts] = useState([])

  const refresh = () => {
    teamFetch('/api/team?resource=verifications').then((data) => setRecords(data.records)).catch(() => {})
    setThreads(listThreads())
    teamFetch('/api/team?resource=users').then((data) => setUsers(data.users)).catch(() => {})
    teamFetch('/api/team?resource=transactions').then((data) => setTransactions(data.transactions)).catch(() => {})
    teamFetch('/api/team?resource=deals').then((data) => setDeals(data.deals)).catch(() => {})
    teamFetch('/api/team?resource=refunds').then((data) => setRefunds(data.requests)).catch(() => {})
    teamFetch('/api/team?resource=payouts').then((data) => setPayouts(data.requests)).catch(() => {})
  }
  useEffect(() => { if (unlocked) { refresh(); requestNotifyPermission() } }, [unlocked])
  useEffect(() => {
    if (!unlocked) return
    window.addEventListener('mm-chat-updated', refresh)
    return () => window.removeEventListener('mm-chat-updated', refresh)
  }, [unlocked])

  useEffect(() => {
    if (!selectedEmail) { setCustomerTyping(false); return }
    const check = () => setCustomerTyping(getTypingRole(selectedEmail, 'team') === 'customer')
    check()
    window.addEventListener('mm-typing-updated', check)
    const id = window.setInterval(check, 1000)
    return () => {
      window.removeEventListener('mm-typing-updated', check)
      window.clearInterval(id)
    }
  }, [selectedEmail])

  // Grouped by currency — a single summed number would mix dollars, cedis and naira.
  const feesByCurrency = {}
  for (const t of transactions) {
    if (t.type === 'deposit' && t.fee != null) {
      const cur = t.currency || 'GHS'
      feesByCurrency[cur] = (feesByCurrency[cur] || 0) + Number(t.fee)
    }
  }
  const totalFeesDisplay = Object.entries(feesByCurrency).map(([cur, val]) => `${symbolFor(cur)} ${money(val)}`).join(' · ') || '₵ 0.00'

  const disputedDeals = deals.filter((d) => d.disputeReason)
  const openDisputeCount = disputedDeals.filter((d) => d.status === 'disputed').length
  const visibleDisputes = disputeFilter === 'all' ? disputedDeals : disputedDeals.filter((d) => (disputeFilter === 'open' ? d.status === 'disputed' : d.status !== 'disputed'))
  const selectedDeal = disputedDeals.find((d) => d.code === selectedDealCode) || null
  const resolve = (decision) => { teamFetch('/api/team?resource=deals', { method: 'POST', body: { code: selectedDealCode, decision } }).then(refresh).catch(() => {}) }

  // Refunds (buyer wallet) and payouts (seller earnings) are different money
  // flows underneath, but the team just wants one queue of "money to send out".
  const withdrawals = [
    ...refunds.map((r) => ({ ...r, kind: 'refund' })),
    ...payouts.map((p) => ({ ...p, kind: 'payout' })),
  ].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
  const pendingRefundCount = withdrawals.filter((r) => r.status === 'pending').length
  const markRefundSent = (id) => { teamFetch('/api/team?resource=refunds', { method: 'POST', body: { id } }).then(refresh).catch(() => {}) }
  const markPayoutSent = (request) => { teamFetch('/api/team?resource=payouts', { method: 'POST', body: { id: request.id } }).then(refresh).catch(() => {}) }

  const visible = filter === 'all' ? records : records.filter((r) => r.status === filter)
  const selected = records.find((r) => r.id === selectedId) || null
  const selectedThread = threads.find((t) => t.email === selectedEmail) || null
  const selectedUser = users.find((u) => u.email === selectedUserEmail) || null

  const approve = (id) => { teamFetch('/api/team?resource=verifications', { method: 'POST', body: { id, status: 'verified' } }).then(refresh).catch(() => {}) }
  const decline = (id) => {
    teamFetch('/api/team?resource=verifications', { method: 'POST', body: { id, status: 'declined', reason: reasonDraft || 'Documents did not pass review.' } }).then(refresh).catch(() => {})
    setReasonDraft('')
  }

  const replyToCustomer = (text, image) => {
    sendMessage(selectedEmail, { from: 'team', text, image })
    refresh()
  }

  const openThread = (email) => { setSelectedEmail(email); markRead(email, 'team'); refresh() }
  const joinChat = (email) => { joinThread(email, agentName); refresh() }
  const closeChat = (email) => { closeThread(email); refresh() }

  const warn = (email) => { teamFetch('/api/team?resource=users', { method: 'POST', body: { action: 'warn', email, reason: actionDraft || 'No reason given.' } }).then(refresh).catch(() => {}); setActionDraft('') }
  const ban = (email) => { teamFetch('/api/team?resource=users', { method: 'POST', body: { action: 'ban', email, reason: actionDraft || 'Violated Middleman terms.' } }).then(refresh).catch(() => {}); setActionDraft('') }
  const unban = (email) => { teamFetch('/api/team?resource=users', { method: 'POST', body: { action: 'unban', email } }).then(refresh).catch(() => {}) }

  if (!unlocked) return <TeamGate onUnlock={() => setUnlocked(true)} />

  return (
    <div className="team-page">
      <header className="team-nav">
        <Link className="team-back-link" to="/"><ArrowLeft size={14} /> Exit</Link>
        <div className="team-brand"><img src="/middleman-logo.png" alt="Middleman" /><span>middleman team</span></div>
        <div className="team-tabs">
          <button className={section === 'verifications' ? 'active' : ''} onClick={() => setSection('verifications')}><IdCard size={14} /> Verifications{records.filter((r) => r.status === 'pending').length > 0 && <i>{records.filter((r) => r.status === 'pending').length}</i>}</button>
          <button className={section === 'users' ? 'active' : ''} onClick={() => setSection('users')}><UsersIcon size={14} /> Users</button>
          <button className={section === 'disputes' ? 'active' : ''} onClick={() => setSection('disputes')}><Flag size={14} /> Disputes{openDisputeCount > 0 && <i>{openDisputeCount}</i>}</button>
          <button className={section === 'refunds' ? 'active' : ''} onClick={() => setSection('refunds')}><Icon name="refund" size={14} /> Withdrawals{pendingRefundCount > 0 && <i>{pendingRefundCount}</i>}</button>
          <button className={section === 'transactions' ? 'active' : ''} onClick={() => setSection('transactions')}><Receipt size={14} /> Transactions</button>
          <button className={section === 'support' ? 'active' : ''} onClick={() => setSection('support')}><Headset size={14} /> Support{unreadTotal > 0 && <i>{unreadTotal}</i>}</button>
        </div>
      </header>

      {section === 'verifications' && (
        <div className={`team-split ${selected ? 'has-selection' : ''}`}>
          <div className="team-list">
            <div className="team-filter-row">
              {filters.map((f) => <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f}</button>)}
            </div>
            {visible.length === 0 && <div className="team-empty">Nothing here.</div>}
            {visible.map((r) => (
              <button key={r.id} className={r.id === selectedId ? 'team-row active' : 'team-row'} onClick={() => setSelectedId(r.id)}>
                <div><b>{r.name || r.email}</b><span>{r.country} · age {r.age}</span></div>
                <span className={`team-badge ${r.status}`}>{r.status}</span>
              </button>
            ))}
          </div>

          <div className="team-detail">
            {!selected ? <div className="team-empty">Select a request to review it.</div> : (
              <>
                <button className="team-detail-back" onClick={() => setSelectedId(null)}><ArrowLeft size={14} /> Back to list</button>
                <div className="team-detail-head">
                  <div><h2>{selected.name || 'Unnamed applicant'}</h2><span>{selected.email}</span></div>
                  <span className={`team-badge large ${selected.status}`}>{selected.status}</span>
                </div>
                <div className="team-detail-meta">
                  <div><small>COUNTRY</small><b>{selected.country || '—'}</b></div>
                  <div><small>AGE</small><b>{selected.age ?? '—'}</b></div>
                  <div><small>DOCUMENT</small><b>{docLabels[selected.docType] || '—'}</b></div>
                  <div><small>DOB</small><b>{selected.dob || '—'}</b></div>
                  <div><small>SUBMITTED</small><b>{selected.submittedAt ? new Date(selected.submittedAt).toLocaleString() : '—'}</b></div>
                </div>
                <div className="team-images">
                  <div><small>DOCUMENT PHOTO</small>{selected.docImage ? <button className="team-image-zoom" onClick={() => setLightbox(selected.docImage)}><img src={selected.docImage} alt="Document" /><span><ZoomIn size={14} /> Click to enlarge</span></button> : <div className="team-image-empty">No image</div>}</div>
                  <div><small>LIVE SELFIE</small>{selected.selfieImage ? <button className="team-image-zoom" onClick={() => setLightbox(selected.selfieImage)}><img src={selected.selfieImage} alt="Selfie" /><span><ZoomIn size={14} /> Click to enlarge</span></button> : <div className="team-image-empty">No image</div>}</div>
                </div>

                {selected.status === 'pending' ? (
                  <div className="team-actions">
                    <input placeholder="Reason if declining (optional)" value={reasonDraft} onChange={(e) => setReasonDraft(e.target.value)} />
                    <div>
                      <button className="team-approve" onClick={() => approve(selected.id)}><Check size={15} /> Approve</button>
                      <button className="team-decline" onClick={() => decline(selected.id)}><Icon name="close" size={15} /> Decline</button>
                    </div>
                  </div>
                ) : (
                  <div className={`team-decision ${selected.status}`}>
                    {selected.status === 'verified' ? <Icon name="verified" size={16} /> : <Icon name="alarm" size={16} />}
                    <span>{selected.status === 'verified' ? 'Approved' : `Declined${selected.reason ? ` — ${selected.reason}` : ''}`}{selected.decidedAt ? ` on ${new Date(selected.decidedAt).toLocaleDateString()}` : ''}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {section === 'users' && (
        <div className={`team-split ${selectedUser ? 'has-selection' : ''}`}>
          <div className="team-list">
            {users.length === 0 && <div className="team-empty">No users yet.</div>}
            {users.map((u) => (
              <button key={u.email} className={u.email === selectedUserEmail ? 'team-row active' : 'team-row'} onClick={() => { setSelectedUserEmail(u.email); setActionDraft('') }}>
                <div><b>{u.name || u.email}</b><span>{u.email}</span></div>
                <span className={`team-badge ${u.status === 'active' ? 'verified' : u.status === 'warned' ? 'pending' : 'declined'}`}>{u.status}</span>
              </button>
            ))}
          </div>

          <div className="team-detail">
            {!selectedUser ? <div className="team-empty">Select a user to warn or ban them.</div> : (
              <>
                <button className="team-detail-back" onClick={() => setSelectedUserEmail(null)}><ArrowLeft size={14} /> Back to list</button>
                <div className="team-detail-head">
                  <div><h2>{selectedUser.name || 'Unnamed user'}</h2><span>{selectedUser.email}{selectedUser.phone ? ` · ${selectedUser.phone}` : ''}</span></div>
                  <span className={`team-badge large ${selectedUser.status === 'active' ? 'verified' : selectedUser.status === 'warned' ? 'pending' : 'declined'}`}>{selectedUser.status}</span>
                </div>

                <div className="team-payout-info">
                  <span className="section-label">PAYOUT METHOD</span>
                  {selectedUser.payoutMethod ? (
                    <p>{selectedUser.payoutMethod.type === 'bank' ? selectedUser.payoutMethod.bankName : `${selectedUser.payoutMethod.network} Mobile Money`} — {selectedUser.payoutMethod.accountNumber} ({selectedUser.payoutMethod.accountName || 'no name on file'})</p>
                  ) : (
                    <p className="muted">Not added yet — can't sell until they add one.</p>
                  )}
                </div>

                {selectedUser.status === 'banned' ? (
                  <div className="team-decision declined"><Ban size={16} /><span>Banned{selectedUser.banReason ? ` — ${selectedUser.banReason}` : ''}{selectedUser.bannedAt ? ` on ${new Date(selectedUser.bannedAt).toLocaleDateString()}` : ''}</span></div>
                ) : (
                  <div className="team-actions">
                    <input placeholder="Reason for warning or ban" value={actionDraft} onChange={(e) => setActionDraft(e.target.value)} />
                    <div>
                      <button className="team-warn" onClick={() => warn(selectedUser.email)}><TriangleAlert size={15} /> Warn</button>
                      <button className="team-decline" onClick={() => ban(selectedUser.email)}><Ban size={15} /> Ban</button>
                    </div>
                  </div>
                )}
                {selectedUser.status === 'banned' && <button className="team-unban" onClick={() => unban(selectedUser.email)}>Lift ban</button>}

                {selectedUser.warnings?.length > 0 && (
                  <div className="team-warnings">
                    <span className="section-label">WARNING HISTORY</span>
                    {selectedUser.warnings.map((w, i) => <div className="team-warning-row" key={i}><TriangleAlert size={13} /><span>{w.reason}</span><small>{new Date(w.at).toLocaleDateString()}</small></div>)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {section === 'disputes' && (
        <div className={`team-split ${selectedDeal ? 'has-selection' : ''}`}>
          <div className="team-list">
            <div className="team-filter-row">
              {['open', 'resolved', 'all'].map((f) => <button key={f} className={disputeFilter === f ? 'active' : ''} onClick={() => setDisputeFilter(f)}>{f}</button>)}
            </div>
            {visibleDisputes.length === 0 && <div className="team-empty">Nothing here.</div>}
            {visibleDisputes.map((d) => (
              <button key={d.code} className={d.code === selectedDealCode ? 'team-row active' : 'team-row'} onClick={() => setSelectedDealCode(d.code)}>
                <div><b>{d.itemName}</b><span>{d.code} · {d.buyerEmail}</span></div>
                <span className={`team-badge ${d.status === 'disputed' ? 'pending' : d.status === 'released' ? 'verified' : 'declined'}`}>{d.status === 'disputed' ? 'open' : d.status}</span>
              </button>
            ))}
          </div>

          <div className="team-detail">
            {!selectedDeal ? <div className="team-empty">Select a dispute to review it.</div> : (
              <>
                <button className="team-detail-back" onClick={() => setSelectedDealCode(null)}><ArrowLeft size={14} /> Back to list</button>
                <div className="team-detail-head">
                  <div><h2>{selectedDeal.itemName}</h2><span>{selectedDeal.code}</span></div>
                  <span className={`team-badge large ${selectedDeal.status === 'disputed' ? 'pending' : selectedDeal.status === 'released' ? 'verified' : 'declined'}`}>{selectedDeal.status === 'disputed' ? 'open' : selectedDeal.status}</span>
                </div>
                <div className="team-detail-meta">
                  <div><small>AMOUNT</small><b>{symbolFor(selectedDeal.currency)} {money(selectedDeal.amount)}</b></div>
                  <div><small>BUYER</small><b>{selectedDeal.buyerName || selectedDeal.buyerEmail}</b></div>
                  <div><small>SELLER</small><b>{selectedDeal.sellerName || selectedDeal.sellerEmail}</b></div>
                  <div><small>REPORTED</small><b>{selectedDeal.disputedAt ? new Date(selectedDeal.disputedAt).toLocaleString() : '—'}</b></div>
                </div>
                <div className="team-payout-info">
                  <span className="section-label">BUYER'S REPORT</span>
                  <p>{selectedDeal.disputeReason || '—'}</p>
                </div>

                {selectedDeal.status === 'disputed' ? (
                  <div className="team-actions">
                    <div>
                      <button className="team-approve" onClick={() => resolve('release')}><Check size={15} /> Release to seller</button>
                      <button className="team-decline" onClick={() => resolve('refund')}><Icon name="close" size={15} /> Refund buyer</button>
                    </div>
                  </div>
                ) : (
                  <div className={`team-decision ${selectedDeal.status === 'released' ? 'verified' : 'declined'}`}>
                    {selectedDeal.status === 'released' ? <BadgeCheck size={16} /> : <Icon name="alarm" size={16} />}
                    <span>{selectedDeal.status === 'released' ? 'Resolved — released to seller' : 'Resolved — refunded to buyer'}{selectedDeal.resolvedAt ? ` on ${new Date(selectedDeal.resolvedAt).toLocaleDateString()}` : ''}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {section === 'refunds' && (
        <div className="team-tx-page">
          {withdrawals.length === 0 ? <div className="team-empty">No withdrawal requests yet.</div> : (
            <div className="team-tx-list">
              {withdrawals.map((r) => (
                <div className="team-tx-row" key={r.id}>
                  <span className="activity-icon orange"><Icon name="refund" size={16} /></span>
                  <div>
                    <b>{symbolFor(r.currency)} {money(r.amount)} <span className="team-tx-fee">{r.kind === 'payout' ? 'seller payout' : 'buyer refund'}</span></b>
                    <span>{r.email}{r.note ? ` · ${r.note}` : ''}</span>
                  </div>
                  <span className="team-tx-date">{new Date(r.requestedAt).toLocaleString()}</span>
                  {r.status === 'pending'
                    ? <button className="team-approve" onClick={() => (r.kind === 'payout' ? markPayoutSent(r) : markRefundSent(r.id))}><Check size={14} /> Mark as sent</button>
                    : <span className="team-badge verified">sent</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'transactions' && (
        <div className="team-tx-page">
          <div className="team-revenue-banner">
            <div><span>TOTAL FEES COLLECTED</span><strong>{totalFeesDisplay}</strong></div>
            <div className="team-revenue-note">Settles into the Middleman Paystack balance automatically. Manually reconcile to <b>Telecel MoMo 233 504 919 423</b>.</div>
          </div>
          {transactions.length === 0 ? <div className="team-empty">No transactions yet.</div> : (
            <div className="team-tx-list">
              {transactions.map((t) => (
                <div className="team-tx-row" key={t.id}>
                  <span className={t.type === 'deposit' ? 'activity-icon blue' : 'activity-icon green'}>{t.type === 'deposit' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
                  <div>
                    <b>{t.itemName}</b>
                    <span>{t.dealCode} · {t.buyerEmail} → {t.sellerEmail}</span>
                    {t.type === 'deposit' && t.fee != null && <span className="team-tx-fee">Received {symbolFor(t.currency)}{money(t.amount)} · fee {symbolFor(t.currency)}{money(t.fee)} · seller gets {symbolFor(t.currency)}{money(t.sellerPayout)}</span>}
                    {t.chargedCurrency && t.chargedCurrency !== t.currency && <span className="team-tx-fee">Actually charged {symbolFor(t.chargedCurrency)}{money(t.chargedAmount)} via Paystack (converted from {t.currency})</span>}
                  </div>
                  <span className="team-tx-date">{new Date(t.at).toLocaleString()}</span>
                  <strong>{symbolFor(t.currency)} {money(t.amount)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'support' && (
        <div className={`team-split ${selectedThread ? 'has-selection' : ''}`}>
          <div className="team-list">
            {threads.length === 0 && <div className="team-empty">No conversations yet.</div>}
            {threads.map((t) => {
              const unread = getUnreadCount(t.email, 'team')
              return (
                <button key={t.email} className={t.email === selectedEmail ? 'team-row active' : 'team-row'} onClick={() => openThread(t.email)}>
                  <div><b>{t.name || t.email}</b><span>{t.messages[t.messages.length - 1]?.text.slice(0, 40) || ''}</span></div>
                  {unread > 0 ? <i className="team-unread">{unread}</i> : t.status === 'waiting' ? <span className="team-badge pending">waiting</span> : t.status === 'closed' ? <Icon name="pending" size={13} /> : <span className="team-badge verified">active</span>}
                </button>
              )
            })}
          </div>
          <div className="team-detail team-chat-detail">
            {!selectedThread ? <div className="team-empty">Select a conversation.</div> : (
              <>
                <div className="team-detail-head">
                  <button className="team-detail-back chat-back" onClick={() => setSelectedEmail(null)}><ArrowLeft size={14} /></button>
                  <div><h2>{selectedThread.name || selectedThread.email}</h2><span>{selectedThread.email}</span></div>
                  {selectedThread.status === 'active' && <button className="chat-close-button" onClick={() => closeChat(selectedThread.email)}><Icon name="close" size={13} /> <span>Close ticket</span></button>}
                </div>
                <ChatThread
                  messages={selectedThread.messages}
                  onSend={replyToCustomer}
                  selfRole="team"
                  placeholder="Reply as Middleman team…"
                  onTyping={() => setTyping(selectedThread.email, 'team')}
                  typingLabel={customerTyping ? `${selectedThread.name || 'Customer'} is typing` : null}
                  footer={selectedThread.status === 'waiting'
                    ? <div className="chat-join-row"><button className="chat-join-button" onClick={() => joinChat(selectedThread.email)}><Headset size={15} /> Join chat</button></div>
                    : selectedThread.status === 'closed'
                      ? <div className="chat-closed-row">Ticket closed — reply to reopen it.</div>
                      : undefined}
                />
              </>
            )}
          </div>
        </div>
      )}

      {lightbox && (
        <div className="lightbox-backdrop" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)} aria-label="Close"><Icon name="close" size={20} /></button>
          <img src={lightbox} alt="Full size" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}

export default Team
