import { requireTeam } from '../_lib/requireTeam.js'
import { db } from '../_lib/firebaseAdmin.js'

// List every deal (for the disputes queue) and resolve a dispute — team-only,
// so admin-SDK only, same as everything else team-side.
export default async function handler(req, res) {
  try {
    requireTeam(req)

    if (req.method === 'GET') {
      const snap = await db.collection('deals').get()
      const deals = snap.docs.map((d) => d.data()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      return res.status(200).json({ deals })
    }

    if (req.method === 'POST') {
      const { code, decision } = req.body || {}
      if (!code || !['release', 'refund'].includes(decision)) return res.status(400).json({ error: 'code and a valid decision are required' })

      const dealRef = db.collection('deals').doc(code)
      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(dealRef)
        if (!snap.exists) throw Object.assign(new Error('Deal not found'), { status: 404 })
        const deal = snap.data()
        if (deal.status !== 'disputed') throw Object.assign(new Error('This deal is not under dispute.'), { status: 409 })

        const resolvedAt = new Date().toISOString()
        const status = decision === 'release' ? 'released' : 'refunded'
        tx.update(dealRef, { status, disputeResolution: decision, resolvedAt })

        // 'refund' is handled manually outside the app (see Dashboard's
        // dispute-note copy) — only 'release' pays out through the app, so
        // only that one needs a transaction logged for it to show up in the
        // seller's balance.
        if (decision === 'release') {
          tx.set(db.collection('transactions').doc(), {
            type: 'release', dealCode: code, itemName: deal.itemName, amount: deal.sellerPayout ?? deal.amount, currency: deal.currency,
            chargedAmount: null, chargedCurrency: null, fee: null, sellerPayout: null,
            buyerEmail: deal.buyerEmail, sellerEmail: deal.sellerEmail, counterparty: deal.sellerName, at: resolvedAt,
          })
        }

        return { ...deal, status, disputeResolution: decision, resolvedAt }
      })

      return res.status(200).json({ deal: result })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}
