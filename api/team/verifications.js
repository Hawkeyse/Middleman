import { requireTeam } from '../_lib/requireTeam.js'
import { db } from '../_lib/firebaseAdmin.js'

// List every verification request and approve/decline one — team-only, so
// admin-SDK only (rules block a client from ever setting its own status to
// verified/declined, see firestore.rules).
export default async function handler(req, res) {
  try {
    requireTeam(req)

    if (req.method === 'GET') {
      const snap = await db.collection('verifications').get()
      const records = snap.docs.map((d) => d.data()).sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))
      return res.status(200).json({ records })
    }

    if (req.method === 'POST') {
      const { id, status, reason } = req.body || {}
      if (!id || !['verified', 'declined'].includes(status)) return res.status(400).json({ error: 'id and a valid status are required' })
      const ref = db.collection('verifications').doc(id)
      const snap = await ref.get()
      if (!snap.exists) return res.status(404).json({ error: 'Request not found' })
      const decidedAt = new Date().toISOString()
      await ref.set({ status, reason: reason || null, decidedAt }, { merge: true })
      return res.status(200).json({ record: { ...snap.data(), status, reason: reason || null, decidedAt } })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}
