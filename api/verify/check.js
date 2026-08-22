// Automated pre-filter for identity verification submissions — NOT a
// certified KYC service. It catches obvious problems (no face, wrong/
// irrelevant image, an expired document) before they reach the team's
// review queue in src/state/verifications.js + /team. A human still makes
// the actual approve/decline call there; this just saves them from
// reviewing garbage submissions.

const DOC_LABELS = {
  passport: 'international passport',
  'national-id': 'national ID card',
  license: "driver's license",
  'ghana-card': 'Ghana Card',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { docImage, docType, selfieImage } = req.body || {}
  if (!docImage || !selfieImage) return res.status(400).json({ error: 'docImage and selfieImage are required' })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' })

  const today = new Date().toISOString().slice(0, 10)
  const docLabel = DOC_LABELS[docType] || 'government-issued ID document'

  const prompt = `You are a strict but fair pre-screener for an identity verification queue. Today's date is ${today}.

You are given two images: the FIRST is a live selfie, the SECOND is a photo of the applicant's ${docLabel}.

Check the selfie: is exactly one real human face clearly visible, reasonably well-lit, and unobstructed (no sunglasses, mask, or heavy shadow covering the face)? Reject cartoons, screenshots, photos-of-a-screen, or anything that isn't a genuine live photo of a person.

Check the document: does it plausibly show a real ${docLabel} with legible text? If an expiry date is visible, compare it to today's date. If the image is clearly unrelated (a random object, meme, blank page, someone else's photo, etc.), that is not a valid document.

Also flag if either image looks like a deliberate joke/troll submission rather than a genuine attempt.

Respond with ONLY a JSON object, no other text, in this exact shape:
{
  "faceVisible": boolean,
  "documentLooksValid": boolean,
  "expired": boolean,
  "trolling": boolean,
  "retryTarget": "selfie" | "document" | "both" | "none",
  "summary": "one short plain-English sentence explaining the verdict, written to the applicant"
}
"retryTarget" is "none" only if faceVisible is true AND documentLooksValid is true AND expired is false AND trolling is false. Otherwise pick whichever of "selfie"/"document"/"both" needs to be retaken.`

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        max_tokens: 400,
        messages: [
          { role: 'system', content: 'You are a precise, literal image-verification assistant. You only output valid JSON.' },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: selfieImage } },
              { type: 'image_url', image_url: { url: docImage } },
            ],
          },
        ],
      }),
    })

    const data = await openaiRes.json()
    if (!openaiRes.ok) throw new Error(data.error?.message || `OpenAI request failed (${openaiRes.status})`)

    const verdict = JSON.parse(data.choices?.[0]?.message?.content || '{}')
    const overallOk = !!verdict.faceVisible && !!verdict.documentLooksValid && !verdict.expired && !verdict.trolling

    res.status(200).json({
      faceVisible: !!verdict.faceVisible,
      documentLooksValid: !!verdict.documentLooksValid,
      expired: !!verdict.expired,
      trolling: !!verdict.trolling,
      retryTarget: verdict.retryTarget || (overallOk ? 'none' : 'both'),
      summary: verdict.summary || (overallOk ? 'Looks good.' : 'Please retake your photos.'),
      overallOk,
    })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
