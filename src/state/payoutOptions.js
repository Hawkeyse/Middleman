// Real payment-rail conventions differ enough by country that a single
// generic "bank name + Mobile Money" form doesn't fit everyone. Ghana is
// mobile-money-first (MTN MoMo ~75-90% share, Telecel Cash, AirtelTigo
// Money); Nigeria has no equivalent dominant telco mobile-money scheme —
// payouts there go through bank-style NUBAN accounts, which today mostly
// means fintechs (OPay, PalmPay, Moniepoint, Kuda) alongside traditional
// banks. Everywhere else falls back to a generic free-text bank field.
const GHANA_MOMO_NETWORKS = ['MTN', 'Telecel', 'AirtelTigo']

const GHANA_BANKS = [
  'GCB Bank', 'Ecobank Ghana', 'Absa Bank Ghana', 'Stanbic Bank Ghana', 'Standard Chartered Ghana',
  'Fidelity Bank Ghana', 'CalBank', 'Access Bank Ghana', 'Zenith Bank Ghana', 'Republic Bank Ghana', 'Other',
]

const NIGERIA_BANKS = [
  'Opay', 'PalmPay', 'Moniepoint', 'Kuda', 'GTBank', 'Access Bank', 'Zenith Bank',
  'UBA', 'First Bank', 'Fidelity Bank Nigeria', 'Wema Bank', 'Other',
]

export function payoutOptionsForCountry(country) {
  if (country === 'Ghana') return { momoNetworks: GHANA_MOMO_NETWORKS, bankOptions: GHANA_BANKS }
  if (country === 'Nigeria') return { momoNetworks: null, bankOptions: NIGERIA_BANKS }
  return { momoNetworks: null, bankOptions: null } // free-text bank name fallback
}
