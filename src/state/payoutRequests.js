import { authedFetch } from '../utils/authedFetch.js'

// Seller payout requests — server-write-only (see firestore.rules), since
// the available-balance check has to be trusted server-side too.
export async function requestPayout({ amount, currency, note }) {
  const { request } = await authedFetch('/api/payout/request', { body: { amount, currency, note } })
  return request
}
