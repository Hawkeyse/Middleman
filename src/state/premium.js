import { doc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { authedFetch } from '../utils/authedFetch.js'

export function isPremiumActive(premiumUntil) {
  return !!premiumUntil && new Date(premiumUntil).getTime() > Date.now()
}

export async function upgradePremium(provider, reference) {
  return authedFetch('/api/customer', { body: { action: 'upgradePremium', provider, reference } })
}

// Cosmetic only — see firestore.rules: this alone doesn't unlock anything,
// the app only ever renders it styled when premiumUntil (server-set) is
// actually active.
export async function saveProfileCard(email, card) {
  await setDoc(doc(db, 'users', email), { profileCard: card }, { merge: true })
}
