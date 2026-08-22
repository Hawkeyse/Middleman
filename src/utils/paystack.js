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

function loadPaystackScript() {
  if (window.PaystackPop) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.onload = resolve
    script.onerror = () => reject(new Error('Could not load Paystack. Check your connection and try again.'))
    document.head.appendChild(script)
  })
}

// Initializes the transaction server-side (locks in the amount), then opens
// Paystack's inline popup for the buyer to pay. Resolves with the reference
// once Paystack reports success — callers must still verify it server-side.
export async function payWithPaystack({ email, amount, dealCode }) {
  const initRes = await fetch('/api/paystack/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, amount, dealCode }),
  })
  const init = await parseJson(initRes)
  if (!initRes.ok) throw new Error(init.error || 'Could not start payment')

  await loadPaystackScript()

  return new Promise((resolve, reject) => {
    const handler = window.PaystackPop.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
      email,
      amount: Math.round(Number(amount) * 100),
      currency: 'GHS',
      ref: init.reference,
      access_code: init.access_code,
      callback: (response) => resolve(response.reference),
      onClose: () => reject(new Error('Payment window closed before completing.')),
    })
    handler.openIframe()
  })
}

export async function verifyPaystackPayment(reference) {
  const res = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`)
  const data = await parseJson(res)
  if (!res.ok) throw new Error(data.error || 'Could not verify payment')
  return data
}
