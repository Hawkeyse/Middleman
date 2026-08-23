const STORAGE_KEY = 'mm_transactions'

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []
  } catch {
    return []
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // storage unavailable — still returns the record for the current session
  }
}

// type: 'deposit' (buyer pays into escrow, amount includes the Middleman fee)
//     | 'release' (escrow pays the seller their full listed amount)
export function logTransaction({ type, dealCode, itemName, amount, fee, sellerPayout, buyerEmail, sellerEmail, counterparty }) {
  const list = readAll()
  const tx = {
    id: `TX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    type, dealCode, itemName, amount, fee: fee ?? null, sellerPayout: sellerPayout ?? null, buyerEmail, sellerEmail, counterparty,
    at: new Date().toISOString(),
  }
  list.unshift(tx)
  writeAll(list)
  return tx
}

export function listTransactionsFor(email) {
  return readAll().filter((t) => t.buyerEmail === email || t.sellerEmail === email)
}

export function listAllTransactions() {
  return readAll()
}
