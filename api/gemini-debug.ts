import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY
  const keyPresent = !!key
  const keyPreview = key ? `${key.slice(0, 8)}...${key.slice(-4)}` : 'NOT SET'

  const results: Record<string, { status: number; body: string }> = {}

  if (key) {
    for (const model of ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']) {
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: 'Say hi' }] }], generationConfig: { maxOutputTokens: 10 } }),
            signal: AbortSignal.timeout(8000),
          }
        )
        results[model] = { status: r.status, body: (await r.text()).slice(0, 300) }
      } catch (e) {
        results[model] = { status: 0, body: String(e) }
      }
    }
  }

  return res.status(200).json({ keyPresent, keyPreview, results })
}
