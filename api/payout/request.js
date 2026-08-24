import { requireUser } from '../_lib/requireUser.js'
import { db } from '../_lib/firebaseAdmin.js'

// A seller's earned balance isn't a ledger they can also spend from inside
// the app, so there's no double-spend risk to reserve against — but the
// available-balance check (and the write) still has to be server-side,
// since payout_requests is server-write-only (see firestore.rules).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const email = await requireUser(req)
    const { amount, currency, note } = req.body || {}
    const amt = Number(amount)
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Enter an amount.' })
    const cur = currency || 'GHS'

    const userSnap = await db.collection('users').doc(email).get()
    if (!userSnap.data()?.payoutMethod) return res.status(400).json({ error: 'Add a payout method in your profile first.' })

    const txQuery = db.collection('transactions').where('sellerEmail', '==', email).where('currency', '==', cur)
    const at = new Date().toISOString()
    const requestRef = db.collection('payout_requests').doc()

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(txQuery)
      let balance = 0
      snap.forEach((d) => {
        const t = d.data()
        if (t.type === 'release') balance += Number(t.amount)
        else if (t.type === 'payout') balance -= Number(t.amount)
      })
      if (amt > balance) throw Object.assign(new Error(`You only have ${cur} ${balance.toFixed(2)} available.`), { status: 402 })

      const request = { email, amount: amt, currency: cur, note: note || '', status: 'pending', requestedAt: at, completedAt: null }
      tx.set(requestRef, request)
      return { id: requestRef.id, ...request }
    })

    res.status(200).json({ request: result })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}
