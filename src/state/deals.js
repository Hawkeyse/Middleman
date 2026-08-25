import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { authedFetch } from '../utils/authedFetch.js'

// Firestore-backed — see firestore.rules. Cancel/dispute are direct client
// writes (the rules allow exactly those transitions and nothing else);
// create (needs the live exchange rate to price the fee), accept (debits a
// wallet), and release (credits a seller) all go through api/customer.js
// on the server instead.

// Fee is computed server-side against the live exchange rate and locked
// onto the deal there (see api/customer.js's createDeal + src/utils/
// fees.js) — the client only supplies what the seller actually typed.
export async function createDeal({ itemName, amount, currency, image, buyerContact, sellerName }) {
  const { deal } = await authedFetch('/api/customer', { body: { action: 'createDeal', itemName, amount, currency, image, buyerContact, sellerName } })
  return deal
}

export async function getDeal(code) {
  if (!code) return null
  try {
    const snap = await getDoc(doc(db, 'deals', code))
    return snap.exists() ? snap.data() : null
  } catch {
    // A denied read here almost always means the doc doesn't exist — rules
    // can't tell "not found" from "not yours" for a nonexistent doc, since
    // resource.data is null either way — so treat it the same as not found.
    return null
  }
}

export async function listDealsFor(email) {
  if (!email) return []
  const [asSeller, asBuyer] = await Promise.all([
    getDocs(query(collection(db, 'deals'), where('sellerEmail', '==', email))),
    getDocs(query(collection(db, 'deals'), where('buyerEmail', '==', email))),
  ])
  const byCode = new Map()
  for (const snap of [asSeller, asBuyer]) for (const d of snap.docs) byCode.set(d.id, d.data())
  return [...byCode.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

// Debits the buyer's wallet server-side and marks the deal paid.
export async function acceptDeal(code, name) {
  const { deal } = await authedFetch('/api/customer', { body: { action: 'acceptDeal', code, name } })
  return deal
}

// "Confirm delivery" — only the buyer who actually paid can release.
export async function releaseDeal(code) {
  const { deal } = await authedFetch('/api/customer', { body: { action: 'releaseDeal', code } })
  return deal
}

// Only the seller who created the deal can cancel it, and only before a
// buyer has paid — once money's in escrow this has to go through a dispute
// instead, since cancelling would need to unwind a real wallet debit.
export async function cancelDeal(code, sellerEmail) {
  const ref = doc(db, 'deals', code)
  const snap = await getDoc(ref)
  const deal = snap.exists() ? snap.data() : null
  if (!deal || deal.status !== 'pending-acceptance' || deal.sellerEmail !== sellerEmail) return null
  const cancelledAt = new Date().toISOString()
  await updateDoc(ref, { status: 'cancelled', cancelledAt })
  return { ...deal, status: 'cancelled', cancelledAt }
}

// Only the buyer can open a dispute, and only while payment is actually
// sitting in escrow — freezes the deal so it can't be released until the
// team resolves it from /team.
export async function disputeDeal(code, buyerEmail, reason) {
  const ref = doc(db, 'deals', code)
  const snap = await getDoc(ref)
  const deal = snap.exists() ? snap.data() : null
  if (!deal || deal.status !== 'paid' || deal.buyerEmail !== buyerEmail) return null
  const disputedAt = new Date().toISOString()
  await updateDoc(ref, { status: 'disputed', disputeReason: reason || '', disputedAt })
  return { ...deal, status: 'disputed', disputeReason: reason || '', disputedAt }
}
