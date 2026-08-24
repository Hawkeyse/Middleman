import { requireUser } from '../_lib/requireUser.js'
import { db } from '../_lib/firebaseAdmin.js'

// Accepting a deal spends straight from the buyer's Middleman wallet — admin
// SDK only, since wallet_entries/transactions are server-write-only (see
// firestore.rules) and balance-check + debit + flipping the deal to paid all
// have to happen atomically in one transaction.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const buyerEmail = await requireUser(req)
    const { code, name } = req.body || {}
    if (!code) return res.status(400).json({ error: 'code is required' })

    const dealRef = db.collection('deals').doc(code)
    const result = await db.runTransaction(async (tx) => {
      const dealSnap = await tx.get(dealRef)
      if (!dealSnap.exists) throw Object.assign(new Error('Deal not found'), { status: 404 })
      const deal = dealSnap.data()
      if (deal.status !== 'pending-acceptance') {
        throw Object.assign(new Error('This deal is no longer available.'), { status: 409 })
      }

      const walletQuery = db.collection('wallet_entries').where('email', '==', buyerEmail).where('currency', '==', deal.currency)
      const walletSnap = await tx.get(walletQuery)
      let balance = 0
      walletSnap.forEach((d) => {
        const e = d.data()
        balance += e.type === 'deposit' ? e.amount : -e.amount
      })
      if (balance < deal.buyerTotal) throw Object.assign(new Error('Insufficient wallet balance.'), { status: 402 })

      const at = new Date().toISOString()
      tx.set(db.collection('wallet_entries').doc(), {
        email: buyerEmail, type: 'spend', amount: deal.buyerTotal, currency: deal.currency,
        dealCode: code, note: '', at,
      })
      tx.set(db.collection('transactions').doc(), {
        type: 'deposit', dealCode: code, itemName: deal.itemName, amount: deal.buyerTotal, currency: deal.currency,
        chargedAmount: null, chargedCurrency: null, fee: deal.fee ?? null, sellerPayout: deal.sellerPayout ?? null,
        buyerEmail, sellerEmail: deal.sellerEmail, counterparty: deal.sellerName, at,
      })
      tx.update(dealRef, { status: 'paid', buyerEmail, buyerName: name || '', paidAt: at })

      return { ...deal, status: 'paid', buyerEmail, buyerName: name || '', paidAt: at }
    })

    res.status(200).json({ deal: result })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}
