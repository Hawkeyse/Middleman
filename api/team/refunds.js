import { requireTeam } from '../_lib/requireTeam.js'
import { db } from '../_lib/firebaseAdmin.js'

export default async function handler(req, res) {
  try {
    requireTeam(req)

    if (req.method === 'GET') {
      const snap = await db.collection('refund_requests').get()
      const requests = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''))
      return res.status(200).json({ requests })
    }

    if (req.method === 'POST') {
      const { id } = req.body || {}
      if (!id) return res.status(400).json({ error: 'id is required' })
      const ref = db.collection('refund_requests').doc(id)
      const snap = await ref.get()
      if (!snap.exists) return res.status(404).json({ error: 'Request not found' })
      const completedAt = new Date().toISOString()
      await ref.set({ status: 'completed', completedAt }, { merge: true })
      return res.status(200).json({ request: { id, ...snap.data(), status: 'completed', completedAt } })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}
