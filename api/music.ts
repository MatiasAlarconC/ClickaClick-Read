import type { VercelRequest, VercelResponse } from '@vercel/node'

const JAMENDO_ID = 'b6747d04'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const tag = typeof req.query.tag === 'string' ? req.query.tag.replace(/[^a-zA-Z0-9_-]/g, '') : 'ambient'
  try {
    const upstream = await fetch(
      `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_ID}&tags=${tag}&audioformat=mp32&order=popularity_total_desc&limit=30`
    )
    const data = await upstream.json()
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
    res.status(200).json(data)
  } catch {
    res.status(502).json({ results: [] })
  }
}
