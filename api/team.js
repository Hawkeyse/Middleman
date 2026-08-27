import { randomBytes } from 'crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { requireTeam, requireOwner } from './_lib/requireTeam.js'
import { db, adminAuth } from './_lib/firebaseAdmin.js'
import { emailTemplates, notify } from './_lib/mailer.js'

// Every team-privileged route in one function, dispatched by ?resource=,
// instead of one file per resource — Vercel's Hobby plan caps a deployment
// at 12 serverless functions, and this app already has 7 pre-existing
// payment-provider routes it can't rename (paystack/flutterwave register
// their webhook URLs externally), so anything new has to consolidate to
// leave room. See src/utils/teamFetch.js for the client side.

// Called once right after the client signs into Firebase on the team login
// screen — requireTeam has already confirmed team_members membership by the
// time this runs, so this just hands back who they are.
async function handleLogin(req, res) {
  res.status(200).json({ email: req.team.email, role: req.team.role })
}

function generateTeamPassword() {
  return randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12)
}

// Owner-only: add/remove who can log into /team at all. Adding creates (or,
// if the email is already a Firebase Auth user — e.g. an existing customer
// — resets) their password and emails it, rather than routing a real
// password through the team dashboard's UI/network requests. Removing just
// deletes the team_members doc — it revokes dashboard access immediately
// without touching their actual Firebase account, since that might also be
// their regular customer login.
async function handleTeamMembers(req, res) {
  requireOwner(req.team)

  if (req.method === 'GET') {
    const snap = await db.collection('team_members').get()
    return res.status(200).json({ members: snap.docs.map((d) => d.data()) })
  }

  if (req.method === 'POST') {
    const { action, email } = req.body || {}
    if (!email) return res.status(400).json({ error: 'email is required' })

    if (action === 'add') {
      const password = generateTeamPassword()
      try {
        await adminAuth.createUser({ email, password })
      } catch (err) {
        if (err.code !== 'auth/email-already-exists') throw err
        const existing = await adminAuth.getUserByEmail(email)
        await adminAuth.updateUser(existing.uid, { password })
      }
      await db.collection('team_members').doc(email).set({ email, role: 'member', addedAt: new Date().toISOString(), addedBy: req.team.email })
      await notify(email, emailTemplates.teamInvite({ email, password }))
      return res.status(200).json({ ok: true })
    }

    if (action === 'remove') {
      if (email === req.team.email) return res.status(400).json({ error: "You can't remove yourself." })
      await db.collection('team_members').doc(email).delete()
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Unknown action' })
  }

  res.status(405).json({ error: 'Method not allowed' })
}

// "5d", "12h", "30m" -> milliseconds. Cooldown is optional (see
// firestore.rules/api/customer.js's assertNoActiveCooldown) — an
// unparseable or blank duration just means no restriction period, not an
// error, since the team should be able to warn someone without punishing them.
function parseDurationMs(input) {
  const m = /^(\d+)\s*(d|h|m)$/i.exec((input || '').trim())
  if (!m) return 0
  const n = Number(m[1])
  const mult = { d: 86400000, h: 3600000, m: 60000 }[m[2].toLowerCase()]
  return n * mult
}

async function handleUsers(req, res) {
  if (req.method === 'GET') {
    const snap = await db.collection('users').get()
    const users = snap.docs.map((d) => d.data()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    return res.status(200).json({ users })
  }

  if (req.method === 'POST') {
    const { action, email, reason, duration, owner } = req.body || {}
    if (!email) return res.status(400).json({ error: 'email is required' })
    const ref = db.collection('users').doc(email)

    if (action === 'warn') {
      const snap = await ref.get()
      if (!snap.exists) return res.status(404).json({ error: 'User not found' })
      const at = new Date().toISOString()
      // No duration set -> cooldownUntil = at (already expired), so the
      // customer sees the warning notice but isn't held to any restriction.
      const cooldownUntil = new Date(Date.now() + parseDurationMs(duration)).toISOString()
      const warningEntry = { reason: reason || 'No reason given.', at, cooldownUntil }
      const warnings = [...(snap.data().warnings || []), warningEntry]
      await ref.set({ status: 'warned', warnings, activeWarning: { ...warningEntry, acknowledged: false } }, { merge: true })
      await notify(email, emailTemplates.warning({ reason, cooldownUntil }))
    } else if (action === 'ban') {
      await ref.set({ status: 'banned', banReason: reason || 'Violated Middleman terms.', bannedAt: new Date().toISOString() }, { merge: true })
      await notify(email, emailTemplates.ban({ reason }))
    } else if (action === 'unban') {
      await ref.set({ status: 'active', banReason: null, bannedAt: null }, { merge: true })
      await notify(email, emailTemplates.unbanned())
    } else if (action === 'setOwner') {
      // Not payment-gated like premiumUntil — this is purely a team-side
      // toggle for marking the actual Middleman owner's own account.
      // Mirrored onto public_profiles the same way premiumUntil is, so the
      // 🔥 OWNER badge can render for other visitors without needing to
      // read the private users/{email} doc.
      const isOwner = !!owner
      await ref.set({ isOwner }, { merge: true })
      await db.collection('public_profiles').doc(email).set({ isOwner }, { merge: true })
    } else {
      return res.status(400).json({ error: 'Unknown action' })
    }

    const updated = await ref.get()
    return res.status(200).json({ user: updated.data() })
  }

  res.status(405).json({ error: 'Method not allowed' })
}

async function handleVerifications(req, res) {
  if (req.method === 'GET') {
    const snap = await db.collection('verifications').get()
    const records = snap.docs.map((d) => d.data()).sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))
    return res.status(200).json({ records })
  }

  if (req.method === 'POST') {
    const { id, status, reason } = req.body || {}
    if (!id || !['verified', 'declined'].includes(status)) return res.status(400).json({ error: 'id and a valid status are required' })
    const ref = db.collection('verifications').doc(id)
    const snap = await ref.get()
    if (!snap.exists) return res.status(404).json({ error: 'Request not found' })
    const decidedAt = new Date().toISOString()
    await ref.set({ status, reason: reason || null, decidedAt }, { merge: true })
    // id is the applicant's email (see src/state/verifications.js) — mirror
    // the verified flag onto their public profile so it can show a badge
    // without exposing the verification doc itself (docImage/selfieImage).
    await db.collection('public_profiles').doc(id).set({ verified: status === 'verified' }, { merge: true })
    await notify(id, status === 'verified' ? emailTemplates.verificationApproved() : emailTemplates.verificationDeclined({ reason }))
    return res.status(200).json({ record: { ...snap.data(), status, reason: reason || null, decidedAt } })
  }

  res.status(405).json({ error: 'Method not allowed' })
}

async function handleDeals(req, res) {
  if (req.method === 'GET') {
    const snap = await db.collection('deals').get()
    const deals = snap.docs.map((d) => d.data()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    return res.status(200).json({ deals })
  }

  if (req.method === 'POST') {
    const { code, decision } = req.body || {}
    if (!code || !['release', 'refund'].includes(decision)) return res.status(400).json({ error: 'code and a valid decision are required' })

    const dealRef = db.collection('deals').doc(code)
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(dealRef)
      if (!snap.exists) throw Object.assign(new Error('Deal not found'), { status: 404 })
      const deal = snap.data()
      if (deal.status !== 'disputed') throw Object.assign(new Error('This deal is not under dispute.'), { status: 409 })

      const resolvedAt = new Date().toISOString()
      const status = decision === 'release' ? 'released' : 'refunded'
      tx.update(dealRef, { status, disputeResolution: decision, resolvedAt })

      // 'refund' is handled manually outside the app (see Dashboard's
      // dispute-note copy) — only 'release' pays out through the app, so
      // only that one needs a transaction logged for it to show up in the
      // seller's balance.
      if (decision === 'release') {
        tx.set(db.collection('transactions').doc(), {
          type: 'release', dealCode: code, itemName: deal.itemName, amount: deal.sellerPayout ?? deal.amount, currency: deal.currency,
          chargedAmount: null, chargedCurrency: null, fee: null, sellerPayout: null,
          buyerEmail: deal.buyerEmail, sellerEmail: deal.sellerEmail, counterparty: deal.sellerName, at: resolvedAt,
        })
        tx.set(db.collection('public_profiles').doc(deal.sellerEmail), { completedDealsCount: FieldValue.increment(1) }, { merge: true })
      }

      return { ...deal, status, disputeResolution: decision, resolvedAt }
    })

    return res.status(200).json({ deal: result })
  }

  res.status(405).json({ error: 'Method not allowed' })
}

async function handleTransactions(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const snap = await db.collection('transactions').get()
  const transactions = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.at || '').localeCompare(a.at || ''))
  res.status(200).json({ transactions })
}

async function handleRefunds(req, res) {
  if (req.method === 'GET') {
    const snap = await db.collection('refund_requests').get()
    const requests = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''))
    return res.status(200).json({ requests })
  }

  if (req.method === 'POST') {
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id is required' })
    const ref = db.collection('refund_requests').doc(id)
    const snap = await ref.get()
    if (!snap.exists) return res.status(404).json({ error: 'Request not found' })
    const completedAt = new Date().toISOString()
    await ref.set({ status: 'completed', completedAt }, { merge: true })
    const { email, amount, currency } = snap.data()
    await notify(email, emailTemplates.refundSent({ amount, currency }))
    return res.status(200).json({ request: { id, ...snap.data(), status: 'completed', completedAt } })
  }

  res.status(405).json({ error: 'Method not allowed' })
}

async function handlePayouts(req, res) {
  if (req.method === 'GET') {
    const snap = await db.collection('payout_requests').get()
    const requests = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''))
    return res.status(200).json({ requests })
  }

  if (req.method === 'POST') {
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id is required' })
    const ref = db.collection('payout_requests').doc(id)
    const snap = await ref.get()
    if (!snap.exists) return res.status(404).json({ error: 'Request not found' })
    const request = snap.data()
    const completedAt = new Date().toISOString()

    const batch = db.batch()
    batch.set(ref, { status: 'completed', completedAt }, { merge: true })
    batch.set(db.collection('transactions').doc(), {
      type: 'payout', dealCode: null, itemName: 'Wallet payout', amount: request.amount, currency: request.currency,
      chargedAmount: null, chargedCurrency: null, fee: null, sellerPayout: null,
      buyerEmail: null, sellerEmail: request.email, counterparty: 'Middleman', at: completedAt,
    })
    await batch.commit()

    return res.status(200).json({ request: { id, ...request, status: 'completed', completedAt } })
  }

  res.status(405).json({ error: 'Method not allowed' })
}

async function handleChat(req, res) {
  if (req.method === 'GET') {
    const snap = await db.collection('chat_threads').get()
    const threads = await Promise.all(snap.docs.map(async (d) => {
      const msgsSnap = await db.collection('chat_threads').doc(d.id).collection('messages').orderBy('at').get()
      return { ...d.data(), messages: msgsSnap.docs.map((m) => ({ id: m.id, ...m.data() })) }
    }))
    threads.sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''))
    return res.status(200).json({ threads })
  }

  if (req.method === 'POST') {
    const { action, email, text, image, agentName } = req.body || {}
    if (!email) return res.status(400).json({ error: 'email is required' })
    const ref = db.collection('chat_threads').doc(email)
    const at = new Date().toISOString()

    if (action === 'send') {
      const snap = await ref.get()
      const existing = snap.exists ? snap.data() : null
      await ref.set({
        email, lastMessageAt: at, lastMessagePreview: (text || '').slice(0, 80),
        lastReadByTeamAt: at, unreadForCustomerCount: (existing?.unreadForCustomerCount || 0) + 1,
      }, { merge: true })
      await ref.collection('messages').add({ from: 'team', text: text || '', image: image || null, at })
    } else if (action === 'join') {
      // Someone typing their email into "your name" at the team gate
      // shouldn't leak into what the customer sees — fall back to the
      // local part of an email-shaped name, and always show as
      // "Middleman <name>" so it reads as a brand, not a raw name.
      const rawName = (agentName || '').trim()
      const cleanName = rawName.includes('@') ? rawName.split('@')[0] : rawName
      const displayName = cleanName ? `Middleman ${cleanName}` : 'Middleman Team'
      await ref.set({ email, status: 'active', agentName: displayName }, { merge: true })
      await ref.collection('messages').add({ from: 'system', text: `${displayName} has joined this chat.`, at })
    } else if (action === 'close') {
      await ref.set({ email, status: 'closed' }, { merge: true })
      await ref.collection('messages').add({ from: 'system', text: "This ticket has been closed. If you need anything else, message us again and we'll be right with you.", at })
    } else if (action === 'typing') {
      await ref.set({ email, teamTypingAt: Date.now() }, { merge: true })
    } else if (action === 'markRead') {
      await ref.set({ email, lastReadByTeamAt: at, unreadForTeamCount: 0 }, { merge: true })
    } else {
      return res.status(400).json({ error: 'Unknown action' })
    }

    return res.status(200).json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}

async function handleAnalytics(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  // Count aggregation queries (Firestore server-side count, not a full doc
  // read) keep this cheap even as users/deals grow — see
  // src/utils/analytics.js + firestore.rules for how visits gets counted.
  const [visitsSnap, usersCount, dealsCount] = await Promise.all([
    db.collection('analytics').doc('visits').get(),
    db.collection('users').count().get(),
    db.collection('deals').count().get(),
  ])
  res.status(200).json({
    totalVisits: visitsSnap.exists ? (visitsSnap.data().total || 0) : 0,
    totalUsers: usersCount.data().count,
    totalDeals: dealsCount.data().count,
  })
}

const RESOURCES = {
  login: handleLogin, users: handleUsers, verifications: handleVerifications,
  deals: handleDeals, transactions: handleTransactions, refunds: handleRefunds, payouts: handlePayouts,
  chat: handleChat, analytics: handleAnalytics, teamMembers: handleTeamMembers,
}

export default async function handler(req, res) {
  try {
    req.team = await requireTeam(req)
    const fn = RESOURCES[req.query.resource]
    if (!fn) return res.status(400).json({ error: 'Unknown resource' })
    await fn(req, res)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}
