import crypto from 'node:crypto'

// Paystack calls this server-to-server on events (charge.success, transfer.success, etc).
// Body parsing is disabled so we can hash the exact raw bytes Paystack signed —
// parsing to JSON first and re-stringifying can produce a different byte sequence
// and make the signature check fail.
export const config = { api: { bodyParser: false } }

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) return res.status(500).json({ error: 'PAYSTACK_SECRET_KEY is not configured' })

  const raw = await readRawBody(req)
  const signature = req.headers['x-paystack-signature']
  const expected = crypto.createHmac('sha512', secretKey).update(raw).digest('hex')

  if (signature !== expected) return res.status(401).json({ error: 'Invalid signature' })

  const event = JSON.parse(raw)

  // NOTE: there's no server-side database yet — deal/transaction state lives in
  // the browser's localStorage (see src/state/). This handler only proves the
  // event genuinely came from Paystack for now. Once deals move to a real store,
  // this is where a deposit gets marked paid / a transfer gets marked complete,
  // independent of whether the buyer's tab is still open.
  console.log('Paystack webhook event:', event.event, event.data?.reference || event.data?.transfer_code)

  res.status(200).json({ received: true })
}
