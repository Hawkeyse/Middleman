import { requireTeam } from '../_lib/requireTeam.js'
import { db } from '../_lib/firebaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    requireTeam(req)
    const snap = await db.collection('transactions').get()
    const transactions = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.at || '').localeCompare(a.at || ''))
    res.status(200).json({ transactions })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}
