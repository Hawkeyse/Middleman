import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { calcFee } from '../utils/fees.js'
import { authedFetch } from '../utils/authedFetch.js'

// Firestore-backed — see firestore.rules. Create/cancel/dispute are direct
// client writes (the rules allow exactly those transitions and nothing
// else); accept (debits a wallet) and release (credits a seller) go through
// api/deals/*.js on the server instead, since wallet_entries/transactions
// are server-write-only.

function genCode() {
  const rand = () => Math.random().toString(36).slice(2, 6).toUpperCase()
  return `MDM-${rand()}-${rand().slice(0, 2)}`
}

export async function createDeal({ itemName, amount, currency, image, buyerContact, sellerName, sellerEmail }) {
  const { feeRate, fee, buyerTotal, sellerPayout } = calcFee(amount, currency)

  // No pre-write collision check: reading a deals/{code} doc that doesn't
  // exist yet would hit the same security rule as reading someone else's
  // deal (resource is null, so resource.data.inviteType errors out and gets
  // denied) — there's no way to distinguish "doesn't exist" from "not mine"
  // from the client. The code space (36^4 * 36^2) makes a collision
  // astronomically unlikely in practice.
  const code = genCode()

  const deal = {
    code, itemName, amount, currency: currency || 'GHS', image: image || null, buyerContact: buyerContact || '', sellerName, sellerEmail,
    feeRate, fee, buyerTotal, sellerPayout, inviteType: 'link',
    createdAt: new Date().toISOString(), status: 'pending-acceptance',
  }
  await setDoc(doc(db, 'deals', code), deal)
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
  const { deal } = await authedFetch('/api/deals/accept', { body: { code, name } })
  return deal
}

// "Confirm delivery" — only the buyer who actually paid can release.
export async function releaseDeal(code) {
  const { deal } = await authedFetch('/api/deals/release', { body: { code } })
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
