import { payWithPaystack, verifyPaystackPayment } from './paystack.js'
import { payWithFlutterwave, verifyFlutterwavePayment } from './flutterwave.js'

// GHS stays on Paystack (mobile money is its strongest rail there). Every
// other currency routes through Flutterwave, which also brings in card,
// bank transfer, and PayPal without us needing a currency-conversion step.
const PAYSTACK_CURRENCIES = new Set(['GHS'])

export function providerFor(currency) {
  return PAYSTACK_CURRENCIES.has(currency) ? 'paystack' : 'flutterwave'
}

// Same shape for either provider: opens the right checkout, resolves with
// { provider, reference } once payment completes. onReference is called with
// the raw reference alone (before checkout opens) so callers doing
// interrupted-payment recovery can persist { provider, reference } together —
// recovering needs to know which provider a saved reference belongs to.
export async function payWithProvider({ email, amount, currency, dealCode, onReference }) {
  const provider = providerFor(currency)
  const wrappedOnReference = onReference ? (reference) => onReference({ provider, reference }) : undefined
  const reference = provider === 'paystack'
    ? await payWithPaystack({ email, amount, currency, dealCode, onReference: wrappedOnReference })
    : await payWithFlutterwave({ email, amount, currency, dealCode, onReference: wrappedOnReference })
  return { provider, reference }
}

export async function verifyProviderPayment(provider, reference) {
  return provider === 'paystack' ? verifyPaystackPayment(reference) : verifyFlutterwavePayment(reference)
}
