const STORAGE_KEY = 'mm_users'

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

function writeAll(users) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users))
  } catch {
    // storage unavailable — still returns the record for the current session
  }
}

// Registers/updates the directory entry for a user — called on every
// signup/login so the team has someone to warn/ban even before they've
// filed a verification request or opened a support chat.
export function upsertUser({ email, name, phone }) {
  if (!email) return null
  const all = readAll()
  const existing = all[email]
  all[email] = {
    email,
    name: name || existing?.name || '',
    phone: phone || existing?.phone || '',
    status: existing?.status || 'active', // 'active' | 'warned' | 'banned'
    warnings: existing?.warnings || [],
    banReason: existing?.banReason || null,
    bannedAt: existing?.bannedAt || null,
    payoutMethod: existing?.payoutMethod || null, // { type: 'momo'|'bank', network/bankName, accountNumber, accountName }
    createdAt: existing?.createdAt || new Date().toISOString(),
  }
  writeAll(all)
  return all[email]
}

// Where a seller's share of released escrow gets manually paid out to —
// there's no live Paystack Transfer wired up yet (see api/paystack/), so the
// team reconciles payouts by hand using what's on file here.
export function setPayoutMethod(email, method) {
  const all = readAll()
  if (!all[email]) return null
  all[email] = { ...all[email], payoutMethod: method }
  writeAll(all)
  return all[email]
}

export function getUser(email) {
  if (!email) return null
  return readAll()[email] || null
}

export function listUsers() {
  return Object.values(readAll()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function warnUser(email, reason) {
  const all = readAll()
  if (!all[email]) return null
  all[email].status = 'warned'
  all[email].warnings = [...(all[email].warnings || []), { reason: reason || 'No reason given.', at: new Date().toISOString() }]
  writeAll(all)
  return all[email]
}

export function banUser(email, reason) {
  const all = readAll()
  if (!all[email]) return null
  all[email].status = 'banned'
  all[email].banReason = reason || 'Violated Middleman terms.'
  all[email].bannedAt = new Date().toISOString()
  writeAll(all)
  return all[email]
}

export function unbanUser(email) {
  const all = readAll()
  if (!all[email]) return null
  all[email].status = 'active'
  all[email].banReason = null
  all[email].bannedAt = null
  writeAll(all)
  return all[email]
}
