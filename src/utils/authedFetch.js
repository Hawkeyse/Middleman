import { auth } from '../lib/firebase.js'

async function parseJson(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Server didn't return a valid response (${res.status}). If you're running locally, make sure you're using "vercel dev", not "vite dev" — the /api routes need it.`)
  }
}

// For any server route that performs a real financial or account mutation on
// behalf of the signed-in user — the server verifies this token with the
// admin SDK rather than trusting a client-supplied email, so the acting user
// can't be spoofed.
export async function authedFetch(path, { method = 'POST', body } = {}) {
  if (!auth.currentUser) throw new Error('You need to be signed in.')
  const idToken = await auth.currentUser.getIdToken()
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await parseJson(res)
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}
