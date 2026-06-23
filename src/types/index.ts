export interface AvatarConfig {
  character: string
  primaryColor: string
  secondaryColor: string
  useTexture?: boolean
}

export interface Profile {
  id: string
  username: string | null
  avatar_url: string | null
  avatar_config: AvatarConfig | null
  created_at: string
  reading_goal_books_per_year: number | null
  reading_goal_minutes_per_day: number | null
  dark_mode: boolean | null
}

export interface Book {
  id: string
  google_books_id: string | null
  open_library_id: string | null
  title: string
  author: string
  cover_url: string | null
  synopsis: string | null
  pages_default: number | null
  genres: string[] | null
  published_year: number | null
  available_languages: string[] | null
  isbn: string | null
}

export type ReadingStatus = 'reading' | 'finished' | 'want_to_read' | 'dropped'

export interface UserBook {
  id: string
  user_id: string
  book_id: string
  status: ReadingStatus
  custom_pages: number | null
  current_page: number | null
  custom_language: string | null
  user_rating: number | null
  started_at: string | null
  finished_at: string | null
  added_at: string
  epub_storage_path: string | null
  epub_page_ratio: number | null
  progress_pct: number | null
  spine_url?: string | null
  shelf_pos?: { shelf: number; left: number; rot: number; scale: number } | null
  book?: Book
}

export interface ReadingSession {
  id: string
  user_id: string
  book_id: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  start_page: number | null
  end_page: number | null
  pages_read: number | null
  is_manual?: boolean
  session_type?: string
  epub_cfi_start?: string | null
  epub_cfi_end?: string | null
  last_sentence?: string | null
  chapter_name?: string | null
  book?: Book
}

export interface BookNote {
  id: string
  user_id: string
  book_id: string
  page_number: number | null
  content: string
  created_at: string
}

export interface AdminConfig {
  id: string
  key: string
  value: string
  updated_at: string
}

export interface AiUsageLog {
  id: string
  feature: string
  tokens_used: number
  model: string
  created_at: string
  user_id: string | null
}

export interface SearchResult {
  id: string
  title: string
  author: string
  cover_url: string | null
  synopsis: string | null
  pages: number | null
  genres: string[]
  published_year: number | null
  isbn: string | null
  source: 'google' | 'openlibrary' | 'manual'
  google_books_id?: string
  open_library_id?: string
}

export interface Theme {
  bg: string
  bgSecondary: string
  bgElevated: string
  fg: string
  fgDim: string
  muted: string
  border: string
  accent: string
  accentFg: string
  blobFill: string
  cardBg: string
  dark: boolean
}
