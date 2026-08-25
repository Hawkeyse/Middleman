import { FieldValue } from 'firebase-admin/firestore'
import { requireUser } from './_lib/requireUser.js'
import { db } from './_lib/firebaseAdmin.js'
import { paystackFetch } from './_lib/paystack.js'
import { flutterwaveFetch } from './_lib/flutterwave.js'
import { normalizeUsername, usernameError } from '../src/utils/usernameRules.js'

// Every signed-in-user (requireUser) action that has to be server-side —
// money moves, or a rate-limited/history field firestore.rules blocks a
// direct client write from touching — dispatched by `action` in one
// function instead of one route per action. Vercel's Hobby plan caps a
// deployment at 12 serverless functions, and this app already has 7
// pre-existing payment-provider routes it can't rename (paystack/
// flutterwave register their webhook URLs externally), so anything new has
// to consolidate to leave room. See src/state/deals.js, wallet.js,
// payoutRequests.js, users.js for the client side.

const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000

async function acceptDeal(buyerEmail, { code, name }) {
  if (!code) throw Object.assign(new Error('code is required'), { status: 400 })
  const dealRef = db.collection('deals').doc(code)
  const deal = await db.runTransaction(async (tx) => {
    const dealSnap = await tx.get(dealRef)
    if (!dealSnap.exists) throw Object.assign(new Error('Deal not found'), { status: 404 })
    const deal = dealSnap.data()
    if (deal.status !== 'pending-acceptance') {
      throw Object.assign(new Error('This deal is no longer available.'), { status: 409 })
    }

    const walletQuery = db.collection('wallet_entries').where('email', '==', buyerEmail).where('currency', '==', deal.currency)
    const walletSnap = await tx.get(walletQuery)
    let balance = 0
    walletSnap.forEach((d) => {
      const e = d.data()
      balance += e.type === 'deposit' ? e.amount : -e.amount
    })
    if (balance < deal.buyerTotal) throw Object.assign(new Error('Insufficient wallet balance.'), { status: 402 })

    const at = new Date().toISOString()
    tx.set(db.collection('wallet_entries').doc(), {
      email: buyerEmail, type: 'spend', amount: deal.buyerTotal, currency: deal.currency,
      dealCode: code, note: '', at,
    })
    tx.set(db.collection('transactions').doc(), {
      type: 'deposit', dealCode: code, itemName: deal.itemName, amount: deal.buyerTotal, currency: deal.currency,
      chargedAmount: null, chargedCurrency: null, fee: deal.fee ?? null, sellerPayout: deal.sellerPayout ?? null,
      buyerEmail, sellerEmail: deal.sellerEmail, counterparty: deal.sellerName, at,
    })
    tx.update(dealRef, { status: 'paid', buyerEmail, buyerName: name || '', paidAt: at })

    return { ...deal, status: 'paid', buyerEmail, buyerName: name || '', paidAt: at }
  })
  return { deal }
}

async function releaseDeal(buyerEmail, { code }) {
  if (!code) throw Object.assign(new Error('code is required'), { status: 400 })
  const dealRef = db.collection('deals').doc(code)
  const deal = await db.runTransaction(async (tx) => {
    const dealSnap = await tx.get(dealRef)
    if (!dealSnap.exists) throw Object.assign(new Error('Deal not found'), { status: 404 })
    const deal = dealSnap.data()
    if (deal.status !== 'paid' || deal.buyerEmail !== buyerEmail) {
      throw Object.assign(new Error('You cannot release this deal.'), { status: 403 })
    }

    const releasedAt = new Date().toISOString()
    tx.update(dealRef, { status: 'released', releasedAt })
    tx.set(db.collection('transactions').doc(), {
      type: 'release', dealCode: code, itemName: deal.itemName, amount: deal.sellerPayout ?? deal.amount, currency: deal.currency,
      chargedAmount: null, chargedCurrency: null, fee: null, sellerPayout: null,
      buyerEmail: deal.buyerEmail, sellerEmail: deal.sellerEmail, counterparty: deal.sellerName, at: releasedAt,
    })
    tx.set(db.collection('public_profiles').doc(deal.sellerEmail), { completedDealsCount: FieldValue.increment(1) }, { merge: true })

    return { ...deal, status: 'released', releasedAt }
  })
  return { deal }
}

async function verifyProviderPayment(provider, reference) {
  if (provider === 'paystack') {
    const data = await paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`)
    const tx = data.data
    return { status: tx.status, amount: tx.amount / 100, currency: tx.currency }
  }
  const data = await flutterwaveFetch(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`)
  const tx = data.data
  return { status: tx.status === 'successful' ? 'success' : tx.status, amount: tx.amount, currency: tx.currency }
}

async function depositWallet(email, { provider, reference }) {
  if (!provider || !reference) throw Object.assign(new Error('provider and reference are required'), { status: 400 })

  const entryRef = db.collection('wallet_entries').doc(`${provider}:${reference}`)
  const existing = await entryRef.get()
  if (existing.exists) return { entry: { id: existing.id, ...existing.data() }, alreadyCredited: true }

  const verified = await verifyProviderPayment(provider, reference)
  if (verified.status !== 'success') throw Object.assign(new Error('Payment was not successful. No funds were moved.'), { status: 402 })

  const entry = { email, type: 'deposit', amount: verified.amount, currency: verified.currency, dealCode: null, note: '', at: new Date().toISOString() }
  await entryRef.set(entry)
  return { entry: { id: entryRef.id, ...entry } }
}

async function refundWallet(email, { amount, currency, note }) {
  const amt = Number(amount)
  if (!amt || amt <= 0) throw Object.assign(new Error('Enter an amount.'), { status: 400 })
  const cur = currency || 'GHS'

  const walletQuery = db.collection('wallet_entries').where('email', '==', email).where('currency', '==', cur)
  const at = new Date().toISOString()
  const requestRef = db.collection('refund_requests').doc()

  const request = await db.runTransaction(async (tx) => {
    const snap = await tx.get(walletQuery)
    let balance = 0
    snap.forEach((d) => { const e = d.data(); balance += e.type === 'deposit' ? e.amount : -e.amount })
    if (amt > balance) throw Object.assign(new Error(`You only have ${cur} ${balance.toFixed(2)} available.`), { status: 402 })

    const request = { email, amount: amt, currency: cur, note: note || '', status: 'pending', requestedAt: at, completedAt: null }
    tx.set(db.collection('wallet_entries').doc(), { email, type: 'refund', amount: amt, currency: cur, dealCode: null, note: note || '', at })
    tx.set(requestRef, request)
    return { id: requestRef.id, ...request }
  })
  return { request }
}

async function requestPayout(email, { amount, currency, note }) {
  const amt = Number(amount)
  if (!amt || amt <= 0) throw Object.assign(new Error('Enter an amount.'), { status: 400 })
  const cur = currency || 'GHS'

  const userSnap = await db.collection('users').doc(email).get()
  if (!userSnap.data()?.payoutMethod) throw Object.assign(new Error('Add a payout method in your profile first.'), { status: 400 })

  const txQuery = db.collection('transactions').where('sellerEmail', '==', email).where('currency', '==', cur)
  const at = new Date().toISOString()
  const requestRef = db.collection('payout_requests').doc()

  const request = await db.runTransaction(async (tx) => {
    const snap = await tx.get(txQuery)
    let balance = 0
    snap.forEach((d) => {
      const t = d.data()
      if (t.type === 'release') balance += Number(t.amount)
      else if (t.type === 'payout') balance -= Number(t.amount)
    })
    if (amt > balance) throw Object.assign(new Error(`You only have ${cur} ${balance.toFixed(2)} available.`), { status: 402 })

    const request = { email, amount: amt, currency: cur, note: note || '', status: 'pending', requestedAt: at, completedAt: null }
    tx.set(requestRef, request)
    return { id: requestRef.id, ...request }
  })
  return { request }
}

async function renameUsername(email, { username }) {
  const newUsername = normalizeUsername(username)
  const err = usernameError(newUsername)
  if (err) throw Object.assign(new Error(err), { status: 400 })

  const userRef = db.collection('users').doc(email)
  const publicRef = db.collection('public_profiles').doc(email)
  const newNameRef = db.collection('usernames').doc(newUsername)

  return db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef)
    if (!userSnap.exists) throw Object.assign(new Error('Account not found'), { status: 404 })
    const user = userSnap.data()
    const oldUsername = user.username || ''
    if (!oldUsername) throw Object.assign(new Error("You don't have a username yet — set one from your profile first."), { status: 400 })
    if (oldUsername === newUsername) throw Object.assign(new Error("That's already your username."), { status: 400 })

    if (user.lastUsernameChangeAt) {
      const nextAllowed = new Date(user.lastUsernameChangeAt).getTime() + COOLDOWN_MS
      if (Date.now() < nextAllowed) {
        const daysLeft = Math.ceil((nextAllowed - Date.now()) / (24 * 60 * 60 * 1000))
        throw Object.assign(new Error(`You can change your username again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`), { status: 429 })
      }
    }

    const takenSnap = await tx.get(newNameRef)
    if (takenSnap.exists) throw Object.assign(new Error('That username is taken.'), { status: 409 })

    const now = new Date().toISOString()
    const usernameHistory = [...(user.usernameHistory || []), { username: oldUsername, retiredAt: now }]

    tx.set(newNameRef, { email, name: user.name || '' })
    tx.set(userRef, { username: newUsername, usernameHistory, lastUsernameChangeAt: now }, { merge: true })
    tx.set(publicRef, { username: newUsername, usernameHistory, name: user.name || '' }, { merge: true })

    return { username: newUsername, usernameHistory, lastUsernameChangeAt: now }
  })
}

// Sends a customer message, creating the thread if this is their first one
// and reopening it if the last agent closed it. lastMessage*/
// unreadForTeamCount are denormalized here so the team's thread list is a
// cheap read instead of pulling every thread's full message history.
async function sendChatMessage(email, { text, image, name }) {
  const threadRef = db.collection('chat_threads').doc(email)
  const at = new Date().toISOString()

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(threadRef)
    const existing = snap.exists ? snap.data() : null
    const status = existing?.status === 'closed' ? 'waiting' : (existing?.status || 'waiting')

    tx.set(threadRef, {
      email, name: name || existing?.name || '', status,
      lastMessageAt: at, lastMessagePreview: (text || '').slice(0, 80),
      lastReadByCustomerAt: at,
      unreadForTeamCount: (existing?.unreadForTeamCount || 0) + 1,
    }, { merge: true })

    tx.set(threadRef.collection('messages').doc(), { from: 'customer', text: text || '', image: image || null, at })
  })

  return { ok: true }
}

async function chatTyping(email) {
  await db.collection('chat_threads').doc(email).set({ email, customerTypingAt: Date.now() }, { merge: true })
  return { ok: true }
}

async function markChatRead(email) {
  await db.collection('chat_threads').doc(email).set({ lastReadByCustomerAt: new Date().toISOString(), unreadForCustomerCount: 0 }, { merge: true })
  return { ok: true }
}

const ACTIONS = {
  acceptDeal, releaseDeal, depositWallet, refundWallet, requestPayout, renameUsername,
  sendChatMessage, chatTyping, markChatRead,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const email = await requireUser(req)
    const { action, ...payload } = req.body || {}
    const fn = ACTIONS[action]
    if (!fn) return res.status(400).json({ error: 'Unknown action' })
    res.status(200).json(await fn(email, payload))
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}
