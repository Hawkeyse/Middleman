import { requireTeam } from '../_lib/requireTeam.js'
import { db } from '../_lib/firebaseAdmin.js'

// List, warn, ban, unban — all team-only, so all admin-SDK writes gated by
// the passcode instead of direct client Firestore access (see firestore.rules,
// which blocks a client from ever touching status/warnings/banReason itself).
export default async function handler(req, res) {
  try {
    requireTeam(req)

    if (req.method === 'GET') {
      const snap = await db.collection('users').get()
      const users = snap.docs.map((d) => d.data()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      return res.status(200).json({ users })
    }

    if (req.method === 'POST') {
      const { action, email, reason } = req.body || {}
      if (!email) return res.status(400).json({ error: 'email is required' })
      const ref = db.collection('users').doc(email)

      if (action === 'warn') {
        const snap = await ref.get()
        if (!snap.exists) return res.status(404).json({ error: 'User not found' })
        const warnings = [...(snap.data().warnings || []), { reason: reason || 'No reason given.', at: new Date().toISOString() }]
        await ref.set({ status: 'warned', warnings }, { merge: true })
      } else if (action === 'ban') {
        await ref.set({ status: 'banned', banReason: reason || 'Violated Middleman terms.', bannedAt: new Date().toISOString() }, { merge: true })
      } else if (action === 'unban') {
        await ref.set({ status: 'active', banReason: null, bannedAt: null }, { merge: true })
      } else {
        return res.status(400).json({ error: 'Unknown action' })
      }

      const updated = await ref.get()
      return res.status(200).json({ user: updated.data() })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}
