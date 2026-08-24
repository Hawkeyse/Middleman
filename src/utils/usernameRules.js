// Pure username validation — no Firestore import, so this can be shared
// between the client (src/state/users.js) and server routes (api/users/
// rename.js) without either pulling in the other's SDK.

const USERNAME_RE = /^[a-z0-9_]{3,20}$/

// Slurs and profanity to block from usernames, which are public (see the
// usernames/{username} directory rule) and shown to counterparties on every
// deal. Checked against a normalized form so common leetspeak/underscore
// evasions (n1gga, n_i_g_g_a) still get caught.
const BLOCKED_TERMS = [
  'nigger', 'nigga', 'nigg', 'faggot', 'fag', 'retard', 'retarded', 'tranny',
  'chink', 'spic', 'kike', 'gook', 'wetback', 'coon', 'beaner', 'paki',
  'rape', 'rapist', 'nazi', 'hitler',
  'fuck', 'shit', 'bitch', 'cunt', 'whore', 'slut', 'dick', 'pussy', 'cock',
  'asshole', 'bastard', 'motherfucker',
]

function deleetify(u) {
  return u.replace(/_/g, '')
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
    .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't')
}

export function normalizeUsername(raw) {
  return (raw || '').trim().toLowerCase()
}

export function usernameError(raw) {
  const u = normalizeUsername(raw)
  if (!u) return 'Pick a username.'
  if (!USERNAME_RE.test(u)) return '3-20 characters: lowercase letters, numbers, underscores only.'
  const plain = deleetify(u)
  if (BLOCKED_TERMS.some((term) => plain.includes(term))) return 'That username isn\'t allowed.'
  return ''
}
