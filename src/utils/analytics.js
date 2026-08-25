import { doc, getDoc, increment, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase.js'

// A single counter bumped once per browser session (not every render/visit
// to the same tab) — good enough for a rough "how many people land here"
// number without needing real visitor-tracking infrastructure. See
// firestore.rules: this doc can only ever move forward by exactly 1 per
// write, so a client can't set it to an arbitrary value.
const SESSION_KEY = 'mm_visit_recorded'

export async function recordVisit() {
  if (sessionStorage.getItem(SESSION_KEY)) return
  sessionStorage.setItem(SESSION_KEY, '1')
  try {
    const ref = doc(db, 'analytics', 'visits')
    const snap = await getDoc(ref)
    if (!snap.exists()) await setDoc(ref, { total: 1 })
    else await setDoc(ref, { total: increment(1) }, { merge: true })
  } catch {
    // best-effort — a missed count isn't worth surfacing an error over
  }
}
