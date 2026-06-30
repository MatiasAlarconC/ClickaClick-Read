import { supabase } from '../lib/supabase'

// The Gemini API key now lives server-side in /api/gemini.ts
// It is NOT a VITE_ variable — it never gets bundled into the client JS bundle
// isGeminiConfigured() always returns true; the server returns 503 if unconfigured
export function isGeminiConfigured(): boolean { return true }

interface GeminiConfig {
  enabled: boolean
  model: string
  summary_enabled: boolean
  recommendations_enabled: boolean
  wrapped_enabled: boolean
  monthly_token_budget: number
}

let configCache: GeminiConfig | null = null
let configCacheTime = 0
const CACHE_TTL = 60_000

async function getConfig(): Promise<GeminiConfig> {
  const now = Date.now()
  if (configCache && now - configCacheTime < CACHE_TTL) return configCache

  try {
    const { data } = await supabase.from('admin_config').select('key, value')
    const map: Record<string, string> = {}
    for (const row of data ?? []) map[row.key] = row.value
    configCache = {
      enabled: map['gemini_enabled'] !== 'false',
      model: map['gemini_model'] ?? 'gemini-2.5-flash',
      summary_enabled: map['gemini_summary_enabled'] !== 'false',
      recommendations_enabled: map['gemini_recommendations_enabled'] !== 'false',
      wrapped_enabled: map['gemini_wrapped_enabled'] !== 'false',
      monthly_token_budget: parseInt(map['monthly_token_budget'] ?? '500000'),
    }
  } catch {
    configCache = {
      enabled: true, model: 'gemini-2.5-flash',
      summary_enabled: true, recommendations_enabled: true,
      wrapped_enabled: true, monthly_token_budget: 500000,
    }
  }
  configCacheTime = now
  return configCache
}

// All Gemini calls go through the serverless proxy — the API key never leaves the server
async function callGemini(prompt: string, model: string, jsonMode = false): Promise<{ text: string; tokens: number }> {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model, jsonMode }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error ?? `Gemini proxy error ${res.status}`)
  }
  return res.json()
}

async function logUsage(feature: string, tokens: number, model: string, userId: string | null) {
  try {
    await supabase.from('ai_usage_log').insert({ feature, tokens_used: tokens, model, user_id: userId })
  } catch { /* never throw on logging failure */ }
}

export interface BookRecommendation {
  title: string; author: string; reason: string; searchResult?: unknown
}

export async function getRecommendations(params: {
  finishedBooks: Array<{ title: string; author: string; rating: number | null; genres: string[] }>
  userId: string | null
  count?: number
  exclude?: string[]
}): Promise<BookRecommendation[]> {
  const cfg = await getConfig()
  if (!cfg.enabled || !cfg.recommendations_enabled) return []

  const count = params.count ?? 10
  const booksStr = params.finishedBooks.map(b =>
    `"${b.title}" by ${b.author}${b.rating ? ` (rated ${b.rating}/5)` : ''}${b.genres?.length ? ` [${b.genres.join(', ')}]` : ''}`
  ).join('\n')
  const excludeStr = params.exclude?.length
    ? `\nDo NOT include: ${params.exclude.map(t => `"${t}"`).join(', ')}.` : ''
  // Rotate the variety instruction based on the current week so recommendations change over time
  const variety = ['Prioritize lesser-known hidden gems and debut novels.', 'Mix classic and contemporary titles across different decades.', 'Emphasize books from authors the reader has NOT read yet.', 'Include books from different countries and translated works.']
  const varietyHint = variety[Math.floor(Date.now() / (7 * 86400000)) % variety.length]
  const prompt = `You are a book recommendation engine. Output ONLY a valid JSON array, no markdown, no explanation.\n\nReader's books:\n${booksStr}${excludeStr}\n\n${varietyHint}\n\nRecommend exactly ${count} books the reader has NOT read. Vary genres and authors widely. Keep "reason" under 15 words. Return:\n[{"title":"...","author":"...","reason":"..."}]`

  try {
    const { text, tokens } = await callGemini(prompt, cfg.model, true)
    await logUsage('recommendations', tokens, cfg.model, params.userId)
    const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const json = stripped.match(/\[[\s\S]*\]/)?.[0] ?? (stripped.startsWith('[') ? stripped : null)
    if (!json) throw new Error('Gemini returned a response with no JSON array')
    return JSON.parse(json)
  } catch (err) {
    console.error('[ClickaClick AI] recommendations failed:', err)
    throw err
  }
}

export async function getReadingPersonality(params: {
  booksFinished: number; pagesRead: number; topGenre: string
  longestStreak: number; userId: string | null
}): Promise<string | null> {
  const cfg = await getConfig()
  if (!cfg.enabled || !cfg.wrapped_enabled) return null

  const prompt = `A reader finished ${params.booksFinished} books this year, read ${params.pagesRead} pages, their top genre is ${params.topGenre}, and their longest reading streak was ${params.longestStreak} days. Complete this sentence creatively in exactly one sentence: "You're a [archetype] reader — [one evocative sentence about their reading personality]."`

  try {
    const { text, tokens } = await callGemini(prompt, cfg.model)
    await logUsage('wrapped_personality', tokens, cfg.model, params.userId)
    return text.trim()
  } catch (err) {
    console.error('[ClickaClick AI] wrapped_personality failed:', err)
    return null
  }
}

export async function summarizeNotes(params: {
  notes: Array<{ page_number: number | null; content: string }>
  bookTitle: string
  userId: string | null
  previousBookSummary?: string | null
}): Promise<string> {
  const cfg = await getConfig()
  if (!cfg.enabled || !cfg.summary_enabled) throw new Error('AI summaries are disabled')

  const notesText = params.notes.map(n => `[p.${n.page_number ?? '?'}] ${n.content}`).join('\n')
  const prevCtx = params.previousBookSummary
    ? `\n\nFor context, here is what the reader noted about the previous book in this series:\n${params.previousBookSummary}\n`
    : ''
  const prompt = `I'm reading "${params.bookTitle}".${prevCtx}\n\nMy notes:\n${notesText}\n\nWrite a concise 3-5 sentence summary of my reading progress and key insights. Focus on themes, questions, and ideas I seem to be tracking. Write in second person ("You've been following...").`

  const { text, tokens } = await callGemini(prompt, cfg.model)
  await logUsage('notes_summary', tokens, cfg.model, params.userId)
  return text.trim()
}

export interface SeriesInfo {
  seriesName: string; position: number; totalBooks: number
  nextTitle: string; nextAuthor: string; prevTitle?: string
  parentSagaName?: string; parentSagaTotalBooks?: number
}

export async function detectBookSeries(params: {
  title: string; author: string; userId: string | null; bookId?: string | null
}): Promise<SeriesInfo | null> {
  const cfg = await getConfig()
  if (!cfg.enabled) return null

  const lsKey = `cc_series_${params.title.toLowerCase().replace(/\W+/g, '_')}_${params.author.toLowerCase().replace(/\W+/g, '_')}`

  // 1. Shared DB cache — computed once, reused by every user
  if (params.bookId) {
    try {
      const { data } = await supabase.from('books').select('series_data').eq('id', params.bookId).maybeSingle()
      if (data && data.series_data !== null && data.series_data !== undefined) {
        const sd = data.series_data as Record<string, unknown>
        const result = sd.seriesName ? (sd as unknown as SeriesInfo) : null
        try { localStorage.setItem(lsKey, result ? JSON.stringify(result) : 'null') } catch { /* ignore */ }
        return result
      }
    } catch { /* ignore */ }
  }

  // 2. localStorage fallback (browsing a book not yet in DB)
  try {
    const cached = localStorage.getItem(lsKey)
    if (cached !== null) return cached === 'null' ? null : (JSON.parse(cached) as SeriesInfo)
  } catch { /* ignore */ }

  // 3. Call Gemini (first time this book has been visited by any user)
  const prompt = `Is "${params.title}" by ${params.author} part of a numbered book series with sequels?
Reply ONLY with valid JSON, no markdown, no explanation.
If yes: {"inSeries":true,"seriesName":"...","position":1,"totalBooks":3,"nextTitle":"...","nextAuthor":"...","parentSagaName":"...","parentSagaTotalBooks":0}
If no or unsure: {"inSeries":false}

parentSagaName: fill only when this sub-series belongs to a larger connected universe/saga (e.g. "Farseer Trilogy" belongs to "Realm of the Elderlings"). Use "" if no parent saga exists.
parentSagaTotalBooks: total books across all sub-series in the parent saga (0 if no parent saga).`

  try {
    const { text, tokens } = await callGemini(prompt, cfg.model, true)
    await logUsage('series_detection', tokens, cfg.model, params.userId)
    const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const json = JSON.parse(stripped)

    let result: SeriesInfo | null = null
    if (json.inSeries) {
      result = {
        seriesName: json.seriesName,
        position: json.position,
        totalBooks: json.totalBooks,
        nextTitle: json.nextTitle,
        nextAuthor: json.nextAuthor,
        ...(json.parentSagaName ? { parentSagaName: json.parentSagaName, parentSagaTotalBooks: json.parentSagaTotalBooks ?? 0 } : {}),
      }
    }

    // Persist to shared DB so no other user ever hits Gemini for this book again
    if (params.bookId) {
      try { await supabase.from('books').update({ series_data: result ?? {} }).eq('id', params.bookId) } catch { /* ignore */ }
    }
    try { localStorage.setItem(lsKey, result ? JSON.stringify(result) : 'null') } catch { /* ignore */ }
    return result
  } catch {
    return null
  }
}

export { getConfig as getGeminiConfig }
