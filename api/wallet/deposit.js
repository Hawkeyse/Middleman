import { requireUser } from '../_lib/requireUser.js'
import { db } from '../_lib/firebaseAdmin.js'
import { paystackFetch } from '../_lib/paystack.js'
import { flutterwaveFetch } from '../_lib/flutterwave.js'

async function verify(provider, reference) {
  if (provider === 'paystack') {
    const data = await paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`)
    const tx = data.data
    return { status: tx.status, amount: tx.amount / 100, currency: tx.currency }
  }
  const data = await flutterwaveFetch(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`)
  const tx = data.data
  return { status: tx.status === 'successful' ? 'success' : tx.status, amount: tx.amount, currency: tx.currency }
}

// Credits the buyer's Middleman wallet after a real payment — re-verifies
// with the provider itself rather than trusting the client's "success"
// callback, and keys the wallet_entries doc by the payment reference so a
// retried/duplicate call can never double-credit the same payment.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const email = await requireUser(req)
    const { provider, reference } = req.body || {}
    if (!provider || !reference) return res.status(400).json({ error: 'provider and reference are required' })

    const entryRef = db.collection('wallet_entries').doc(`${provider}:${reference}`)
    const existing = await entryRef.get()
    if (existing.exists) return res.status(200).json({ entry: { id: existing.id, ...existing.data() }, alreadyCredited: true })

    const verified = await verify(provider, reference)
    if (verified.status !== 'success') return res.status(402).json({ error: 'Payment was not successful. No funds were moved.' })

    const entry = { email, type: 'deposit', amount: verified.amount, currency: verified.currency, dealCode: null, note: '', at: new Date().toISOString() }
    await entryRef.set(entry)
    res.status(200).json({ entry: { id: entryRef.id, ...entry } })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}
