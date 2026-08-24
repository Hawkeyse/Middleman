import { requireUser } from '../_lib/requireUser.js'
import { db } from '../_lib/firebaseAdmin.js'
import { normalizeUsername, usernameError } from '../../src/utils/usernameRules.js'

const COOLDOWN_DAYS = 30
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000

// Renaming is rate-limited to once a month and keeps a history of retired
// handles — unlike the first-ever claim (a direct client write, see
// src/state/users.js), so it has to be server-side: the cooldown check
// needs to be trusted, and it writes usernameHistory, which
// firestore.rules blocks a client from touching directly.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const email = await requireUser(req)
    const newUsername = normalizeUsername((req.body || {}).username)
    const err = usernameError(newUsername)
    if (err) return res.status(400).json({ error: err })

    const userRef = db.collection('users').doc(email)
    const publicRef = db.collection('public_profiles').doc(email)
    const newNameRef = db.collection('usernames').doc(newUsername)

    const result = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef)
      if (!userSnap.exists) throw Object.assign(new Error('Account not found'), { status: 404 })
      const user = userSnap.data()
      const oldUsername = user.username || ''
      if (!oldUsername) throw Object.assign(new Error("You don't have a username yet — set one from your profile first."), { status: 400 })
      if (oldUsername === newUsername) throw Object.assign(new Error("That's already your username."), { status: 400 })

      if (user.lastUsernameChangeAt) {
        const nextAllowed = new Date(user.lastUsernameChangeAt).getTime() + COOLDOWN_MS
        if (Date.now() < nextAllowed) {
          const daysLeft = Math.ceil((nextAllowed - Date.now()) / (24 * 60 * 60 * 1000))
          throw Object.assign(new Error(`You can change your username again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`), { status: 429 })
        }
      }

      const takenSnap = await tx.get(newNameRef)
      if (takenSnap.exists) throw Object.assign(new Error('That username is taken.'), { status: 409 })

      const now = new Date().toISOString()
      const usernameHistory = [...(user.usernameHistory || []), { username: oldUsername, retiredAt: now }]

      tx.set(newNameRef, { email, name: user.name || '' })
      tx.set(userRef, { username: newUsername, usernameHistory, lastUsernameChangeAt: now }, { merge: true })
      tx.set(publicRef, { username: newUsername, usernameHistory, name: user.name || '' }, { merge: true })

      return { username: newUsername, usernameHistory, lastUsernameChangeAt: now }
    })

    res.status(200).json(result)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}
