import type { SearchResult } from '../types'

// Google Books calls go through /api/books — key never exposed to client

// ─── Hardcoded Seckry Sevenstars trilogy by Joseph Evans ─────────────────────
const SECKRY_BOOKS: SearchResult[] = [
  {
    id: 'seckry-1',
    google_books_id: 'seckry-1',
    title: 'Seckry Sevenstars and the City of the Falling Sky',
    author: 'Joseph Evans',
    cover_url: 'https://m.media-amazon.com/images/I/81dcCtIdwhL._SX522_.jpg',
    synopsis: "When Seckry was six years old, his father disappeared. Now fifteen, living in Skyfall City, he competes at Friction — the city's most popular e-sport. But when he finds himself in the restricted grounds of Endrin Corporation, he discovers a girl with no memory. What he uncovers is more disturbing than he could have imagined, stemming back to that fateful day nine years ago.",
    pages: 300,
    genres: ['Young Adult', 'Science Fiction', 'Adventure'],
    published_year: 2011,
    isbn: null,
    source: 'manual',
  },
  {
    id: 'seckry-2',
    google_books_id: 'seckry-2',
    title: 'Seckry Sevenstars and the Trinity Awakening',
    author: 'Joseph Evans',
    cover_url: 'https://m.media-amazon.com/images/I/81qkelq1kYL._SX522_.jpg',
    synopsis: "It's Seckry's second year at Estergate Institute. The Friction Mega Meltdown is fast approaching. But the enigmatic scientist Kevan Kayne, thought to be dead, has appeared with a shocking claim about Eiya — forcing Seckry to rethink everything he thought he knew about her existence, and unearths a secret buried deep within the school grounds.",
    pages: 380,
    genres: ['Young Adult', 'Science Fiction', 'Adventure'],
    published_year: 2013,
    isbn: null,
    source: 'manual',
  },
  {
    id: 'seckry-3',
    google_books_id: 'seckry-3',
    title: 'Seckry Sevenstars and the Fate of the Fractured Part One',
    author: 'Joseph Evans',
    cover_url: 'https://m.media-amazon.com/images/I/81FjnhJtBUL._SY522_.jpg',
    synopsis: "Pawl is gone. Lux has risen. Reeling from the events of the suppressed memory, Seckry is desperate to rescue his abducted father. But there is another suppressed memory: the night his father disappeared. A discovery that challenges everything he thought he knew about choice and free-will — because if the future has already been written, does he even have the power to change the course of fate?",
    pages: 357,
    genres: ['Young Adult', 'Science Fiction', 'Adventure'],
    published_year: 2025,
    isbn: null,
    source: 'manual',
  },
]

const SECKRY_KEYWORDS = ['seckry', 'sevenstars', 'joseph evans', 'trinity awakening', 'fractured', 'falling sky', 'estergate']

// ─── In-memory cache to avoid redundant fetches ───────────────────────────────
const cache = new Map<string, { results: SearchResult[]; totalItems?: number; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 min

export async function searchBooks(
  query: string,
  options: { startIndex?: number; genre?: string; author?: string; language?: string } = {}
): Promise<{ results: SearchResult[]; totalItems: number }> {
  const q = query.trim()
  if (!q && !options.genre && !options.author) return { results: [], totalItems: 0 }

  const startIndex = options.startIndex ?? 0
  const cacheKey = `${q}|${options.genre ?? ''}|${options.author ?? ''}|${options.language ?? ''}|${startIndex}`

  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return { results: cached.results, totalItems: cached.totalItems ?? cached.results.length }

  // Hardcoded Seckry books (only on first page)
  const lq = q.toLowerCase()
  const hardcoded = startIndex === 0 && SECKRY_KEYWORDS.some(kw => lq.includes(kw))
    ? SECKRY_BOOKS.filter(b =>
        b.title.toLowerCase().includes(lq) ||
        b.author.toLowerCase().includes(lq) ||
        SECKRY_KEYWORDS.some(kw => lq.includes(kw))
      )
    : []

  // Build Google Books query with proper qualifiers
  let googleQuery = q
  if (options.genre && options.genre !== 'All') googleQuery += ` subject:${options.genre}`
  if (options.author) googleQuery += ` inauthor:${options.author}`

  const [googleRes, openLibGen] = await Promise.allSettled([
    searchGoogleBooks(googleQuery, startIndex, options.language),
    searchOpenLibrary(q, 'q', options.genre, options.author, startIndex, options.language),
  ])

  const seen = new Set<string>()
  const results: SearchResult[] = []
  let totalItems = 0

  for (const r of hardcoded) { seen.add(r.id); results.push(r) }

  const addUnique = (arr: SearchResult[]) => {
    for (const r of arr) {
      const key = (r.isbn || r.title).toLowerCase().trim()
      if (!seen.has(key)) { seen.add(key); results.push(r) }
    }
  }

  if (googleRes.status === 'fulfilled')  { addUnique(googleRes.value.results); totalItems = Math.max(totalItems, googleRes.value.totalItems) }
  if (openLibGen.status === 'fulfilled') { addUnique(openLibGen.value.results); totalItems = Math.max(totalItems, openLibGen.value.totalItems) }

  // Re-rank by title/author relevance so exact matches appear first
  const scored = results.map(r => ({ r, score: relevanceScore(r, q) }))
  scored.sort((a, b) => b.score - a.score)
  const ranked = scored.map(x => x.r)

  cache.set(cacheKey, { results: ranked, totalItems, ts: Date.now() })
  return { results: ranked, totalItems }
}

function relevanceScore(result: SearchResult, query: string): number {
  const q = query.toLowerCase().trim()
  if (!q) return 0
  const title = (result.title ?? '').toLowerCase()
  const author = (result.author ?? '').toLowerCase()
  // Exact title match
  if (title === q) return 100
  // Title starts with query
  if (title.startsWith(q)) return 88
  // Title contains query as substring
  if (title.includes(q)) return 74
  // All query words present in title
  const words = q.split(/\s+/).filter(w => w.length > 2)
  const titleWordMatches = words.filter(w => title.includes(w)).length
  if (words.length > 0 && titleWordMatches === words.length) return 60
  // Most query words in title
  const titleRatio = words.length > 0 ? titleWordMatches / words.length : 0
  if (titleRatio >= 0.6) return Math.round(40 * titleRatio)
  // Author match as fallback
  if (author.includes(q)) return 20
  return 0
}

// Maps ISO 639-1 code → MARC language code for Open Library
const LANG_TO_MARC: Record<string, string> = {
  en: 'eng', es: 'spa', fr: 'fre', de: 'ger', it: 'ita',
  pt: 'por', ja: 'jpn', zh: 'chi', ru: 'rus', ar: 'ara',
}

async function searchGoogleBooks(query: string, startIndex = 0, language?: string): Promise<{ results: SearchResult[]; totalItems: number }> {
  const params = new URLSearchParams({ q: query, startIndex: String(startIndex) })
  if (language) params.set('language', language)

  const res = await fetch(`/api/books?${params}`)
  if (!res.ok) throw new Error(`Google Books ${res.status}`)
  const data = await res.json()
  const totalItems: number = data.totalItems ?? 0

  return {
    totalItems,
    results: (data.items ?? []).map((item: GoogleBookItem): SearchResult => {
      const info = item.volumeInfo
      return {
        id: item.id,
        title: info.title ?? 'Unknown Title',
        author: (info.authors ?? ['Unknown Author']).join(', '),
        cover_url: (info.imageLinks?.extraLarge ?? info.imageLinks?.large ?? info.imageLinks?.thumbnail)?.replace('http:', 'https:') ?? null,
        synopsis: info.description ?? null,
        pages: info.pageCount ?? null,
        genres: info.categories ?? [],
        published_year: info.publishedDate ? parseInt(info.publishedDate) : null,
        isbn: info.industryIdentifiers?.find((i: { type: string }) => i.type === 'ISBN_13')?.identifier ?? null,
        source: 'google',
        google_books_id: item.id,
      }
    }),
  }
}

// field: 'q' (general) or 'title' (title-specific for obscure books)
async function searchOpenLibrary(query: string, field: 'q' | 'title' = 'q', genre?: string, author?: string, startIndex = 0, language?: string): Promise<{ results: SearchResult[]; totalItems: number }> {
  let urlStr = `https://openlibrary.org/search.json?${field}=${encodeURIComponent(query)}&limit=25&offset=${startIndex}&fields=key,title,author_name,cover_i,number_of_pages_median,subject,first_publish_year,isbn`
  if (author) urlStr += `&author=${encodeURIComponent(author)}`
  if (genre && genre !== 'All') urlStr += `&subject=${encodeURIComponent(genre)}`
  if (language && LANG_TO_MARC[language]) urlStr += `&language=${LANG_TO_MARC[language]}`
  const res = await fetch(urlStr)
  if (!res.ok) throw new Error(`Open Library ${res.status}`)
  const data = await res.json()

  return {
    totalItems: data.numFound ?? 0,
    results: (data.docs ?? []).slice(0, 25).map((doc: OpenLibraryDoc): SearchResult => ({
      id: doc.key,
      title: doc.title ?? 'Unknown Title',
      author: (doc.author_name ?? ['Unknown Author']).slice(0, 2).join(', '),
      cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      synopsis: null,
      pages: doc.number_of_pages_median ?? null,
      genres: doc.subject?.slice(0, 5) ?? [],
      published_year: doc.first_publish_year ?? null,
      isbn: doc.isbn?.[0] ?? null,
      source: 'openlibrary',
      open_library_id: doc.key,
    })),
  }
}

interface GoogleBookItem {
  id: string
  volumeInfo: {
    title?: string
    authors?: string[]
    description?: string
    imageLinks?: { thumbnail?: string; large?: string; extraLarge?: string }
    pageCount?: number
    categories?: string[]
    publishedDate?: string
    industryIdentifiers?: Array<{ type: string; identifier: string }>
  }
}

interface OpenLibraryDoc {
  key: string
  title?: string
  author_name?: string[]
  cover_i?: number
  number_of_pages_median?: number
  subject?: string[]
  first_publish_year?: number
  isbn?: string[]
}

export async function searchByISBN(isbn: string): Promise<SearchResult | null> {
  try {
    const { results } = await searchGoogleBooks(`isbn:${isbn}`, 0)
    return results[0] ?? null
  } catch {
    return null
  }
}

