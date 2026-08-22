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

// Same localStorage-as-backend-stand-in caveat as deals.js/verifications.js —
// a real build needs a server (and ideally realtime) so team replies actually
// reach the customer on a different device.
export function sendMessage(email, { from, text, name }) {
  const all = readAll()
  if (!all[email]) all[email] = { email, name, messages: [], lastReadByCustomer: null, lastReadByTeam: null }
  if (name) all[email].name = name
  all[email].messages.push({ from, text, at: new Date().toISOString() })
  // Sending counts as having read your own thread up to now.
  all[email][readKey(from)] = new Date().toISOString()
  writeAll(all)
  return all[email]
}

export function getThread(email) {
  if (!email) return null
  return readAll()[email] || null
}

export function listThreads() {
  return Object.values(readAll()).sort((a, b) => {
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
