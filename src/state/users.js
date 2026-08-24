import { collection, doc, documentId, endAt, getDoc, getDocs, limit, orderBy, query, runTransaction, setDoc, startAt } from 'firebase/firestore'
import { db } from '../lib/firebase.js'

// Firestore-backed now — see firestore.rules. A user can only ever read/write
// their OWN doc (it can carry a real bank/momo account number in
// payoutMethod), so nothing here can be used to look up anyone else. The
// team's warn/ban/list actions live server-side in api/team/users.js instead,
// since Firestore rules have no way to trust the /team passcode.

// Registers/updates the directory entry for a user — called on every
// signup/login so the team has someone to warn/ban even before they've
// filed a verification request or opened a support chat. On first write this
// creates the full record (status/warnings start fresh); on later writes it
// only touches the safe fields — status/warnings/banReason are team-only and
// the security rules reject a client write that touches them.
export async function upsertUser({ email, name, phone }) {
  if (!email) return null
  const ref = doc(db, 'users', email)
  const snap = await getDoc(ref)
  const existing = snap.exists() ? snap.data() : null

  const payload = existing
    ? { name: name || existing.name || '', phone: phone || existing.phone || '' }
    : {
        email, name: name || '', username: '', phone: phone || '',
        payoutMethod: null,
        status: 'active', warnings: [], banReason: null, bannedAt: null,
        createdAt: new Date().toISOString(),
      }

  await setDoc(ref, payload, { merge: true })
  return { ...existing, ...payload }
}

// Where a seller's share of released escrow gets manually paid out to —
// there's no live Paystack/Flutterwave Transfer wired up yet, so the team
// reconciles payouts by hand using what's on file here.
export async function setPayoutMethod(email, method) {
  if (!email) return null
  await setDoc(doc(db, 'users', email), { payoutMethod: method }, { merge: true })
  return method
}

export async function getUser(email) {
  if (!email) return null
  const snap = await getDoc(doc(db, 'users', email))
  return snap.exists() ? snap.data() : null
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/

export function normalizeUsername(raw) {
  return (raw || '').trim().toLowerCase()
}

export function usernameError(raw) {
  const u = normalizeUsername(raw)
  if (!u) return 'Pick a username.'
  if (!USERNAME_RE.test(u)) return '3-20 characters: lowercase letters, numbers, underscores only.'
  return ''
}

// Live "is this taken" check for instant feedback while typing — the actual
// guarantee against a race between two people claiming the same name at the
// same instant comes from the transaction in claimUsername below, not this.
export async function isUsernameAvailable(rawUsername) {
  const u = normalizeUsername(rawUsername)
  if (usernameError(u)) return false
  try {
    const snap = await getDoc(doc(db, 'usernames', u))
    return !snap.exists()
  } catch {
    // Network/permission hiccup — the transaction in claimUsername is the
    // real gate at submit time, so err toward not blocking the UI on this.
    return true
  }
}

// Claims a username for an account — one-time, no renames yet. The
// usernames/{username} doc doubling as a reservation means two people racing
// to claim the same name can't both win: whichever transaction's read sees
// the doc already there loses, atomically, without a server round trip.
export async function claimUsername(email, name, rawUsername) {
  const u = normalizeUsername(rawUsername)
  const err = usernameError(u)
  if (err) throw new Error(err)

  const usernameRef = doc(db, 'usernames', u)
  const userRef = doc(db, 'users', email)
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(usernameRef)
    if (existing.exists()) throw new Error('That username is taken.')
    tx.set(usernameRef, { email, name: name || '' })
    tx.set(userRef, { username: u }, { merge: true })
  })
  return u
}

// Prefix search over the public username directory — powers "invite by
// username" search. Returns [] for anything too short to be worth querying.
export async function searchUsernames(prefix, max = 8) {
  const p = normalizeUsername(prefix)
  if (p.length < 2) return []
  const q = query(
    collection(db, 'usernames'),
    orderBy(documentId()),
    startAt(p),
    endAt(p + String.fromCharCode(0xf8ff)),
    limit(max),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ username: d.id, ...d.data() }))
}
