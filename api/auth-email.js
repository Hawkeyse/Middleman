import { adminAuth } from './_lib/firebaseAdmin.js'
import { sendMail, emailTemplates } from './_lib/mailer.js'

// Firebase's own template system can't be edited past sender/reply-to, so
// verify-email and password-reset are sent from here instead: generate the
// real Firebase action link server-side (admin SDK) and mail our own
// branded HTML via Resend. handleCodeInApp routes the link back into the
// app's own /auth/action page instead of Firebase's generic hosted handler.
const ALLOWED_ORIGINS = ['https://middlemansecure.com', 'https://www.middlemansecure.com', 'http://localhost:5173']

function safeOrigin(origin) {
  if (typeof origin === 'string' && (ALLOWED_ORIGINS.includes(origin) || (origin.startsWith('https://') && origin.endsWith('.vercel.app')))) {
    return origin
  }
  return 'https://middlemansecure.com'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { type, origin } = req.body || {}
  const actionCodeSettings = { url: `${safeOrigin(origin)}/auth/action`, handleCodeInApp: true }

  try {
    if (type === 'reset') {
      const { email } = req.body || {}
      if (!email) return res.status(400).json({ error: 'email is required' })
      try {
        const link = await adminAuth.generatePasswordResetLink(email, actionCodeSettings)
        const { subject, html } = emailTemplates.resetPassword({ link, email })
        await sendMail({ to: email, subject, html })
      } catch (err) {
        // Don't leak whether the account exists.
        if (err.code !== 'auth/user-not-found') throw err
      }
      return res.status(200).json({ ok: true })
    }

    if (type === 'verify') {
      const authHeader = req.headers.authorization || ''
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
      if (!idToken) return res.status(401).json({ error: 'Not signed in' })
      const decoded = await adminAuth.verifyIdToken(idToken)
      if (!decoded.email) return res.status(401).json({ error: 'Account has no email' })
      const link = await adminAuth.generateEmailVerificationLink(decoded.email, actionCodeSettings)
      const { subject, html } = emailTemplates.verifyEmail({ link, displayName: decoded.name || '' })
      await sendMail({ to: decoded.email, subject, html })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Unknown type' })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}
