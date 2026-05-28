import { supabase } from '../lib/supabase'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined

export function isGeminiConfigured(): boolean {
  return !!(GEMINI_API_KEY && GEMINI_API_KEY.trim().length > 0)
}

// Log key presence at module init (never logs the actual key value)
if (import.meta.env.DEV || import.meta.env.PROD) {
  console.info('[ClickaClick AI] GEMINI key configured:', isGeminiConfigured())
}

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
const CACHE_TTL = 60_000 // 1 minute

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

async function callGemini(prompt: string, model: string): Promise<{ text: string; tokens: number }> {
  if (!GEMINI_API_KEY) {
    console.error('[ClickaClick AI] VITE_GEMINI_API_KEY is not set — check Vercel environment variables')
    throw new Error('No Gemini API key')
  }

  // Fallback chain: try configured model → flash-lite → 2.0-flash → 2.5-flash
  const candidates = [model, 'gemini-2.5-flash', 'gemini-2.5-flash-preview-05-20', 'gemini-2.0-flash'].filter((m, i, a) => a.indexOf(m) === i)

  let lastError: Error = new Error('Gemini unreachable')
  for (const m of candidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GEMINI_API_KEY}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
      }),
    })
    if (res.ok) {
      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!text) {
        const reason = data.candidates?.[0]?.finishReason ?? 'UNKNOWN'
        console.warn(`[ClickaClick AI] Gemini returned empty response (${m}), finishReason: ${reason}`)
        throw new Error(`Gemini empty response: ${reason}`)
      }
      const tokens = data.usageMetadata?.totalTokenCount ?? 0
      return { text, tokens }
    }
    if (res.status === 403) {
      const body = await res.text().catch(() => '')
      console.error(`[ClickaClick AI] 403 FORBIDDEN — API key is invalid, expired, or IP-restricted. Check Vercel env vars. Body:`, body)
      throw new Error('Gemini 403: invalid key')
    }
    if (res.status === 429) {
      const body = await res.text().catch(() => '')
      console.warn(`[ClickaClick AI] Gemini 429 (${m}):`, body)
      lastError = new Error('Gemini 429')
      continue // try next model in chain
    }
    if (res.status >= 500) {
      const body = await res.text().catch(() => '')
      console.error(`[ClickaClick AI] Gemini ${res.status} (${m}):`, body)
      throw new Error(`Gemini ${res.status}`)
    }
    // 404 / 400 likely means deprecated model — try next candidate
    const body = await res.text().catch(() => '')
    console.warn(`[ClickaClick AI] Gemini ${res.status} (${m}), trying next:`, body)
    lastError = new Error(`Gemini ${res.status}`)
  }
  throw lastError
}

async function logUsage(feature: string, tokens: number, model: string, userId: string | null) {
  try {
    await supabase.from('ai_usage_log').insert({ feature, tokens_used: tokens, model, user_id: userId })
  } catch {
    // never throw on logging failure
  }
}

export async function getProgressiveSummary(params: {
  title: string; author: string; synopsis: string | null
  currentPage: number; totalPages: number; userId: string | null
}): Promise<string | null> {
  const cfg = await getConfig()
  if (!cfg.enabled || !cfg.summary_enabled) return null

  // Check 24h cache
  if (params.userId) {
    const rangeKey = params.currentPage // cache per exact page
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: cached } = await supabase
      .from('ai_summary_cache')
      .select('summary')
      .eq('user_id', params.userId)
      .eq('book_title', params.title)
      .eq('page_range', rangeKey)
      .gte('created_at', since)
      .single()
    if (cached?.summary) return cached.summary
  }

  const fromPage = Math.max(1, params.currentPage - 20)
  const prompt = `The reader is on page ${params.currentPage} of "${params.title}" by ${params.author}${params.synopsis ? ` (synopsis: ${params.synopsis.slice(0, 200)})` : ''}. Write a vivid 3-sentence recap of what likely happened in pages ${fromPage}–${params.currentPage} to help the reader remember where they left off. Focus on recent events — character actions, emotional beats, plot twists. Be engaging, not dry. Do not spoil anything beyond page ${params.currentPage}.`

  try {
    const { text, tokens } = await callGemini(prompt, cfg.model)
    await logUsage('progressive_summary', tokens, cfg.model, params.userId)

    // Cache result
    if (params.userId) {
      const rangeKey = params.currentPage
      await supabase.from('ai_summary_cache').upsert({
        user_id: params.userId, book_title: params.title,
        page_range: rangeKey, summary: text
      })
    }
    return text
  } catch (err) {
    console.error('[ClickaClick AI] progressive_summary failed:', err)
    return null
  }
}

export interface BookRecommendation {
  title: string; author: string; reason: string; searchResult?: unknown
}

export async function getRecommendations(params: {
  finishedBooks: Array<{ title: string; author: string; rating: number | null; genres: string[] }>
  userId: string | null
}): Promise<BookRecommendation[]> {
  const cfg = await getConfig()
  if (!cfg.enabled || !cfg.recommendations_enabled) return []

  const booksStr = params.finishedBooks.map(b => `"${b.title}" by ${b.author} (rating: ${b.rating ?? 'unrated'})`).join(', ')
  const prompt = `Based on this reader's history: ${booksStr}, recommend 3 books they haven't read. For each, provide: title, author, and a one-sentence reason why it matches their taste. Respond in JSON only, as an array: [{"title":"...","author":"...","reason":"..."}]`

  try {
    const { text, tokens } = await callGemini(prompt, cfg.model)
    await logUsage('recommendations', tokens, cfg.model, params.userId)
    const json = text.match(/\[[\s\S]*\]/)?.[0]
    return json ? JSON.parse(json) : []
  } catch (err) {
    console.error('[ClickaClick AI] recommendations failed:', err)
    return []
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

export { getConfig as getGeminiConfig }
