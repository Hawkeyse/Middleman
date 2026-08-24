import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase.js'

// Firestore-backed — see firestore.rules. Submitting/resubmitting is a
// direct client write (the rule only allows it landing back in 'pending',
// never verified/declined) — approving or declining is team-only and goes
// through api/team/verifications.js instead, since rules can't validate the
// team passcode.
export async function submitVerification({ email, name, country, age, dob, docType, docImage, selfieImage }) {
  const record = {
    id: email, email, name, country, age, dob, docType, docImage, selfieImage,
    status: 'pending', reason: null, submittedAt: new Date().toISOString(), decidedAt: null,
  }
  await setDoc(doc(db, 'verifications', email), record)
  return record
}

export async function getVerificationFor(email) {
  if (!email) return null
  const snap = await getDoc(doc(db, 'verifications', email))
  return snap.exists() ? snap.data() : null
}
