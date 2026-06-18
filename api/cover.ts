import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

    const { url } = req.query as Record<string, string>
    if (!url) return res.status(400).json({ error: 'Missing url' })

    // Only proxy known book cover CDNs
    const allowed = [
      'books.google.com',
      'covers.openlibrary.org',
      'm.media-amazon.com',
      'images-na.ssl-images-amazon.com',
    ]
    let parsed: URL
    try { parsed = new URL(url) } catch { return res.status(400).json({ error: 'Invalid url' }) }
    if (!allowed.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
      return res.status(403).json({ error: 'Host not allowed' })
    }

    const upstream = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!upstream.ok) return res.status(upstream.status).end()

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'
    const buffer = await upstream.arrayBuffer()

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800')
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(200).send(Buffer.from(buffer))
  } catch (e) {
    return res.status(502).json({ error: String(e) })
  }
}
