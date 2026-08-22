import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth } from '../lib/firebase.js'

// Firebase mutates its User object in place (e.g. on reload()), so plain
// object identity never changes and React won't know to re-render. Every
// snapshot below is a fresh plain object specifically so state updates land.
function toSnapshot(fu) {
  return fu ? { uid: fu.uid, email: fu.email, emailVerified: fu.emailVerified, displayName: fu.displayName } : null
}

const continueUrl = () => ({ url: `${window.location.origin}/login` })

export function watchAuth(callback) {
  return onAuthStateChanged(auth, (fu) => callback(toSnapshot(fu)))
}

export async function signUp(name, email, password) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password)
  if (name) await updateProfile(user, { displayName: name })
  await sendEmailVerification(user, continueUrl())
  return toSnapshot(user)
}

export async function signIn(email, password) {
  const { user } = await signInWithEmailAndPassword(auth, email, password)
  return toSnapshot(user)
}

export async function resendVerification() {
  if (auth.currentUser) await sendEmailVerification(auth.currentUser, continueUrl())
}

// Re-pulls the current user's state from Firebase (does NOT retrigger
// onAuthStateChanged) — used to poll/check whether they've clicked the
// verification link yet.
export async function checkVerified() {
  if (!auth.currentUser) return null
  await auth.currentUser.reload()
  return toSnapshot(auth.currentUser)
}

export async function requestPasswordReset(email) {
  try {
    await sendPasswordResetEmail(auth, email, continueUrl())
  } catch (err) {
    // Don't leak whether the email has an account.
    if (err.code !== 'auth/user-not-found') throw err
  }
}

export async function signOutUser() {
  await signOut(auth)
}

const ERROR_MESSAGES = {
  'auth/email-already-in-use': 'An account with that email already exists. Try logging in instead.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
}

export function authErrorMessage(err) {
  return ERROR_MESSAGES[err?.code] || 'Something went wrong. Please try again.'
}
