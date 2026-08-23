// Flat fee schedule (USD-native), scaled to other currencies via a fixed
// approximate rate — NOT the live rate used for the actual charge at
// checkout (see api/_lib/fx.js). This only decides which fee bracket a
// listing falls into; it doesn't move any money itself, so an approximate,
// periodically-revisited rate here is an acceptable tradeoff for keeping
// deal creation synchronous and not needing a server round-trip just to
// price a fee. The buyer always pays the fee on top of the listed price;
// the seller always receives exactly the amount they listed for.
const USD_PER_UNIT = { GHS: 15.5, NGN: 1600, USD: 1 } // approx units per $1
const TOP_TIER_RATE = 0.025 // 2.5% — midpoint of the given 2-3% range, above the $500 tier

function scale(usdValue, currency) {
  const rate = USD_PER_UNIT[currency] || 1
  return Math.round(usdValue * rate * 100) / 100
}

function tiersFor(currency) {
  return [
    { max: scale(100, currency), fee: scale(3, currency) },
    { max: scale(250, currency), fee: scale(5, currency) },
    { max: scale(500, currency), fee: scale(8, currency) },
  ]
}

// Frozen at deal-creation time and stored on the deal record, so a later
// change to the schedule doesn't retroactively alter an existing deal.
export function calcFee(amount, currency = 'GHS') {
  const amt = Number(amount) || 0
  const tier = tiersFor(currency).find((t) => amt <= t.max)
  const fee = tier ? tier.fee : Math.round(amt * TOP_TIER_RATE * 100) / 100
  const feeRate = amt > 0 ? fee / amt : 0
  const buyerTotal = Math.round((amt + fee) * 100) / 100
  return { amount: amt, feeRate, fee, buyerTotal, sellerPayout: amt }
}
