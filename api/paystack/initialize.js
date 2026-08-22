import { paystackFetch } from '../_lib/paystack.js'

// Starts a deposit: the amount is fixed server-side from the request, then
// locked into the Paystack transaction so the client can't alter it before paying.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, amount, dealCode } = req.body || {}
  if (!email || !amount || !dealCode) {
    return res.status(400).json({ error: 'email, amount, and dealCode are required' })
  }

  const kobo = Math.round(Number(amount) * 100)
  if (!Number.isFinite(kobo) || kobo <= 0) {
    return res.status(400).json({ error: 'Invalid amount' })
  }

  try {
    const data = await paystackFetch('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email,
        amount: kobo,
        currency: 'GHS',
        reference: `MDM-${dealCode}-${Date.now().toString(36).toUpperCase()}`,
        metadata: { dealCode },
      }),
    })

    res.status(200).json({
      reference: data.data.reference,
      access_code: data.data.access_code,
      authorization_url: data.data.authorization_url,
    })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
