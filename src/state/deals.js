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
  deals[code] = { code, itemName, amount, image: image || null, buyerContact: buyerContact || '', sellerName, sellerEmail, createdAt: new Date().toISOString(), status: 'pending-acceptance' }
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
