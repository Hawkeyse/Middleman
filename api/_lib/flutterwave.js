const BASE_URL = 'https://api.flutterwave.com/v3'

// Server-only helper — must never be imported from src/. The secret key lives
// in the FLW_SECRET_KEY env var (Vercel project settings in prod, .env locally)
// and is never sent to the browser.
export async function flutterwaveFetch(path, options = {}) {
  const secretKey = process.env.FLW_SECRET_KEY
  if (!secretKey) throw new Error('FLW_SECRET_KEY is not configured')

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  const json = await res.json()
  if (!res.ok || json.status === 'error') {
    throw new Error(json.message || `Flutterwave request failed (${res.status})`)
  }
  return json
}
