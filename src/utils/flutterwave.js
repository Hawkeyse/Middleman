// The /api functions only run under `vercel dev` or in production — a plain
// `vite dev` 404s with an empty body, which makes res.json() throw an opaque
// "Unexpected end of JSON input". Surface something actionable instead.
async function parseJson(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Server didn't return a valid response (${res.status}). If you're running locally, make sure you're using "vercel dev", not "vite dev" — the /api routes need it.`)
  }
}

function loadFlutterwaveScript() {
  if (window.FlutterwaveCheckout) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.flutterwave.com/v3.js'
    script.onload = resolve
    script.onerror = () => reject(new Error('Could not load Flutterwave. Check your connection and try again.'))
    document.head.appendChild(script)
  })
}

// Same shape/contract as payWithPaystack (see src/utils/paystack.js) — locks
// the amount in server-side first, then opens Flutterwave's inline checkout,
// which offers card, bank transfer, and PayPal depending on currency/account
// settings. onReference fires with the tx_ref before checkout even opens, so
// an interrupted payment can still be recovered later (see Invite.jsx).
export async function payWithFlutterwave({ email, amount, currency, dealCode, onReference }) {
  const initRes = await fetch('/api/flutterwave/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, amount, currency, dealCode }),
  })
  const init = await parseJson(initRes)
  if (!initRes.ok) throw new Error(init.error || 'Could not start payment')
  onReference?.(init.tx_ref)

  await loadFlutterwaveScript()

  return new Promise((resolve, reject) => {
    let settled = false
    window.FlutterwaveCheckout({
      public_key: import.meta.env.VITE_FLW_PUBLIC_KEY,
      tx_ref: init.tx_ref,
      amount: init.chargeAmount,
      currency: init.chargeCurrency,
      payment_options: 'card,paypal,banktransfer,ussd',
      customer: { email },
      meta: { dealCode },
      customizations: { title: 'Middleman', description: 'Escrow payment' },
      callback: (response) => {
        settled = true
        if (response.status === 'successful' || response.status === 'completed') resolve(init.tx_ref)
        else reject(new Error('Payment was not successful.'))
      },
      onclose: () => { if (!settled) reject(new Error('Payment window closed before completing.')) },
    })
  })
}

export async function verifyFlutterwavePayment(tx_ref) {
  const res = await fetch(`/api/flutterwave/verify?tx_ref=${encodeURIComponent(tx_ref)}`)
  const data = await parseJson(res)
  if (!res.ok) throw new Error(data.error || 'Could not verify payment')
  return data
}
