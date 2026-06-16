import type { VercelRequest, VercelResponse } from '@vercel/node'

const API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const { prompt, model = 'gemini-2.5-flash', jsonMode = false } = req.body ?? {}
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' })
    if (!API_KEY) return res.status(503).json({ error: 'Gemini API key not configured on server' })

    // Reject deprecated 1.x models — replace silently so stale DB values don't break anything
    const safeModel = String(model).startsWith('gemini-1') ? 'gemini-2.5-flash' : String(model)

    // Try requested model first, then stable fallbacks. Each attempt has 4s before we move on,
    // keeping total runtime well under Vercel Hobby's 10s limit.
    const candidates = [safeModel, 'gemini-2.5-flash', 'gemini-2.0-flash']
      .filter((m, i, a) => a.indexOf(m) === i)

    let lastError = 'Gemini unreachable'

    for (const m of candidates) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${API_KEY}`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4_000)

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
        clearTimeout(timer)

        if (upstream.ok) {
          const data = await upstream.json()
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
          const tokens = data.usageMetadata?.totalTokenCount ?? 0
          res.setHeader('Cache-Control', 'no-store')
          return res.status(200).json({ text, tokens, model: m })
        }

        clearTimeout(timer)
        const body = await upstream.text().catch(() => '')
        lastError = `${m} → HTTP ${upstream.status}: ${body.slice(0, 200)}`

        if (upstream.status === 429) continue   // quota — try next model
        if (upstream.status === 403) break      // bad key — stop immediately
        if (upstream.status >= 500) break       // Google-side error — stop
        // 400 / 404 = model not found or invalid request → try next
      } catch (e) {
        clearTimeout(timer)
        lastError = `${m} → ${String(e)}`
        // timeout / network — try next candidate
      }
    }

    return res.status(502).json({ error: lastError })
  } catch (fatal) {
    return res.status(500).json({ error: 'Fatal: ' + String(fatal) })
  }
}
