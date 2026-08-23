// Free, keyless exchange-rate endpoint (updated daily, rate-limited if you
// hammer it) — cache in memory for an hour so a burst of checkouts doesn't
// risk that limit. Server-only.
let cached = null
const CACHE_TTL_MS = 60 * 60 * 1000

async function getRatesUSD() {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.rates
  const res = await fetch('https://open.er-api.com/v6/latest/USD')
  const data = await res.json()
  if (data.result !== 'success' || !data.rates) throw new Error('Exchange rate lookup failed')
  cached = { rates: data.rates, at: Date.now() }
  return data.rates
}

// Converts an amount between currencies via USD as the pivot.
export async function convertCurrency(amount, from, to) {
  if (from === to) return amount
  const rates = await getRatesUSD()
  const fromRate = rates[from]
  const toRate = rates[to]
  if (!fromRate || !toRate) throw new Error(`Exchange rate unavailable for ${from} or ${to}`)
  const usd = amount / fromRate
  return Math.round(usd * toRate * 100) / 100
}
