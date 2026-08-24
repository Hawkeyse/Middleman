// Flutterwave calls this server-to-server on events (charge.completed, transfer.completed,
// etc). Unlike Paystack, it doesn't sign the body — it just echoes back a static
// secret you set in the dashboard (Settings -> Webhooks -> Secret hash) in the
// "verif-hash" header, so verification is a plain string comparison.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const secretHash = process.env.FLW_SECRET_HASH
  if (!secretHash) return res.status(500).json({ error: 'FLW_SECRET_HASH is not configured' })

  const signature = req.headers['verif-hash']
  if (!signature || signature !== secretHash) return res.status(401).json({ error: 'Invalid signature' })

  const event = req.body || {}

  // NOTE: there's no server-side database yet — deal/transaction state lives in
  // the browser's localStorage (see src/state/). This handler only proves the
  // event genuinely came from Flutterwave for now. Once deals move to a real
  // store, this is where a deposit gets marked paid / a transfer gets marked
  // complete, independent of whether the buyer's tab is still open.
  console.log('Flutterwave webhook event:', event.event, event.data?.tx_ref)

  res.status(200).json({ received: true })
}
