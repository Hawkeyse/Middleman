import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { authedFetch } from '../utils/authedFetch.js'

// Firestore-backed — see firestore.rules. wallet_entries is server-write-only
// (crediting a deposit, debiting a spend/refund — all real money moves), so
// every write here goes through a server route; only the balance read stays
// a direct client query.

export async function getWalletBalance(email, currency) {
  if (!email) return 0
  const snap = await getDocs(query(collection(db, 'wallet_entries'), where('email', '==', email), where('currency', '==', currency)))
  let balance = 0
  snap.forEach((d) => {
    const e = d.data()
    balance += e.type === 'deposit' ? e.amount : -e.amount
  })
  return balance
}

// Credits the wallet after a real, provider-verified payment.
export async function creditDeposit(provider, reference) {
  const { entry } = await authedFetch('/api/customer', { body: { action: 'depositWallet', provider, reference } })
  return entry
}

// Pulls unused wallet balance back out — handled manually by the team, not
// automatically; this just files the request.
export async function requestRefund({ amount, currency, note }) {
  const { request } = await authedFetch('/api/customer', { body: { action: 'refundWallet', amount, currency, note } })
  return request
}
