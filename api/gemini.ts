import type { VercelRequest, VercelResponse } from '@vercel/node'

// GEMINI_API_KEY must be set in Vercel env vars WITHOUT the VITE_ prefix
// so it never gets bundled into the client JavaScript
const API_KEY = process.env.GEMINI_API_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, model = 'gemini-1.5-flash', jsonMode = false } = req.body ?? {}
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' })
  if (!API_KEY) return res.status(503).json({ error: 'Gemini API key not configured on server' })

  // Prefer stable models; gemini-2.5-flash requires a preview suffix that changes
  const candidates = [model, 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-8b']
    .filter((m, i, a) => a.indexOf(m) === i)

  let lastError = 'Gemini unreachable'
  for (const m of candidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${API_KEY}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20_000)
    try {
      const upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: jsonMode ? 4096 : 2048,
            temperature: 0.7,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
          },
        }),
      })
      clearTimeout(timeout)

      if (upstream.ok) {
        const data = await upstream.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        const tokens = data.usageMetadata?.totalTokenCount ?? 0
        res.setHeader('Cache-Control', 'no-store')
        return res.status(200).json({ text, tokens, model: m })
      }

      if (upstream.status === 429) { lastError = 'Gemini 429: quota exceeded'; continue }
      const body = await upstream.text().catch(() => '')
      lastError = `Gemini ${upstream.status}: ${body.slice(0, 120)}`
      if (upstream.status === 403 || upstream.status >= 500) break
      // 404/400 = model not found or bad request, try next candidate
    } catch (e) {
      clearTimeout(timeout)
      lastError = String(e)
    }
  }

  return res.status(502).json({ error: lastError })
}
