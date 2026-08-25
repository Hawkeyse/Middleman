// USD-native tiered schedule — the buyer always pays this on top of the
// listed price; the seller always receives exactly the amount they listed.
// Computed in USD then converted at the live rate and locked onto the deal
// at creation time (see api/customer.js's createDeal + api/_lib/fx.js), so
// a rate or schedule change afterward never alters an existing deal.
const TIERS = [
  { max: 100, flat: 3 },
  { max: 500, rate: 0.01 },
  { max: 2000, rate: 0.0075 },
  { max: Infinity, rate: 0.005 },
]
const MAX_FEE_USD = 30

export function calcFeeUSD(amountUSD) {
  const amt = Number(amountUSD) || 0
  const tier = TIERS.find((t) => amt <= t.max)
  const raw = tier.flat != null ? tier.flat : amt * tier.rate
  return Math.round(Math.min(raw, MAX_FEE_USD) * 100) / 100
}
