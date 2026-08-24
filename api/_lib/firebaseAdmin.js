import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

// Server-only — must never be imported from src/. Uses the service account
// key (FIREBASE_* env vars, never VITE_-prefixed) to write with full admin
// privileges, bypassing Firestore security rules entirely. This is where
// every financial or team-privileged mutation happens, matching the same
// "secret stays server-side" pattern as PAYSTACK_SECRET_KEY/FLW_SECRET_KEY.
function adminApp() {
  const apps = getApps()
  if (apps.length) return apps[0]

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase admin env vars are not configured (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY)')
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

export const db = getFirestore(adminApp())
export const adminAuth = getAuth(adminApp())
