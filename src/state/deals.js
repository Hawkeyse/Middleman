import { calcFee } from '../utils/fees.js'

const STORAGE_KEY = 'mm_deals'

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

function writeAll(deals) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deals))
  } catch {
    // storage unavailable — deal still works for the current session via return value
  }
}

function genCode() {
  const rand = () => Math.random().toString(36).slice(2, 6).toUpperCase()
  return `MDM-${rand()}-${rand().slice(0, 2)}`
}

// NOTE: this is a localStorage stand-in for a real backend. It only works in the
// browser that created the deal — a production version needs a server so the
// buyer can open the invite from any device.
export function createDeal({ itemName, amount, image, buyerContact, sellerName, sellerEmail }) {
  const deals = readAll()
  let code = genCode()
  while (deals[code]) code = genCode()
  const { feeRate, fee, buyerTotal, sellerPayout } = calcFee(amount)
  deals[code] = {
    code, itemName, amount, image: image || null, buyerContact: buyerContact || '', sellerName, sellerEmail,
    feeRate, fee, buyerTotal, sellerPayout,
    createdAt: new Date().toISOString(), status: 'pending-acceptance',
  }
  writeAll(deals)
  return deals[code]
}

export function getDeal(code) {
  return readAll()[code] || null
}

export function listDealsFor(email) {
  if (!email) return []
  return Object.values(readAll())
    .filter((d) => d.sellerEmail === email || d.buyerEmail === email)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export function markDealPaid(code, buyerEmail, buyerName) {
  const deals = readAll()
  if (!deals[code]) return null
  deals[code] = { ...deals[code], status: 'paid', buyerEmail, buyerName: buyerName || '', paidAt: new Date().toISOString() }
  writeAll(deals)
  return deals[code]
}

// Only the buyer who actually paid can release — this is the "confirm delivery"
// action. No real payout happens yet; it just marks escrow as settled.
export function releaseDeal(code, buyerEmail) {
  const deals = readAll()
  const deal = deals[code]
  if (!deal || deal.status !== 'paid' || deal.buyerEmail !== buyerEmail) return null
  deals[code] = { ...deal, status: 'released', releasedAt: new Date().toISOString() }
  writeAll(deals)
  return deals[code]
}

export function listAllDeals() {
  return Object.values(readAll()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

// Only the buyer can open a dispute, and only while payment is actually
// sitting in escrow — freezes the deal so it can't be released until the
// team resolves it from /team.
export function disputeDeal(code, buyerEmail, reason) {
  const deals = readAll()
  const deal = deals[code]
  if (!deal || deal.status !== 'paid' || deal.buyerEmail !== buyerEmail) return null
  deals[code] = { ...deal, status: 'disputed', disputeReason: reason || '', disputedAt: new Date().toISOString() }
  writeAll(deals)
  return deals[code]
}

// Team-only — bypasses the buyer-must-release rule since this is an
// authorized manual decision made from /team, not the buyer's own action.
// decision: 'release' (pay the seller anyway) | 'refund' (buyer was right —
// refund happens manually outside the app for now, this just records it).
export function resolveDispute(code, decision) {
  const deals = readAll()
  const deal = deals[code]
  if (!deal || deal.status !== 'disputed') return null
  const status = decision === 'release' ? 'released' : 'refunded'
  deals[code] = { ...deal, status, disputeResolution: decision, resolvedAt: new Date().toISOString() }
  writeAll(deals)
  return deals[code]
}
