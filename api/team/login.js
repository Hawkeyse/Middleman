import { requireTeam } from '../_lib/requireTeam.js'

// Just proves the passcode is right — the client then remembers it (in
// sessionStorage) and sends it as the x-team-passcode header on every
// subsequent privileged team call, which each re-check independently.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    requireTeam(req)
    res.status(200).json({ ok: true })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}
