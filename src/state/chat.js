import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { authedFetch } from '../utils/authedFetch.js'
import { teamFetch } from '../utils/teamFetch.js'

// Firestore-backed — see firestore.rules. A customer can read their own
// thread directly, but every write (send, typing, join/close, marking
// read) goes through api/customer.js / api/team.js instead — unread counts
// and lastMessage* are denormalized onto the thread doc for a cheap list/
// badge read, and keeping those in sync with the messages subcollection is
// simplest to just always do server-side.

const TYPING_TTL_MS = 3000

export async function getThread(email) {
  if (!email) return null
  const snap = await getDoc(doc(db, 'chat_threads', email))
  if (!snap.exists()) return null
  const thread = { status: 'waiting', ...snap.data() }
  const msgsSnap = await getDocs(query(collection(db, 'chat_threads', email, 'messages'), orderBy('at')))
  thread.messages = msgsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  return thread
}

export async function sendMessage(email, { text, image, name }) {
  await authedFetch('/api/customer', { body: { action: 'sendChatMessage', text, image, name } })
  return getThread(email)
}

export function setTyping() {
  authedFetch('/api/customer', { body: { action: 'chatTyping' } }).catch(() => {})
}

export async function markRead(email) {
  if (!email) return
  try { await authedFetch('/api/customer', { body: { action: 'markChatRead' } }) } catch { /* best-effort */ }
}

// Reads straight off an already-fetched thread rather than a live listener —
// the TTL check still re-evaluates on its own poll (see SupportChat.jsx/
// Team.jsx) so the indicator disappears on schedule even between fetches.
export function typingFrom(thread, exceptRole) {
  if (!thread) return null
  const now = Date.now()
  if (exceptRole !== 'team' && thread.teamTypingAt && now - thread.teamTypingAt < TYPING_TTL_MS) return 'team'
  if (exceptRole !== 'customer' && thread.customerTypingAt && now - thread.customerTypingAt < TYPING_TTL_MS) return 'customer'
  return null
}

export async function getUnreadCount(email) {
  const thread = await getThread(email)
  return thread?.unreadForCustomerCount || 0
}

export async function getTotalUnread() {
  try {
    const { threads } = await teamFetch('/api/team?resource=chat')
    return threads.reduce((sum, t) => sum + (t.unreadForTeamCount || 0), 0)
  } catch {
    return 0
  }
}
