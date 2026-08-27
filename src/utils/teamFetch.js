import { auth } from '../lib/firebase.js'

async function parseJson(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Server didn't return a valid response (${res.status}). If you're running locally, make sure you're using "vercel dev", not "vite dev" — the /api routes need it.`)
  }
}

// Team access is now a real per-person Firebase account (team_members
// collection, checked server-side in api/_lib/requireTeam.js) instead of a
// shared passcode header — same idea as authedFetch.js, just for /api/team.
export async function teamFetch(path, { method = 'GET', body } = {}) {
  if (!auth.currentUser) throw new Error('Not signed in.')
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
