import { paystackFetch } from '../_lib/paystack.js'

const SUPPORTED_CURRENCIES = new Set(['GHS', 'NGN', 'USD'])

// Starts a deposit: the amount is fixed server-side from the request, then
// locked into the Paystack transaction so the client can't alter it before paying.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, amount, dealCode } = req.body || {}
  const currency = SUPPORTED_CURRENCIES.has(req.body?.currency) ? req.body.currency : 'GHS'
  if (!email || !amount || !dealCode) {
    return res.status(400).json({ error: 'email, amount, and dealCode are required' })
  }

  const minorUnits = Math.round(Number(amount) * 100)
  if (!Number.isFinite(minorUnits) || minorUnits <= 0) {
    return res.status(400).json({ error: 'Invalid amount' })
  }

  try {
    const data = await paystackFetch('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email,
        amount: minorUnits,
        currency,
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
