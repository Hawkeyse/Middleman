import { requireUser } from '../_lib/requireUser.js'
import { db } from '../_lib/firebaseAdmin.js'

// Pulls unused wallet balance back out — handled manually by the team from
// here, not automatically. Admin SDK only, since wallet_entries/
// refund_requests are both server-write-only (see firestore.rules).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const email = await requireUser(req)
    const { amount, currency, note } = req.body || {}
    const amt = Number(amount)
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Enter an amount.' })
    const cur = currency || 'GHS'

    const walletQuery = db.collection('wallet_entries').where('email', '==', email).where('currency', '==', cur)
    const at = new Date().toISOString()
    const requestRef = db.collection('refund_requests').doc()

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(walletQuery)
      let balance = 0
      snap.forEach((d) => { const e = d.data(); balance += e.type === 'deposit' ? e.amount : -e.amount })
      if (amt > balance) throw Object.assign(new Error(`You only have ${cur} ${balance.toFixed(2)} available.`), { status: 402 })

      const request = { email, amount: amt, currency: cur, note: note || '', status: 'pending', requestedAt: at, completedAt: null }
      tx.set(db.collection('wallet_entries').doc(), { email, type: 'refund', amount: amt, currency: cur, dealCode: null, note: note || '', at })
      tx.set(requestRef, request)
      return { id: requestRef.id, ...request }
    })

    res.status(200).json({ request: result })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}
