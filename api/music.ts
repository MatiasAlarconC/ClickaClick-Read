import type { VercelRequest, VercelResponse } from '@vercel/node'

// Set JAMENDO_CLIENT_ID in Vercel env vars to use your own key
const JAMENDO_ID = process.env.JAMENDO_CLIENT_ID ?? 'b6747d04'

// More specific tag sets per reading genre so Jamendo returns calmer, more appropriate tracks
const GENRE_TAGS: Record<string, string> = {
  piano:          'piano,instrumental,soloinstrumental',
  classicalpiano: 'classical,baroque,instrumental',
  ambient:        'ambient,meditation,drone',
  lofi:           'lofi,chillout,studymusic,downtempo',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const tag = typeof req.query.tag === 'string' ? req.query.tag.replace(/[^a-zA-Z0-9_-]/g, '') : 'piano'
  const tags = GENRE_TAGS[tag] ?? `${tag},instrumental`
  try {
    const upstream = await fetch(
      `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_ID}&tags=${tags}&order=popularity_total_desc&limit=50&fuzzytags=1&audiodownload_allowed=1&acousticelectric=acoustic&speed=vlow,low`
    )
    const data = await upstream.json()
    const results = data?.results ?? []
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
    res.status(200).json({ results, results_count: results.length, warnings: data?.headers?.warnings ?? '' })
  } catch {
    res.status(502).json({ results: [], results_count: 0 })
  }
}
