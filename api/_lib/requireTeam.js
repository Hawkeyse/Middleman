// Every team-privileged write (approve a verification, resolve a dispute,
// warn/ban a user, mark a payout/refund complete) checks this server-side
// instead of trusting the client's sessionStorage unlock flag — the old
// version compared against a passcode sitting in plaintext in the shipped JS
// bundle, which anyone could read via view-source.
export function requireTeam(req) {
  const passcode = process.env.TEAM_PASSCODE
  if (!passcode) throw Object.assign(new Error('TEAM_PASSCODE is not configured'), { status: 500 })
  const provided = req.headers['x-team-passcode']
  if (!provided || provided !== passcode) throw Object.assign(new Error('Invalid team passcode'), { status: 401 })
}
