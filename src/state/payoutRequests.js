// Seller payout requests — unlike the buyer wallet (src/state/wallet.js),
// a seller's earned balance isn't a ledger they can also spend from inside
// the app, so there's no double-spend risk to guard against by reserving on
// request. The balance only actually drops once the team marks a request
// completed (see Team.jsx, which also logs a 'payout' transaction there).
const KEY = 'mm_payout_requests'

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}
function writeAll(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* still returns the request for this session */ }
}

export function requestPayout({ email, amount, currency, note }) {
  const list = readAll()
  const request = {
    id: `PR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    email, amount: Number(amount) || 0, currency: currency || 'GHS', note: note || '',
    status: 'pending', requestedAt: new Date().toISOString(), completedAt: null,
  }
  list.unshift(request)
  writeAll(list)
  return request
}

export function listPayoutRequests() {
  return readAll()
}

export function markPayoutCompleted(id) {
  const list = readAll()
  const idx = list.findIndex((r) => r.id === id)
  if (idx === -1) return null
  list[idx] = { ...list[idx], status: 'completed', completedAt: new Date().toISOString() }
  writeAll(list)
  return list[idx]
}
