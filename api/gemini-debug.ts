import type { VercelRequest, VercelResponse } from '@vercel/node'

// Temporary debug endpoint — remove after diagnosing the Gemini 502 issue
// Visit: /api/gemini-debug  (GET)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY
  const keyPresent = !!key
  const keyPreview = key ? `${key.slice(0, 8)}...${key.slice(-4)}` : 'NOT SET'

  // Quick ping to one model
  let pingStatus = 0
  let pingBody = ''
  if (key) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Say hi' }] }], generationConfig: { maxOutputTokens: 10 } }),
          signal: AbortSignal.timeout(8000),
        }
      )
      pingStatus = r.status
      pingBody = (await r.text()).slice(0, 300)
    } catch (e) { pingBody = String(e) }
  }

  return res.status(200).json({ keyPresent, keyPreview, pingStatus, pingBody })
}
