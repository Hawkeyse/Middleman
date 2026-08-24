import { flutterwaveFetch } from '../_lib/flutterwave.js'

// Re-checks the transaction status directly with Flutterwave using the secret
// key — never trust the client-side checkout's "successful" callback alone
// for real money. Verifying by tx_ref (not the numeric transaction id) means
// this also works for the interrupted-payment recovery flow, where all we
// have saved locally is the tx_ref generated before checkout even opened.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { tx_ref } = req.query
  if (!tx_ref) return res.status(400).json({ error: 'tx_ref is required' })

  try {
    const data = await flutterwaveFetch(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(tx_ref)}`)
    const tx = data.data
    res.status(200).json({
      status: tx.status === 'successful' ? 'success' : tx.status,
      amount: tx.amount,
      currency: tx.currency,
      reference: tx.tx_ref,
      dealCode: tx.meta?.dealCode || null,
    })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
