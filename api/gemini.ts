import type { VercelRequest, VercelResponse } from '@vercel/node'

const API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const { prompt, model = 'gemini-2.0-flash', jsonMode = false } = req.body ?? {}
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' })
    if (!API_KEY) return res.status(503).json({ error: 'Gemini API key not configured on server' })

    // Replace deprecated 1.x models silently
    const safeModel = String(model).startsWith('gemini-1') ? 'gemini-2.0-flash' : String(model)

    // gemini-2.0-flash first (non-thinking, reliably fast under Vercel's 10s limit)
    // gemini-2.5-flash as fallback (thinking model — may be slower)
    const candidates = [safeModel, 'gemini-2.0-flash', 'gemini-2.5-flash']
      .filter((m, i, a) => a.indexOf(m) === i)

    console.log(`[gemini] request model=${safeModel} jsonMode=${jsonMode} promptLen=${prompt.length}`)

    let lastError = 'Gemini unreachable'

    for (const m of candidates) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${API_KEY}`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 7_000)

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

        console.log(`[gemini] ${m} → HTTP ${upstream.status}`)

        if (upstream.ok) {
          const data = await upstream.json()
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
          const tokens = data.usageMetadata?.totalTokenCount ?? 0
          res.setHeader('Cache-Control', 'no-store')
          return res.status(200).json({ text, tokens, model: m })
        }

        const body = await upstream.text().catch(() => '')
        lastError = `${m} → HTTP ${upstream.status}: ${body.slice(0, 300)}`
        console.error(`[gemini] error: ${lastError}`)

        if (upstream.status === 403) break      // bad key — stop
        if (upstream.status >= 500) break       // Google error — stop
        // 400/404/429 → try next candidate
      } catch (e) {
        clearTimeout(timer)
        lastError = `${m} → ${String(e)}`
        console.error(`[gemini] exception: ${lastError}`)
      }
    }

    return res.status(502).json({ error: lastError })
  } catch (fatal) {
    console.error(`[gemini] fatal: ${String(fatal)}`)
    return res.status(500).json({ error: 'Fatal: ' + String(fatal) })
  }
}
