const STORAGE_KEY = 'mm_verification_requests'

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

function writeAll(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // storage unavailable — still returns the record for the current session
  }
}

// NOTE: localStorage stands in for a real backend/review-queue here. In production
// this would be a server-side table the team's admin tooling reads from directly,
// not something derived from the applicant's own browser storage.
export function submitVerification({ email, name, country, age, dob, docType, docImage, selfieImage }) {
  const all = readAll()
  const id = email || `guest-${Date.now()}`
  all[id] = {
    id, email, name, country, age, dob, docType, docImage, selfieImage,
    status: 'pending', reason: null, submittedAt: new Date().toISOString(), decidedAt: null,
  }
  writeAll(all)
  return all[id]
}

export function getVerificationFor(email) {
  if (!email) return null
  return readAll()[email] || null
}

export function listVerifications() {
  return Object.values(readAll()).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
}

export function setVerificationStatus(id, status, reason) {
  const all = readAll()
  if (!all[id]) return null
  all[id] = { ...all[id], status, reason: reason || null, decidedAt: new Date().toISOString() }
  writeAll(all)
  return all[id]
}
