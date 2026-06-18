import type { VercelRequest, VercelResponse } from '@vercel/node'

const API_KEY = process.env.GOOGLE_BOOKS_API_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

    const { q, startIndex = '0', language } = req.query as Record<string, string>
    if (!q) return res.status(400).json({ error: 'Missing q' })

    const url = new URL('https://www.googleapis.com/books/v1/volumes')
    url.searchParams.set('q', q)
    url.searchParams.set('maxResults', '25')
    url.searchParams.set('startIndex', startIndex)
    url.searchParams.set('printType', 'books')
    if (language) url.searchParams.set('langRestrict', language)
    if (API_KEY) url.searchParams.set('key', API_KEY)

    const upstream = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
    const data = await upstream.json()

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data?.error?.message ?? `Google Books ${upstream.status}` })
    }

    res.setHeader('Cache-Control', 'public, s-maxage=300')
    return res.status(200).json(data)
  } catch (e) {
    return res.status(502).json({ error: String(e) })
  }
}
