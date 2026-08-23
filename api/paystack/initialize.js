import { paystackFetch } from '../_lib/paystack.js'
import { convertCurrency } from '../_lib/fx.js'

const SUPPORTED_CURRENCIES = new Set(['GHS', 'NGN', 'USD'])
// Only GHS is actually enabled for charging on this Paystack account today.
// A deal listed in another currency gets auto-converted to GHS at checkout
// using a live rate — Paystack rejects any currency the merchant account
// doesn't have switched on ("Currency not supported by merchant"), and every
// deal still needs to actually collect money regardless of what it's listed in.
const MERCHANT_CURRENCY = process.env.PAYSTACK_MERCHANT_CURRENCY || 'GHS'

// Starts a deposit: the amount is fixed server-side from the request, then
// locked into the Paystack transaction so the client can't alter it before paying.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, amount, dealCode } = req.body || {}
  const currency = SUPPORTED_CURRENCIES.has(req.body?.currency) ? req.body.currency : 'GHS'
  if (!email || !amount || !dealCode) {
    return res.status(400).json({ error: 'email, amount, and dealCode are required' })
  }
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Invalid amount' })
  }

  try {
    let chargeAmount = Number(amount)
    let chargeCurrency = currency
    if (currency !== MERCHANT_CURRENCY) {
      chargeAmount = await convertCurrency(Number(amount), currency, MERCHANT_CURRENCY)
      chargeCurrency = MERCHANT_CURRENCY
    }

    const minorUnits = Math.round(chargeAmount * 100)
    if (!Number.isFinite(minorUnits) || minorUnits <= 0) {
      return res.status(400).json({ error: 'Invalid amount' })
    }

    const data = await paystackFetch('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email,
        amount: minorUnits,
        currency: chargeCurrency,
        reference: `MDM-${dealCode}-${Date.now().toString(36).toUpperCase()}`,
        metadata: { dealCode, originalAmount: amount, originalCurrency: currency },
      }),
    })

    res.status(200).json({
      reference: data.data.reference,
      access_code: data.data.access_code,
      authorization_url: data.data.authorization_url,
      chargeAmount,
      chargeCurrency,
    })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
