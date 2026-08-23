// Tiered fee schedule, per currency — the buyer pays it on top of the listed
// price; the seller always receives exactly the amount they listed for.
//
// GHS and USD share the same numeric thresholds (this app's fee spec was
// originally written in dollar amounts and ported to cedis 1:1). NGN uses
// proportionally larger thresholds since ~1 USD ≈ 1,600 NGN — that rate is
// an approximation with no live FX feed behind it, so revisit these
// periodically rather than trusting them to stay accurate.
const TIER_TABLES = {
  GHS: [{ max: 50, rate: 0.05 }, { max: 200, rate: 0.03 }, { max: 1000, rate: 0.02 }, { max: Infinity, rate: 0.015 }],
  USD: [{ max: 50, rate: 0.05 }, { max: 200, rate: 0.03 }, { max: 1000, rate: 0.02 }, { max: Infinity, rate: 0.015 }],
  NGN: [{ max: 80000, rate: 0.05 }, { max: 320000, rate: 0.03 }, { max: 1600000, rate: 0.02 }, { max: Infinity, rate: 0.015 }],
}
const MIN_FEE = { GHS: 1, USD: 1, NGN: 1500 }
const DEFAULT_CURRENCY = 'GHS'

// Frozen at deal-creation time and stored on the deal record, so a later
// change to the schedule doesn't retroactively alter an existing deal.
export function calcFee(amount, currency = DEFAULT_CURRENCY) {
  const amt = Number(amount) || 0
  const tiers = TIER_TABLES[currency] || TIER_TABLES[DEFAULT_CURRENCY]
  const minFee = MIN_FEE[currency] ?? MIN_FEE[DEFAULT_CURRENCY]
  const rate = tiers.find((t) => amt <= t.max).rate
  const fee = Math.max(minFee, Math.round(amt * rate * 100) / 100)
  const buyerTotal = Math.round((amt + fee) * 100) / 100
  return { amount: amt, currency, feeRate: rate, fee, buyerTotal, sellerPayout: amt }
}
