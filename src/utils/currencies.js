export const CURRENCIES = {
  GHS: { code: 'GHS', symbol: '₵', label: 'Ghana Cedis' },
  NGN: { code: 'NGN', symbol: '₦', label: 'Nigerian Naira' },
  USD: { code: 'USD', symbol: '$', label: 'US Dollars' },
}

export const DEFAULT_CURRENCY = 'GHS'

// Only 3 currencies actually move through the app's payment providers (see
// utils/payments.js) — GHS on Paystack, everything else on Flutterwave —
// so "their own currency" collapses to a 3-way split by home country
// (captured at signup, see countryIso on the user doc) rather than needing
// a real per-country currency table.
export function currencyForCountry(iso2) {
  if (iso2 === 'GH') return 'GHS'
  if (iso2 === 'NG') return 'NGN'
  return 'USD'
}

export function symbolFor(currency) {
  return CURRENCIES[currency]?.symbol || CURRENCIES[DEFAULT_CURRENCY].symbol
}

export function money(value) {
  return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// e.g. "₵ 120.00" for a single amount.
export function formatMoney(value, currency) {
  return `${symbolFor(currency)} ${money(value)}`
}

// Sums grouped by currency instead of a single misleading total — you can't
// add dollars and cedis together. Returns e.g. [["GHS", 400], ["USD", 25]].
export function sumByCurrency(items, amountKey = 'amount', currencyKey = 'currency') {
  const totals = {}
  for (const item of items) {
    const cur = item[currencyKey] || DEFAULT_CURRENCY
    totals[cur] = (totals[cur] || 0) + Number(item[amountKey] || 0)
  }
  return Object.entries(totals).filter(([, total]) => total > 0)
}
