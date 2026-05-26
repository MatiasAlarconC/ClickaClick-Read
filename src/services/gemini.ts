import { supabase } from '../lib/supabase'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined

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
      model: map['gemini_model'] ?? 'gemini-1.5-flash',
      summary_enabled: map['gemini_summary_enabled'] !== 'false',
      recommendations_enabled: map['gemini_recommendations_enabled'] !== 'false',
      wrapped_enabled: map['gemini_wrapped_enabled'] !== 'false',
      monthly_token_budget: parseInt(map['monthly_token_budget'] ?? '500000'),
    }
  } catch {
    configCache = {
      enabled: true, model: 'gemini-1.5-flash',
      summary_enabled: true, recommendations_enabled: true,
      wrapped_enabled: true, monthly_token_budget: 500000,
    }
  }
  configCacheTime = now
  return configCache
}

async function callGemini(prompt: string, model: string): Promise<{ text: string; tokens: number }> {
  if (!GEMINI_API_KEY) throw new Error('No Gemini API key')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}`)
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const tokens = data.usageMetadata?.totalTokenCount ?? 0
  return { text, tokens }
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
    const rangeKey = Math.floor(params.currentPage / 50) * 50
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

  const prompt = `The user is on page ${params.currentPage} of ${params.totalPages} of "${params.title}" by ${params.author}. Based only on what would reasonably have happened up to this point in the book (do not spoil future events), write a 3-sentence recap of what the reader has likely experienced so far. Be engaging, not dry.`

  try {
    const { text, tokens } = await callGemini(prompt, cfg.model)
    await logUsage('progressive_summary', tokens, cfg.model, params.userId)

    // Cache result
    if (params.userId) {
      const rangeKey = Math.floor(params.currentPage / 50) * 50
      await supabase.from('ai_summary_cache').upsert({
        user_id: params.userId, book_title: params.title,
        page_range: rangeKey, summary: text
      })
    }
    return text
  } catch {
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
  } catch {
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
  } catch {
    return null
  }
}

export { getConfig as getGeminiConfig }
