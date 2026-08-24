async function parseJson(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Server didn't return a valid response (${res.status}). If you're running locally, make sure you're using "vercel dev", not "vite dev" — the /api routes need it.`)
  }
}

// Every team resource re-checks this passcode server-side (api/team.js, via
// api/_lib/requireTeam.js) — sessionStorage just remembers what was typed at
// the gate so it doesn't have to be re-entered on every action.
export async function teamFetch(path, { method = 'GET', body } = {}) {
  const code = sessionStorage.getItem('mm_team_code') || ''
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-team-passcode': code },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await parseJson(res)
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}
