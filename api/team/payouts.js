import { requireTeam } from '../_lib/requireTeam.js'
import { db } from '../_lib/firebaseAdmin.js'

export default async function handler(req, res) {
  try {
    requireTeam(req)

    if (req.method === 'GET') {
      const snap = await db.collection('payout_requests').get()
      const requests = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''))
      return res.status(200).json({ requests })
    }

    if (req.method === 'POST') {
      const { id } = req.body || {}
      if (!id) return res.status(400).json({ error: 'id is required' })
      const ref = db.collection('payout_requests').doc(id)
      const snap = await ref.get()
      if (!snap.exists) return res.status(404).json({ error: 'Request not found' })
      const request = snap.data()
      const completedAt = new Date().toISOString()

      const batch = db.batch()
      batch.set(ref, { status: 'completed', completedAt }, { merge: true })
      batch.set(db.collection('transactions').doc(), {
        type: 'payout', dealCode: null, itemName: 'Wallet payout', amount: request.amount, currency: request.currency,
        chargedAmount: null, chargedCurrency: null, fee: null, sellerPayout: null,
        buyerEmail: null, sellerEmail: request.email, counterparty: 'Middleman', at: completedAt,
      })
      await batch.commit()

      return res.status(200).json({ request: { id, ...request, status: 'completed', completedAt } })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}
