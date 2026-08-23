// Buyer wallet — buyers pre-fund a balance (real Paystack payment, see
// Dashboard's deposit flow), then accepting a deal just debits this ledger
// instead of triggering a fresh charge at accept-time. Same localStorage-as-
// backend-stand-in caveat as deals.js/transactions.js.
const LEDGER_KEY = 'mm_wallet_ledger'
const REFUNDS_KEY = 'mm_wallet_refunds'

function readLedger() {
  try { return JSON.parse(localStorage.getItem(LEDGER_KEY)) || [] } catch { return [] }
}
function writeLedger(list) {
  try { localStorage.setItem(LEDGER_KEY, JSON.stringify(list)) } catch { /* still returns the entry for this session */ }
}
function readRefunds() {
  try { return JSON.parse(localStorage.getItem(REFUNDS_KEY)) || [] } catch { return [] }
}
function writeRefunds(list) {
  try { localStorage.setItem(REFUNDS_KEY, JSON.stringify(list)) } catch { /* still returns the entry for this session */ }
}

// type: 'deposit' (buyer tops up, adds to balance) | 'spend' (buyer accepted
// a deal, subtracts) | 'refund' (leaving the wallet back to the buyer,
// subtracts — logged the moment a refund is *requested*, not when the team
// finishes it, so the money can't be spent twice while a request is pending).
export function logWalletEntry({ email, type, amount, currency, dealCode, note }) {
  const list = readLedger()
  const entry = {
    id: `WL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    email, type, amount: Number(amount) || 0, currency: currency || 'GHS', dealCode: dealCode || null, note: note || '',
    at: new Date().toISOString(),
  }
  list.unshift(entry)
  writeLedger(list)
  return entry
}

export function getWalletBalance(email, currency) {
  if (!email) return 0
  return readLedger()
    .filter((e) => e.email === email && (e.currency || 'GHS') === currency)
    .reduce((sum, e) => sum + (e.type === 'deposit' ? e.amount : -e.amount), 0)
}

export function listWalletEntries(email) {
  if (!email) return []
  return readLedger().filter((e) => e.email === email)
}

// ---- refund requests — manual, team-processed (see /team) ----
export function requestRefund({ email, amount, currency, note }) {
  const entry = logWalletEntry({ email, type: 'refund', amount, currency, note })
  const requests = readRefunds()
  const request = { id: entry.id, email, amount: entry.amount, currency: entry.currency, note: entry.note, status: 'pending', requestedAt: entry.at, completedAt: null }
  requests.unshift(request)
  writeRefunds(requests)
  return request
}

export function listRefundRequests() {
  return readRefunds()
}

export function completeRefund(id) {
  const requests = readRefunds()
  const idx = requests.findIndex((r) => r.id === id)
  if (idx === -1) return null
  requests[idx] = { ...requests[idx], status: 'completed', completedAt: new Date().toISOString() }
  writeRefunds(requests)
  return requests[idx]
}
