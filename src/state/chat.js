const STORAGE_KEY = 'mm_support_threads'

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

function writeAll(threads) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads))
    // Same-tab listeners (storage events only fire in *other* tabs/windows).
    // Dispatched async so a handler that writes again (e.g. marking read)
    // can't recurse into itself synchronously and blow the call stack.
    window.setTimeout(() => window.dispatchEvent(new Event('mm-chat-updated')), 0)
  } catch {
    // storage unavailable — still returns the message for the current session
  }
}

const readKey = (role) => (role === 'team' ? 'lastReadByTeam' : 'lastReadByCustomer')

// status: 'waiting' (no agent has joined yet) | 'active' (an agent joined) |
// 'closed' (team ended the ticket — a new customer message reopens it).
// Threads created before this existed have no status on disk; infer one so
// old conversations don't all suddenly show "waiting for an agent".
function normalize(thread) {
  if (!thread) return thread
  if (thread.status) return thread
  const status = thread.messages.some((m) => m.from === 'team') ? 'active' : 'waiting'
  return { ...thread, status }
}

// Same localStorage-as-backend-stand-in caveat as deals.js/verifications.js —
// a real build needs a server (and ideally realtime) so team replies actually
// reach the customer on a different device.
export function sendMessage(email, { from, text, image, name }) {
  const all = readAll()
  if (!all[email]) all[email] = { email, name, messages: [], status: 'waiting', lastReadByCustomer: null, lastReadByTeam: null }
  if (name) all[email].name = name
  // A customer messaging a closed ticket reopens it and puts it back in the queue.
  if (from === 'customer' && normalize(all[email]).status === 'closed') all[email].status = 'waiting'
  all[email].messages.push({ from, text: text || '', image: image || null, at: new Date().toISOString() })
  all[email][readKey(from)] = new Date().toISOString()
  writeAll(all)
  return normalize(all[email])
}

// ---- typing indicator ----
// Kept in a separate storage key/event from the threads themselves — typing
// fires on every keystroke, and we don't want that triggering a full
// re-fetch of every list Team.jsx's 'mm-chat-updated' handler reloads.
const TYPING_KEY = 'mm_chat_typing'
const TYPING_TTL_MS = 3000

function readTyping() {
  try { return JSON.parse(localStorage.getItem(TYPING_KEY)) || {} } catch { return {} }
}

export function setTyping(email, role) {
  if (!email) return
  const all = readTyping()
  all[email] = { ...all[email], [role]: Date.now() }
  try {
    localStorage.setItem(TYPING_KEY, JSON.stringify(all))
    window.dispatchEvent(new Event('mm-typing-updated'))
  } catch {
    // storage unavailable — typing indicator just won't show, not fatal
  }
}

// Returns the role currently typing (excluding `exceptRole`, so you don't see
// your own "typing…" reflected back), or null if nobody recently was.
export function getTypingRole(email, exceptRole) {
  if (!email) return null
  const entry = readTyping()[email]
  if (!entry) return null
  const now = Date.now()
  for (const role of ['team', 'customer']) {
    if (role === exceptRole) continue
    if (entry[role] && now - entry[role] < TYPING_TTL_MS) return role
  }
  return null
}

// A team member claims an unattended thread.
export function joinThread(email, agentName) {
  const all = readAll()
  if (!all[email]) return null
  all[email].status = 'active'
  all[email].messages.push({ from: 'system', text: `${agentName || 'A Middleman agent'} has joined this chat.`, at: new Date().toISOString() })
  writeAll(all)
  return all[email]
}

// Team ends the ticket — customer can still message again, which reopens it.
export function closeThread(email) {
  const all = readAll()
  if (!all[email]) return null
  all[email].status = 'closed'
  all[email].messages.push({ from: 'system', text: "This ticket has been closed. If you need anything else, message us again and we'll be right with you.", at: new Date().toISOString() })
  writeAll(all)
  return all[email]
}

export function getThread(email) {
  if (!email) return null
  return normalize(readAll()[email])
}

export function listThreads() {
  return Object.values(readAll()).map(normalize).sort((a, b) => {
    const aLast = a.messages[a.messages.length - 1]?.at || ''
    const bLast = b.messages[b.messages.length - 1]?.at || ''
    return bLast.localeCompare(aLast)
  })
}

export function markRead(email, role) {
  const all = readAll()
  if (!all[email]) return
  all[email][readKey(role)] = new Date().toISOString()
  writeAll(all)
}

// Count of messages from the *other* party sent after this role last read.
export function getUnreadCount(email, role) {
  const thread = getThread(email)
  if (!thread) return 0
  const lastRead = thread[readKey(role)]
  const otherRole = role === 'team' ? 'customer' : 'team'
  return thread.messages.filter((m) => m.from === otherRole && (!lastRead || m.at > lastRead)).length
}

export function getTotalUnread(role) {
  return listThreads().reduce((sum, t) => sum + getUnreadCount(t.email, role), 0)
}
