import { paystackFetch } from '../_lib/paystack.js'

// Re-checks the transaction status directly with Paystack using the secret key —
// never trust the client-side popup's "success" callback alone for real money.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { reference } = req.query
  if (!reference) return res.status(400).json({ error: 'reference is required' })

  try {
    const data = await paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`)
    const tx = data.data
    res.status(200).json({
      status: tx.status,
      amount: tx.amount / 100,
      currency: tx.currency,
      reference: tx.reference,
      dealCode: tx.metadata?.dealCode || null,
    })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
