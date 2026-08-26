import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  RecaptchaVerifier,
  linkWithPhoneNumber,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth'
import { auth } from '../lib/firebase.js'
import { authedFetch } from './authedFetch.js'

// Firebase mutates its User object in place (e.g. on reload()), so plain
// object identity never changes and React won't know to re-render. Every
// snapshot below is a fresh plain object specifically so state updates land.
function toSnapshot(fu) {
  return fu ? { uid: fu.uid, email: fu.email, emailVerified: fu.emailVerified, displayName: fu.displayName } : null
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, (fu) => callback(toSnapshot(fu)))
}

export async function signUp(name, email, password) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password)
  if (name) await updateProfile(user, { displayName: name })
  await authedFetch('/api/auth-email', { body: { type: 'verify', origin: window.location.origin } })
  return toSnapshot(user)
}

export async function signIn(email, password) {
  const { user } = await signInWithEmailAndPassword(auth, email, password)
  return toSnapshot(user)
}

export async function resendVerification() {
  if (auth.currentUser) await authedFetch('/api/auth-email', { body: { type: 'verify', origin: window.location.origin } })
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
  const res = await fetch('/api/auth-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'reset', email, origin: window.location.origin }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Request failed')
  }
}

// Used by /auth/action, the in-app page the branded emails link to instead
// of Firebase's own generic hosted handler.
export async function verifyResetCode(oobCode) {
  return verifyPasswordResetCode(auth, oobCode) // resolves to the account's email
}

export async function confirmReset(oobCode, newPassword) {
  await confirmPasswordReset(auth, oobCode, newPassword)
}

export async function verifyEmailCode(oobCode) {
  await applyActionCode(auth, oobCode)
  if (auth.currentUser) await auth.currentUser.reload()
}

// Firebase rejects updatePassword on a session that isn't "recent" —
// reauthenticating with the current password right before satisfies that,
// and doubles as proving they actually know the current password.
export async function changePassword(currentPassword, newPassword) {
  const user = auth.currentUser
  if (!user) throw new Error('You need to be signed in.')
  const credential = EmailAuthProvider.credential(user.email, currentPassword)
  await reauthenticateWithCredential(user, credential)
  await updatePassword(user, newPassword)
}

export async function signOutUser() {
  await signOut(auth)
}

// Phone verification links an SMS-confirmed number onto the already-signed-
// in account — email/password stays the primary sign-in method, this never
// replaces the session (linkWithPhoneNumber, not signInWithPhoneNumber).
// The invisible reCAPTCHA needs a real DOM node to attach to; callers render
// an empty div and pass its id. One verifier per container per page load —
// Firebase reuses it across a resend, and recreating it on every call trips
// its own internal "already rendered" guard.
let recaptchaVerifier = null
function getRecaptcha(containerId) {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' })
  }
  return recaptchaVerifier
}

export async function sendPhoneOtp(phoneE164, containerId) {
  if (!auth.currentUser) throw new Error('You need to be signed in.')
  const verifier = getRecaptcha(containerId)
  return linkWithPhoneNumber(auth.currentUser, phoneE164, verifier)
}

export async function confirmPhoneOtp(confirmationResult, code) {
  await confirmationResult.confirm(code)
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
  'auth/invalid-phone-number': "That phone number doesn't look right.",
  'auth/missing-phone-number': 'Enter a phone number.',
  'auth/code-expired': 'That code expired. Send a new one.',
  'auth/invalid-verification-code': "That code isn't right. Check the SMS and try again.",
  'auth/credential-already-in-use': 'That phone number is already linked to a different account.',
  'auth/provider-already-linked': 'A phone number is already linked to this account.',
  'auth/operation-not-allowed': "Phone sign-in isn't turned on for this project yet.",
  'auth/captcha-check-failed': "Verification check failed — refresh the page and try again.",
  'auth/quota-exceeded': "We've hit today's SMS limit. Please try again later.",
  'auth/expired-action-code': 'This link has expired. Request a new one.',
  'auth/invalid-action-code': 'This link is invalid or has already been used.',
  'auth/user-disabled': 'This account has been disabled.',
}

export function authErrorMessage(err) {
  return ERROR_MESSAGES[err?.code] || 'Something went wrong. Please try again.'
}
