// Tiered fee schedule — the buyer pays it on top of the listed price; the
// seller always receives exactly the amount they listed the item for.
const TIERS = [
  { max: 50, rate: 0.05 },
  { max: 200, rate: 0.03 },
  { max: 1000, rate: 0.02 },
  { max: Infinity, rate: 0.015 },
]
const MIN_FEE = 1

// Frozen at deal-creation time and stored on the deal record, so a later
// change to the schedule doesn't retroactively alter an existing deal.
export function calcFee(amount) {
  const amt = Number(amount) || 0
  const tier = TIERS.find((t) => amt <= t.max)
  const rate = tier.rate
  const fee = Math.max(MIN_FEE, Math.round(amt * rate * 100) / 100)
  const buyerTotal = Math.round((amt + fee) * 100) / 100
  return { amount: amt, feeRate: rate, fee, buyerTotal, sellerPayout: amt }
}
