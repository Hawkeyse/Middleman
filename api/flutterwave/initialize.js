const SUPPORTED_CURRENCIES = new Set(['NGN', 'USD'])

// Unlike Paystack (see api/paystack/initialize.js), the account doesn't need
// currency conversion here — Flutterwave charges NGN/USD directly. This just
// validates the request and hands back a locked amount/currency plus a
// unique tx_ref for the client to open the Flutterwave checkout with.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, amount, dealCode } = req.body || {}
  const currency = SUPPORTED_CURRENCIES.has(req.body?.currency) ? req.body.currency : 'USD'
  if (!email || !amount || !dealCode) {
    return res.status(400).json({ error: 'email, amount, and dealCode are required' })
  }
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Invalid amount' })
  }

  const tx_ref = `MDM-${dealCode}-${Date.now().toString(36).toUpperCase()}`
  res.status(200).json({ tx_ref, chargeAmount: Number(amount), chargeCurrency: currency })
}
