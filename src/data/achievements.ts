import type { CharacterId } from '../components/AvatarCharacter'

// ─── Stats required to evaluate achievements ──────────────────────────────────
export interface AchievementStats {
  booksFinished: number
  totalBooks: number
  totalPages: number
  totalHours: number
  streak: number
  genreCounts: Record<string, number>
  sessionCount: number       // timed (non-manual) sessions
  notesCount: number
}

// ─── Achievement definition ───────────────────────────────────────────────────
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'obsidian'
export type AchievementReward =
  | { type: 'badge' }
  | { type: 'title'; value: string }
  | { type: 'character'; characterId: CharacterId }

export interface Achievement {
  id: string
  name: string
  description: string
  tier: AchievementTier
  reward: AchievementReward
  /** Returns true when the achievement is unlocked for the given stats */
  check: (s: AchievementStats) => boolean
}

// ─── Genre count helper (case-insensitive) ────────────────────────────────────
function genre(s: AchievementStats, ...keys: string[]): number {
  return keys.reduce((sum, k) => {
    const lower = k.toLowerCase()
    return sum + Object.entries(s.genreCounts).reduce((acc, [gk, v]) =>
      gk.toLowerCase() === lower ? acc + v : acc, 0)
  }, 0)
}

// ─── Achievement catalog ──────────────────────────────────────────────────────
export const ACHIEVEMENTS: Achievement[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // BRONZE — First Steps
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'first_book',
    name: 'First Page',
    description: 'Add your first book to the library.',
    tier: 'bronze',
    reward: { type: 'badge' },
    check: s => s.totalBooks >= 1,
  },
  {
    id: 'first_session',
    name: 'Into the Zone',
    description: 'Complete your first focus reading session.',
    tier: 'bronze',
    reward: { type: 'badge' },
    check: s => s.sessionCount >= 1,
  },
  {
    id: 'three_books',
    name: 'Bookworm',
    description: 'Finish 3 books.',
    tier: 'bronze',
    reward: { type: 'badge' },
    check: s => s.booksFinished >= 3,
  },
  {
    id: 'ten_sessions',
    name: 'Dedicated Reader',
    description: 'Complete 10 reading sessions.',
    tier: 'bronze',
    reward: { type: 'badge' },
    check: s => s.sessionCount >= 10,
  },
  {
    id: 'first_note',
    name: 'The Annotator',
    description: 'Write your very first book note.',
    tier: 'bronze',
    reward: { type: 'badge' },
    check: s => s.notesCount >= 1,
  },
  {
    id: 'library_five',
    name: 'Shelf Builder',
    description: 'Add 5 books to your library.',
    tier: 'bronze',
    reward: { type: 'badge' },
    check: s => s.totalBooks >= 5,
  },
  {
    id: 'two_hours',
    name: 'Time Well Spent',
    description: 'Read for a total of 2 hours across sessions.',
    tier: 'bronze',
    reward: { type: 'badge' },
    check: s => s.totalHours >= 2,
  },
  {
    id: 'genre_curious',
    name: 'Genre Curious',
    description: 'Read books from 3 different genres.',
    tier: 'bronze',
    reward: { type: 'badge' },
    check: s => Object.values(s.genreCounts).filter(v => v > 0).length >= 3,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SILVER — Growing Reader
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'streak_3',
    name: 'Three in a Row',
    description: 'Read for 3 consecutive days.',
    tier: 'silver',
    reward: { type: 'badge' },
    check: s => s.streak >= 3,
  },
  {
    id: 'ten_books',
    name: 'The Librarian',
    description: 'Finish 10 books. Your shelves grow full.',
    tier: 'silver',
    reward: { type: 'title', value: 'The Librarian' },
    check: s => s.booksFinished >= 10,
  },
  {
    id: 'streak_7',
    name: 'Iron Will',
    description: 'Maintain a 7-day reading streak.',
    tier: 'silver',
    reward: { type: 'character', characterId: 'knight' },
    check: s => s.streak >= 7,
  },
  {
    id: 'notes_10',
    name: 'Margin Writer',
    description: 'Write 10 notes across your books.',
    tier: 'silver',
    reward: { type: 'badge' },
    check: s => s.notesCount >= 10,
  },
  {
    id: 'notes_25',
    name: 'Note Taker',
    description: 'Write 25 notes across your books.',
    tier: 'silver',
    reward: { type: 'title', value: 'Note Taker' },
    check: s => s.notesCount >= 25,
  },
  {
    id: 'fifteen_sessions',
    name: 'Night Reader',
    description: 'Complete 15 reading sessions. The owl approves.',
    tier: 'silver',
    reward: { type: 'character', characterId: 'owl' },
    check: s => s.sessionCount >= 15,
  },
  {
    id: 'twenty_sessions',
    name: 'In the Flow',
    description: 'Complete 20 reading sessions.',
    tier: 'silver',
    reward: { type: 'badge' },
    check: s => s.sessionCount >= 20,
  },
  {
    id: 'five_hundred_pages',
    name: 'Page Turner',
    description: 'Read 500 pages in total.',
    tier: 'silver',
    reward: { type: 'badge' },
    check: s => s.totalPages >= 500,
  },
  {
    id: 'one_thousand_pages',
    name: 'One Thousand Pages',
    description: 'Read 1,000 pages across all your books.',
    tier: 'silver',
    reward: { type: 'badge' },
    check: s => s.totalPages >= 1000,
  },
  {
    id: 'romance_reader',
    name: 'Hopeful Heart',
    description: 'Read 5 Romance books.',
    tier: 'silver',
    reward: { type: 'badge' },
    check: s => genre(s, 'romance') >= 5,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GOLD — Advanced Reader
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'twenty_books',
    name: 'Avid Reader',
    description: 'Finish 20 books.',
    tier: 'gold',
    reward: { type: 'badge' },
    check: s => s.booksFinished >= 20,
  },
  {
    id: 'thirty_books',
    name: 'The Scholar',
    description: 'Finish 30 books. Knowledge is your power.',
    tier: 'gold',
    reward: { type: 'title', value: 'The Scholar' },
    check: s => s.booksFinished >= 30,
  },
  {
    id: 'streak_30',
    name: 'The Monk',
    description: 'Read every day for 30 consecutive days.',
    tier: 'gold',
    reward: { type: 'title', value: 'The Monk' },
    check: s => s.streak >= 30,
  },
  {
    id: 'fifty_sessions',
    name: 'Session Master',
    description: 'Complete 50 reading sessions.',
    tier: 'gold',
    reward: { type: 'badge' },
    check: s => s.sessionCount >= 50,
  },
  {
    id: 'notes_50',
    name: 'The Archivist',
    description: 'Write 50 notes. Every insight preserved.',
    tier: 'gold',
    reward: { type: 'title', value: 'The Archivist' },
    check: s => s.notesCount >= 50,
  },
  {
    id: 'fantasy_master',
    name: 'Fantasy Master',
    description: 'Read 20+ books in the Fantasy genre.',
    tier: 'gold',
    reward: { type: 'title', value: 'Fantasy Master' },
    check: s => genre(s, 'fantasy') >= 20,
  },
  {
    id: 'detective',
    name: 'The Detective',
    description: 'Read 10+ Mystery or Thriller books.',
    tier: 'gold',
    reward: { type: 'character', characterId: 'fox' },
    check: s => genre(s, 'mystery', 'thriller', 'crime') >= 10,
  },
  {
    id: 'magic_realm',
    name: 'Magic Realm',
    description: 'Read 15+ Fantasy or Sci-Fi books.',
    tier: 'gold',
    reward: { type: 'character', characterId: 'mage' },
    check: s => genre(s, 'fantasy', 'science fiction', 'sci-fi', 'scifi') >= 15,
  },
  {
    id: 'cosmic_explorer',
    name: 'Cosmic Explorer',
    description: 'Read 5+ Science Fiction books.',
    tier: 'gold',
    reward: { type: 'character', characterId: 'cosmic' },
    check: s => genre(s, 'science fiction', 'sci-fi', 'scifi') >= 5,
  },
  {
    id: 'horror_fan',
    name: 'The Haunted',
    description: 'Read 10+ Horror books. You enjoy the dark.',
    tier: 'gold',
    reward: { type: 'title', value: 'The Haunted' },
    check: s => genre(s, 'horror') >= 10,
  },
  {
    id: 'history_lover',
    name: 'Time Traveler',
    description: 'Read 10+ Historical Fiction or History books.',
    tier: 'gold',
    reward: { type: 'title', value: 'Time Traveler' },
    check: s => genre(s, 'historical fiction', 'history', 'historical') >= 10,
  },
  {
    id: 'nonfiction_scholar',
    name: 'Truth Seeker',
    description: 'Read 8+ Nonfiction or Self-Help books.',
    tier: 'gold',
    reward: { type: 'title', value: 'Truth Seeker' },
    check: s => genre(s, 'nonfiction', 'non-fiction', 'self-help', 'self help', 'biography', 'memoir') >= 8,
  },
  {
    id: 'ten_thousand_pages',
    name: 'Marathon Reader',
    description: 'Read 10,000 pages in total.',
    tier: 'gold',
    reward: { type: 'title', value: 'Marathon Reader' },
    check: s => s.totalPages >= 10000,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PLATINUM — Hardcore Reader
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'fifty_books',
    name: 'The Sage',
    description: 'Finish 50 books. True wisdom earned.',
    tier: 'platinum',
    reward: { type: 'title', value: 'The Sage' },
    check: s => s.booksFinished >= 50,
  },
  {
    id: 'hundred_books',
    name: 'Century Reader',
    description: '100 books finished. A legendary feat.',
    tier: 'platinum',
    reward: { type: 'title', value: 'Century Reader' },
    check: s => s.booksFinished >= 100,
  },
  {
    id: 'hundred_sessions',
    name: 'The Devoted',
    description: '100 reading sessions completed. Unmatched dedication.',
    tier: 'platinum',
    reward: { type: 'title', value: 'The Devoted' },
    check: s => s.sessionCount >= 100,
  },
  {
    id: 'streak_100',
    name: 'The Unbreakable',
    description: 'Maintain a 100-day reading streak.',
    tier: 'platinum',
    reward: { type: 'title', value: 'The Unbreakable' },
    check: s => s.streak >= 100,
  },
  {
    id: 'notes_100',
    name: 'The Chronicler',
    description: 'Write 100 notes. Every thought documented.',
    tier: 'platinum',
    reward: { type: 'title', value: 'The Chronicler' },
    check: s => s.notesCount >= 100,
  },
  {
    id: 'two_hundred_sessions',
    name: 'The Devoted Pilgrim',
    description: '200 reading sessions. A true ritual.',
    tier: 'platinum',
    reward: { type: 'title', value: 'The Devoted Pilgrim' },
    check: s => s.sessionCount >= 200,
  },
  {
    id: 'romance_master',
    name: 'Hopeless Romantic',
    description: 'Read 15+ Romance books.',
    tier: 'platinum',
    reward: { type: 'title', value: 'Hopeless Romantic' },
    check: s => genre(s, 'romance') >= 15,
  },
  {
    id: 'fifty_thousand_pages',
    name: 'The Lexicon',
    description: 'Read 50,000 total pages.',
    tier: 'platinum',
    reward: { type: 'title', value: 'The Lexicon' },
    check: s => s.totalPages >= 50000,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DIAMOND — Legendary
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'diamond_reader',
    name: 'Diamond Reader',
    description: '200 books finished. A crystalline achievement.',
    tier: 'diamond',
    reward: { type: 'title', value: 'Diamond Reader' },
    check: s => s.booksFinished >= 200,
  },
  {
    id: 'eternal_flame',
    name: 'The Immortal',
    description: 'Read every single day for a full year (365-day streak).',
    tier: 'diamond',
    reward: { type: 'character', characterId: 'phoenix' },
    check: s => s.streak >= 365,
  },
  {
    id: 'five_hundred_sessions',
    name: 'Transcended Reader',
    description: '500 reading sessions completed.',
    tier: 'diamond',
    reward: { type: 'title', value: 'Transcended' },
    check: s => s.sessionCount >= 500,
  },
  {
    id: 'hundred_thousand_pages',
    name: 'The Wordsmith',
    description: 'Read 100,000 total pages. Words flow through you.',
    tier: 'diamond',
    reward: { type: 'title', value: 'The Wordsmith' },
    check: s => s.totalPages >= 100000,
  },
  {
    id: 'polymath',
    name: 'The Polymath',
    description: 'Read 5+ books in 8 different genres.',
    tier: 'diamond',
    reward: { type: 'title', value: 'The Polymath' },
    check: s => {
      const genres = Object.entries(s.genreCounts)
      let count = 0
      for (const [, v] of genres) if (v >= 5) count++
      return count >= 8
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // OBSIDIAN — Mythic
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'obsidian_scholar',
    name: 'The Obsidian Scholar',
    description: '500 books finished. A living library.',
    tier: 'obsidian',
    reward: { type: 'title', value: 'The Obsidian Scholar' },
    check: s => s.booksFinished >= 500,
  },
  {
    id: 'thousand_sessions',
    name: 'The Eternal',
    description: '1,000 reading sessions. Beyond dedication.',
    tier: 'obsidian',
    reward: { type: 'title', value: 'The Eternal' },
    check: s => s.sessionCount >= 1000,
  },
  {
    id: 'dark_library',
    name: 'Lord of Pages',
    description: 'Accumulate 1,000 hours of reading time. The void welcomes you.',
    tier: 'obsidian',
    reward: { type: 'character', characterId: 'shadow' },
    check: s => s.totalHours >= 1000,
  },
]

// ─── Characters unlocked by default ──────────────────────────────────────────
export const DEFAULT_UNLOCKED: CharacterId[] = ['lion']

/** Returns the set of character IDs the user has unlocked from achievements */
export function getUnlockedCharacters(stats: AchievementStats): Set<CharacterId> {
  const unlocked = new Set<CharacterId>(DEFAULT_UNLOCKED)
  for (const ach of ACHIEVEMENTS) {
    if (ach.reward.type === 'character' && ach.check(stats)) {
      unlocked.add(ach.reward.characterId)
    }
  }
  return unlocked
}

/** Returns titles the user has unlocked */
export function getUnlockedTitles(stats: AchievementStats): string[] {
  return ACHIEVEMENTS
    .filter(a => a.reward.type === 'title' && a.check(stats))
    .map(a => (a.reward as { type: 'title'; value: string }).value)
}

/** Tier styling */
export const TIER_COLORS: Record<AchievementTier, string> = {
  bronze:   '#CD7F32',
  silver:   '#A8A9AD',
  gold:     '#FFD700',
  platinum: '#E8E6F0',
  diamond:  '#B9F2FF',
  obsidian: '#C084FC',
}

export const TIER_EMISSIVE: Record<AchievementTier, string> = {
  bronze:   '#8B4513',
  silver:   '#808080',
  gold:     '#B8860B',
  platinum: '#9370DB',
  diamond:  '#00BFFF',
  obsidian: '#7C3AED',
}
