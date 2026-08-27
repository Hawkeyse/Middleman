import { adminAuth } from './firebaseAdmin.js'
import { db } from './firebaseAdmin.js'

// Real per-person accounts (team_members collection) instead of one shared
// TEAM_PASSCODE everyone typed in — a departed or compromised teammate's
// access can be revoked individually instead of rotating one secret that
// unlocks the whole dashboard for everyone at once. Uses the same Firebase
// Auth user pool as regular customer accounts (verified the same way
// requireUser.js does), so the Owner's own team login is just their normal
// Middleman login.
export async function requireTeam(req) {
  const authHeader = req.headers.authorization || ''
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!idToken) throw Object.assign(new Error('Not signed in'), { status: 401 })

  const decoded = await adminAuth.verifyIdToken(idToken)
  if (!decoded.email) throw Object.assign(new Error('Account has no email'), { status: 401 })

  const snap = await db.collection('team_members').doc(decoded.email).get()
  if (!snap.exists) throw Object.assign(new Error("This account isn't on the Middleman team."), { status: 403 })

  return { email: decoded.email, role: snap.data().role || 'member' }
}

export function requireOwner(team) {
  if (team.role !== 'owner') throw Object.assign(new Error('Owner only'), { status: 403 })
}
