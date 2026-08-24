import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { submitVerification, getVerificationFor } from './verifications.js'
import { upsertUser, getUser, ensureUsername } from './users.js'
import { watchAuth, checkVerified, signOutUser } from '../utils/auth.js'

const AppStateContext = createContext(null)

const defaultUser = { name: '', email: '', phone: '' }

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable (private mode, etc.) — state still works for the session
  }
}

export function AppStateProvider({ children }) {
  const [fbUser, setFbUser] = useState(null) // null | { uid, email, emailVerified, displayName }
  const [authChecked, setAuthChecked] = useState(false)
  const [user, setUserState] = useState(() => load('mm_user', defaultUser))
  // 'unverified' | 'pending' | 'verified' | 'declined'
  const [verification, setVerification] = useState('unverified')
  const [verificationMeta, setVerificationMeta] = useState(null)
  const [accountStatus, setAccountStatus] = useState(null) // the users.js record: status/warnings/banReason

  useEffect(() => persist('mm_user', user), [user])

  // Firebase's own session is the source of truth for who's signed in — a
  // real account only counts as "authed" once they've verified their email
  // (they get bounced to a "check your email" screen otherwise, see Login.jsx).
  useEffect(() => {
    const unsub = watchAuth((snap) => {
      setFbUser(snap)
      setAuthChecked(true)
      if (snap) {
        // Keeps the users/{email} directory entry alive for a returning
        // session on a fresh browser too, not just at signup — otherwise
        // anything keyed off it (payout method, warn/ban) silently has
        // nothing to attach to.
        getUser(snap.email).then((local) => {
          const name = snap.displayName || local?.name || ''
          upsertUser({ email: snap.email, name, phone: local?.phone || '' })
          setUserState((prev) => ({ name: name || prev.name || '', email: snap.email, phone: local?.phone || prev.phone || '' }))
        })

        // onAuthStateChanged restores whatever Firebase last persisted
        // LOCALLY on this device — it doesn't hit the network. If you
        // verify your email on one device, a different device (or a
        // stale tab on this one) can keep showing "not verified"
        // indefinitely since its local session was never told. Reload
        // once from Firebase's servers whenever a restored session
        // looks unverified, so it self-corrects instead of lying.
        if (!snap.emailVerified) {
          checkVerified().then((fresh) => { if (fresh?.emailVerified) setFbUser(fresh) })
        }
      }
    })
    return unsub
  }, [])

  const authed = !!fbUser && fbUser.emailVerified

  // Polls/re-pulls verification status from Firebase without waiting for
  // onAuthStateChanged (which doesn't refire just because emailVerified flipped).
  const refreshEmailVerified = async () => {
    const snap = await checkVerified()
    setFbUser(snap)
    return snap?.emailVerified || false
  }

  // The verification-requests store (src/state/verifications.js) is the source of
  // truth — the team's review decision lands there. Re-sync from it whenever the
  // signed-in user changes, so an approval/decline made from /team is reflected
  // here without the customer having to do anything.
  const refreshVerification = useCallback(() => {
    const record = getVerificationFor(user.email)
    if (record) {
      setVerification(record.status)
      setVerificationMeta(record)
    } else {
      setVerification('unverified')
      setVerificationMeta(null)
    }
  }, [user.email])

  useEffect(() => refreshVerification(), [refreshVerification])

  // Same idea for warn/ban decisions made from /team — re-read on user change,
  // and poll lightly so a ban issued mid-session actually locks the account out.
  const refreshAccountStatus = useCallback(async () => {
    if (!user.email) { setAccountStatus(null); return null }
    const fresh = await getUser(user.email)
    setAccountStatus(fresh)
    return fresh
  }, [user.email])

  useEffect(() => {
    refreshAccountStatus()
    if (!authed) return
    const id = window.setInterval(refreshAccountStatus, 3000)
    return () => window.clearInterval(id)
  }, [refreshAccountStatus, authed])

  // Backfills a username for anyone who doesn't have one yet — old accounts
  // from before usernames existed, or a signup whose own claim lost a naming
  // race. Gated on `authed` (not just user.email) so it only ever runs once
  // email verification has gone through, well after Signup's own claim
  // attempt has already settled — no race between the two.
  const usernameEnsuredFor = useRef(new Set())
  useEffect(() => {
    if (!authed || !user.email) return
    if (usernameEnsuredFor.current.has(user.email)) return
    usernameEnsuredFor.current.add(user.email)
    getUser(user.email).then((fresh) => {
      if (fresh && !fresh.username) {
        ensureUsername(user.email, user.name || fresh.name).then(() => refreshAccountStatus())
      }
    })
  }, [authed, user.email, user.name, refreshAccountStatus])

  const setUser = (details) => {
    setUserState((prev) => {
      const merged = { ...prev, ...details }
      upsertUser(merged)
      return merged
    })
  }

  const logout = () => signOutUser().catch(() => {})

  // Submitted by the user — now waits on manual review by the Middleman team.
  const submitForReview = (meta) => {
    const record = submitVerification({ email: user.email, name: user.name, ...meta })
    setVerification(record.status)
    setVerificationMeta(record)
  }

  const banned = accountStatus?.status === 'banned'

  const value = {
    authed, authChecked, fbUser, refreshEmailVerified, user, setUser, verification, verificationMeta, logout, submitForReview, refreshVerification,
    accountStatus, refreshAccountStatus, banned,
  }

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}
