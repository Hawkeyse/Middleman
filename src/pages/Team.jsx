import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownLeft, ArrowLeft, ArrowUpRight, BadgeCheck, Ban, Check, Clock, Headset, IdCard,
  Lock, Receipt, ShieldAlert, TriangleAlert, Users as UsersIcon, X,
} from 'lucide-react'
import { listVerifications, setVerificationStatus } from '../state/verifications.js'
import { listThreads, sendMessage, getUnreadCount, markRead } from '../state/chat.js'
import { listUsers, warnUser, banUser, unbanUser } from '../state/users.js'
import { listAllTransactions } from '../state/transactions.js'
import { requestNotifyPermission } from '../utils/notify.js'
import { useChatNotify } from '../hooks/useChatNotify.js'
import ChatThread from '../components/ChatThread.jsx'
import './Team.css'

const PASSCODE = 'middleman-team' // demo-only gate — real deployment needs proper admin auth
const docLabels = { 'ghana-card': 'Ghana Card', 'national-id': 'National ID Card', passport: 'International Passport', license: "Driver's License" }
const filters = ['pending', 'verified', 'declined', 'all']
const money = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function TeamGate({ onUnlock }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (code === PASSCODE) {
      sessionStorage.setItem('mm_team_unlocked', 'true')
      onUnlock()
    } else {
      setError('Wrong passcode.')
    }
  }

  return (
    <div className="team-gate">
      <div className="team-gate-card">
        <div className="team-gate-icon"><Lock size={22} /></div>
        <h2>Middleman Team</h2>
        <p>Staff only. Enter the team passcode to review verifications, users and support chats.</p>
        {error && <div className="team-error">{error}</div>}
        <form onSubmit={submit}>
          <input type="password" autoFocus value={code} onChange={(e) => { setCode(e.target.value); setError('') }} placeholder="Team passcode" />
          <button type="submit">Unlock</button>
        </form>
        <Link className="team-gate-back" to="/">Back to Middleman</Link>
      </div>
    </div>
  )
}

function Team() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('mm_team_unlocked') === 'true')
  const [section, setSection] = useState('verifications')
  const unreadTotal = useChatNotify({ role: 'team', title: 'Middleman Support', active: unlocked })

  const [records, setRecords] = useState([])
  const [filter, setFilter] = useState('pending')
  const [selectedId, setSelectedId] = useState(null)
  const [reasonDraft, setReasonDraft] = useState('')

  const [threads, setThreads] = useState([])
  const [selectedEmail, setSelectedEmail] = useState(null)

  const [users, setUsers] = useState([])
  const [selectedUserEmail, setSelectedUserEmail] = useState(null)
  const [actionDraft, setActionDraft] = useState('')

  const [transactions, setTransactions] = useState([])

  const refresh = () => {
    setRecords(listVerifications())
    setThreads(listThreads())
    setUsers(listUsers())
    setTransactions(listAllTransactions())
  }
  useEffect(() => { if (unlocked) { refresh(); requestNotifyPermission() } }, [unlocked])
  useEffect(() => {
    if (!unlocked) return
    window.addEventListener('mm-chat-updated', refresh)
    return () => window.removeEventListener('mm-chat-updated', refresh)
  }, [unlocked])

  const totalFees = transactions.filter((t) => t.type === 'deposit' && t.fee != null).reduce((sum, t) => sum + Number(t.fee), 0)

  const visible = filter === 'all' ? records : records.filter((r) => r.status === filter)
  const selected = records.find((r) => r.id === selectedId) || null
  const selectedThread = threads.find((t) => t.email === selectedEmail) || null
  const selectedUser = users.find((u) => u.email === selectedUserEmail) || null

  const approve = (id) => { setVerificationStatus(id, 'verified'); refresh() }
  const decline = (id) => {
    setVerificationStatus(id, 'declined', reasonDraft || 'Documents did not pass review.')
    setReasonDraft('')
    refresh()
  }

  const replyToCustomer = (text) => {
    sendMessage(selectedEmail, { from: 'team', text })
    refresh()
  }

  const openThread = (email) => { setSelectedEmail(email); markRead(email, 'team'); refresh() }

  const warn = (email) => { warnUser(email, actionDraft || 'No reason given.'); setActionDraft(''); refresh() }
  const ban = (email) => { banUser(email, actionDraft || 'Violated Middleman terms.'); setActionDraft(''); refresh() }
  const unban = (email) => { unbanUser(email); refresh() }

  if (!unlocked) return <TeamGate onUnlock={() => setUnlocked(true)} />

  return (
    <div className="team-page">
      <header className="team-nav">
        <Link className="team-back-link" to="/"><ArrowLeft size={14} /> Exit</Link>
        <div className="team-brand"><img src="/middleman-logo.png" alt="Middleman" /><span>middleman team</span></div>
        <div className="team-tabs">
          <button className={section === 'verifications' ? 'active' : ''} onClick={() => setSection('verifications')}><IdCard size={14} /> Verifications{records.filter((r) => r.status === 'pending').length > 0 && <i>{records.filter((r) => r.status === 'pending').length}</i>}</button>
          <button className={section === 'users' ? 'active' : ''} onClick={() => setSection('users')}><UsersIcon size={14} /> Users</button>
          <button className={section === 'transactions' ? 'active' : ''} onClick={() => setSection('transactions')}><Receipt size={14} /> Transactions</button>
          <button className={section === 'support' ? 'active' : ''} onClick={() => setSection('support')}><Headset size={14} /> Support{unreadTotal > 0 && <i>{unreadTotal}</i>}</button>
        </div>
      </header>

      {section === 'verifications' && (
        <div className="team-split">
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
                  <div><small>DOCUMENT PHOTO</small>{selected.docImage ? <img src={selected.docImage} alt="Document" /> : <div className="team-image-empty">No image</div>}</div>
                  <div><small>LIVE SELFIE</small>{selected.selfieImage ? <img src={selected.selfieImage} alt="Selfie" /> : <div className="team-image-empty">No image</div>}</div>
                </div>

                {selected.status === 'pending' ? (
                  <div className="team-actions">
                    <input placeholder="Reason if declining (optional)" value={reasonDraft} onChange={(e) => setReasonDraft(e.target.value)} />
                    <div>
                      <button className="team-approve" onClick={() => approve(selected.id)}><Check size={15} /> Approve</button>
                      <button className="team-decline" onClick={() => decline(selected.id)}><X size={15} /> Decline</button>
                    </div>
                  </div>
                ) : (
                  <div className={`team-decision ${selected.status}`}>
                    {selected.status === 'verified' ? <BadgeCheck size={16} /> : <ShieldAlert size={16} />}
                    <span>{selected.status === 'verified' ? 'Approved' : `Declined${selected.reason ? ` — ${selected.reason}` : ''}`}{selected.decidedAt ? ` on ${new Date(selected.decidedAt).toLocaleDateString()}` : ''}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {section === 'users' && (
        <div className="team-split">
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

      {section === 'transactions' && (
        <div className="team-tx-page">
          <div className="team-revenue-banner">
            <div><span>TOTAL FEES COLLECTED</span><strong>₵ {money(totalFees)}</strong></div>
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
                    {t.type === 'deposit' && t.fee != null && <span className="team-tx-fee">Received ₵{money(t.amount)} · fee ₵{money(t.fee)} · seller gets ₵{money(t.sellerPayout)}</span>}
                  </div>
                  <span className="team-tx-date">{new Date(t.at).toLocaleString()}</span>
                  <strong>₵ {money(t.amount)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'support' && (
        <div className="team-split">
          <div className="team-list">
            {threads.length === 0 && <div className="team-empty">No conversations yet.</div>}
            {threads.map((t) => {
              const unread = getUnreadCount(t.email, 'team')
              return (
                <button key={t.email} className={t.email === selectedEmail ? 'team-row active' : 'team-row'} onClick={() => openThread(t.email)}>
                  <div><b>{t.name || t.email}</b><span>{t.messages[t.messages.length - 1]?.text.slice(0, 40) || ''}</span></div>
                  {unread > 0 ? <i className="team-unread">{unread}</i> : <Clock size={13} />}
                </button>
              )
            })}
          </div>
          <div className="team-detail team-chat-detail">
            {!selectedThread ? <div className="team-empty">Select a conversation.</div> : (
              <>
                <div className="team-detail-head"><div><h2>{selectedThread.name || selectedThread.email}</h2><span>{selectedThread.email}</span></div></div>
                <ChatThread messages={selectedThread.messages} onSend={replyToCustomer} selfRole="team" placeholder="Reply as Middleman team…" />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Team
