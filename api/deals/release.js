import { FieldValue } from 'firebase-admin/firestore'
import { requireUser } from '../_lib/requireUser.js'
import { db } from '../_lib/firebaseAdmin.js'

// "Confirm delivery" — only the buyer who actually paid can release, and
// only once. Admin SDK only, since transactions is server-write-only.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const buyerEmail = await requireUser(req)
    const { code } = req.body || {}
    if (!code) return res.status(400).json({ error: 'code is required' })

    const dealRef = db.collection('deals').doc(code)
    const result = await db.runTransaction(async (tx) => {
      const dealSnap = await tx.get(dealRef)
      if (!dealSnap.exists) throw Object.assign(new Error('Deal not found'), { status: 404 })
      const deal = dealSnap.data()
      if (deal.status !== 'paid' || deal.buyerEmail !== buyerEmail) {
        throw Object.assign(new Error('You cannot release this deal.'), { status: 403 })
      }

      const releasedAt = new Date().toISOString()
      tx.update(dealRef, { status: 'released', releasedAt })
      tx.set(db.collection('transactions').doc(), {
        type: 'release', dealCode: code, itemName: deal.itemName, amount: deal.sellerPayout ?? deal.amount, currency: deal.currency,
        chargedAmount: null, chargedCurrency: null, fee: null, sellerPayout: null,
        buyerEmail: deal.buyerEmail, sellerEmail: deal.sellerEmail, counterparty: deal.sellerName, at: releasedAt,
      })
      // Public-profile stat (see api/users/rename.js's public_profiles doc) —
      // best-effort merge, doesn't fail the release if the seller predates
      // public profiles somehow.
      tx.set(db.collection('public_profiles').doc(deal.sellerEmail), { completedDealsCount: FieldValue.increment(1) }, { merge: true })

      return { ...deal, status: 'released', releasedAt }
    })

    res.status(200).json({ deal: result })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}
