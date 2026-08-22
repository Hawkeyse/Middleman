const BASE_URL = 'https://api.paystack.co'

// Server-only helper — must never be imported from src/. The secret key lives
// in the PAYSTACK_SECRET_KEY env var (Vercel project settings in prod, .env locally)
// and is never sent to the browser.
export async function paystackFetch(path, options = {}) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) throw new Error('PAYSTACK_SECRET_KEY is not configured')

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  const json = await res.json()
  if (!res.ok || json.status === false) {
    throw new Error(json.message || `Paystack request failed (${res.status})`)
  }
  return json
}
