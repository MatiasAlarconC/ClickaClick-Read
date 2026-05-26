import type { SearchResult } from '../types'

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY as string | undefined

export async function searchBooks(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return []

  // Try Google Books first
  try {
    const googleResults = await searchGoogleBooks(query)
    if (googleResults.length > 0) return googleResults
  } catch {
    // fall through to Open Library
  }

  // Fallback to Open Library
  try {
    return await searchOpenLibrary(query)
  } catch {
    return []
  }
}

async function searchGoogleBooks(query: string): Promise<SearchResult[]> {
  const url = new URL('https://www.googleapis.com/books/v1/volumes')
  url.searchParams.set('q', query)
  url.searchParams.set('maxResults', '20')
  if (GOOGLE_API_KEY) url.searchParams.set('key', GOOGLE_API_KEY)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Google Books ${res.status}`)
  const data = await res.json()

  return (data.items ?? []).map((item: GoogleBookItem): SearchResult => {
    const info = item.volumeInfo
    return {
      id: item.id,
      title: info.title ?? 'Unknown Title',
      author: (info.authors ?? ['Unknown Author']).join(', '),
      cover_url: info.imageLinks?.thumbnail?.replace('http:', 'https:') ?? null,
      synopsis: info.description ?? null,
      pages: info.pageCount ?? null,
      genres: info.categories ?? [],
      published_year: info.publishedDate ? parseInt(info.publishedDate) : null,
      isbn: info.industryIdentifiers?.find((i: { type: string }) => i.type === 'ISBN_13')?.identifier ?? null,
      source: 'google',
      google_books_id: item.id,
    }
  })
}

async function searchOpenLibrary(query: string): Promise<SearchResult[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=20`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Open Library ${res.status}`)
  const data = await res.json()

  return (data.docs ?? []).slice(0, 20).map((doc: OpenLibraryDoc): SearchResult => ({
    id: doc.key,
    title: doc.title ?? 'Unknown Title',
    author: (doc.author_name ?? ['Unknown Author']).slice(0, 2).join(', '),
    cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    synopsis: null,
    pages: doc.number_of_pages_median ?? null,
    genres: doc.subject?.slice(0, 5) ?? [],
    published_year: doc.first_publish_year ?? null,
    isbn: doc.isbn?.[0] ?? null,
    source: 'openlibrary',
    open_library_id: doc.key,
  }))
}

interface GoogleBookItem {
  id: string
  volumeInfo: {
    title?: string
    authors?: string[]
    description?: string
    imageLinks?: { thumbnail?: string }
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
