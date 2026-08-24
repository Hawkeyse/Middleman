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

// Slurs and profanity to block from usernames, which are public (see the
// usernames/{username} directory rule) and shown to counterparties on every
// deal. Checked against a normalized form so common leetspeak/underscore
// evasions (n1gga, n_i_g_g_a) still get caught.
const BLOCKED_TERMS = [
  'nigger', 'nigga', 'nigg', 'faggot', 'fag', 'retard', 'retarded', 'tranny',
  'chink', 'spic', 'kike', 'gook', 'wetback', 'coon', 'beaner', 'paki',
  'rape', 'rapist', 'nazi', 'hitler',
  'fuck', 'shit', 'bitch', 'cunt', 'whore', 'slut', 'dick', 'pussy', 'cock',
  'asshole', 'bastard', 'motherfucker',
]

function deleetify(u) {
  return u.replace(/_/g, '')
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
    .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't')
}

export function normalizeUsername(raw) {
  return (raw || '').trim().toLowerCase()
}

export function usernameError(raw) {
  const u = normalizeUsername(raw)
  if (!u) return 'Pick a username.'
  if (!USERNAME_RE.test(u)) return '3-20 characters: lowercase letters, numbers, underscores only.'
  const plain = deleetify(u)
  if (BLOCKED_TERMS.some((term) => plain.includes(term))) return 'That username isn\'t allowed.'
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

// A few alternatives to offer when someone's first choice is taken — shorter
// fragments of what they typed (so "timtech" taken offers "tim"/"tech",
// closer to something they'd actually recognize) plus numbered variants as a
// fallback that never runs out. Checked sequentially and stops as soon as
// `max` are confirmed available, so it's a handful of reads, not a burst.
export async function suggestUsernames(rawBase, max = 3) {
  const base = normalizeUsername(rawBase).replace(/[^a-z0-9_]/g, '')
  if (base.length < 3) return []

  const candidates = []
  for (let cut = 3; cut <= base.length - 3; cut++) {
    candidates.push(base.slice(0, cut))
    candidates.push(base.slice(cut))
  }
  for (let i = 0; i < 8; i++) candidates.push(`${base}${Math.floor(2 + Math.random() * 97)}`)

  const seen = new Set([base])
  const found = []
  for (const c of candidates) {
    if (found.length >= max) break
    if (seen.has(c)) continue
    seen.add(c)
    if (usernameError(c)) continue
    if (await isUsernameAvailable(c)) found.push(c)
  }
  return found
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

function baseUsernameFromName(name, email) {
  const source = (name || '').trim() || (email || '').split('@')[0] || 'user'
  let base = source.toLowerCase().replace(/[^a-z0-9]+/g, '')
  if (base.length < 3) base = `${base}user`.slice(0, Math.max(3, base.length + 4))
  return base.slice(0, 15)
}

// Silently gives an account a username if it doesn't have one yet — covers
// accounts created before this feature existed, and anyone whose signup-time
// claim lost a naming race. Tries the name-derived handle first, then
// numbered variants; each attempt is a real claimUsername transaction, so
// there's no separate availability check to race against.
export async function ensureUsername(email, name) {
  const existing = await getUser(email)
  if (existing?.username) return existing.username

  const base = baseUsernameFromName(name, email)
  const tries = [base]
  for (let i = 0; i < 10; i++) tries.push(`${base}${Math.floor(2 + Math.random() * 97)}`)

  for (const candidate of tries) {
    if (usernameError(candidate)) continue
    try {
      return await claimUsername(email, name, candidate)
    } catch {
      // taken, or lost a race — fall through to the next candidate
    }
  }
  return null
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
