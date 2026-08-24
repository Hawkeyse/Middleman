import { adminAuth } from './firebaseAdmin.js'

// Verifies the caller's real Firebase ID token server-side and returns their
// verified email — never trust an email the client sends in the request
// body for anything that touches money or another user's data.
export async function requireUser(req) {
  const authHeader = req.headers.authorization || ''
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!idToken) throw Object.assign(new Error('Not signed in'), { status: 401 })

  const decoded = await adminAuth.verifyIdToken(idToken)
  if (!decoded.email) throw Object.assign(new Error('Account has no email'), { status: 401 })
  return decoded.email
}
