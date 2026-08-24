import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase.js'

// Firestore-backed — see firestore.rules. Never written by the client:
// deposits/releases/payouts all get logged server-side (see
// api/deals/accept.js, api/deals/release.js, api/team/payouts.js) alongside
// the money movement they record, so there's no separate client-side write.

export async function listTransactionsFor(email) {
  if (!email) return []
  const [asBuyer, asSeller] = await Promise.all([
    getDocs(query(collection(db, 'transactions'), where('buyerEmail', '==', email))),
    getDocs(query(collection(db, 'transactions'), where('sellerEmail', '==', email))),
  ])
  const byId = new Map()
  for (const snap of [asBuyer, asSeller]) for (const d of snap.docs) byId.set(d.id, { id: d.id, ...d.data() })
  return [...byId.values()].sort((a, b) => new Date(b.at) - new Date(a.at))
}
