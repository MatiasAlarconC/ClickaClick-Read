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

  // ══════════════════════════════════════════════════════════════════════════
  // NEW CHARACTERS — Unlock achievements
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ninja_scholar',
    name: 'Silent but Deadly',
    description: 'Complete 30 reading sessions without missing a beat.',
    tier: 'silver',
    reward: { type: 'character', characterId: 'ninja' },
    check: s => s.sessionCount >= 30,
  },
  {
    id: 'viking_saga',
    name: 'Epic Saga Reader',
    description: 'Finish 15 books. A true saga warrior.',
    tier: 'silver',
    reward: { type: 'character', characterId: 'viking' },
    check: s => s.booksFinished >= 15,
  },
  {
    id: 'astronaut_explorer',
    name: 'To Infinity',
    description: 'Read 10 Sci-Fi books and explore the universe.',
    tier: 'gold',
    reward: { type: 'character', characterId: 'astronaut' },
    check: s => genre(s, 'science fiction', 'sci-fi', 'scifi') >= 10,
  },
  {
    id: 'witch_spellbound',
    name: 'Spellbound',
    description: 'Read 10 Fantasy books. Magic is real.',
    tier: 'gold',
    reward: { type: 'character', characterId: 'witch' },
    check: s => genre(s, 'fantasy') >= 10,
  },
  {
    id: 'pirate_adventure',
    name: 'Ahoy, Adventure!',
    description: 'Read 5 Adventure books. X marks the spot.',
    tier: 'silver',
    reward: { type: 'character', characterId: 'pirate' },
    check: s => genre(s, 'adventure') >= 5,
  },
  {
    id: 'robot_analyst',
    name: 'Data Overload',
    description: 'Complete 75 reading sessions. Systematic precision.',
    tier: 'gold',
    reward: { type: 'character', characterId: 'robot' },
    check: s => s.sessionCount >= 75,
  },
  {
    id: 'samurai_discipline',
    name: 'The Way of the Reader',
    description: 'Maintain a 21-day reading streak. Discipline is everything.',
    tier: 'silver',
    reward: { type: 'character', characterId: 'samurai' },
    check: s => s.streak >= 21,
  },
  {
    id: 'angel_celestial',
    name: 'Celestial Reader',
    description: 'Accumulate 100 hours of reading time. Ascended.',
    tier: 'gold',
    reward: { type: 'character', characterId: 'angel' },
    check: s => s.totalHours >= 100,
  },
  {
    id: 'dragon_legendary',
    name: 'The Legendary',
    description: 'Read 25,000 total pages. A dragon\'s hoard of knowledge.',
    tier: 'platinum',
    reward: { type: 'character', characterId: 'dragon' },
    check: s => s.totalPages >= 25000,
  },
  {
    id: 'jester_comic',
    name: 'Comic Relief',
    description: 'Read 5 Humor or Comedy books. Laughter is wisdom.',
    tier: 'bronze',
    reward: { type: 'character', characterId: 'jester' },
    check: s => genre(s, 'humor', 'comedy', 'comic') >= 5,
  },
  {
    id: 'alchemist_knowledge',
    name: 'The Great Work',
    description: 'Read at least 5 books each in 5 different genres.',
    tier: 'platinum',
    reward: { type: 'character', characterId: 'alchemist' },
    check: s => Object.values(s.genreCounts).filter(v => v >= 5).length >= 5,
  },
  {
    id: 'necromancer_dark',
    name: 'Midnight Scholar',
    description: 'Accumulate 500 hours of reading time in the darkness.',
    tier: 'diamond',
    reward: { type: 'character', characterId: 'necromancer' },
    check: s => s.totalHours >= 500,
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

/**
 * Returns { current, target } for numeric achievements so a progress bar can
 * be displayed.  Returns null for complex/non-numeric achievements.
 */
export function getAchievementProgress(
  achId: string,
  s: AchievementStats,
): { current: number; target: number } | null {
  switch (achId) {
    // — library count
    case 'first_book':      return { current: Math.min(s.totalBooks, 1),   target: 1 }
    case 'library_five':    return { current: Math.min(s.totalBooks, 5),   target: 5 }
    // — books finished
    case 'three_books':     return { current: Math.min(s.booksFinished, 3),   target: 3 }
    case 'ten_books':       return { current: Math.min(s.booksFinished, 10),  target: 10 }
    case 'twenty_books':    return { current: Math.min(s.booksFinished, 20),  target: 20 }
    case 'thirty_books':    return { current: Math.min(s.booksFinished, 30),  target: 30 }
    case 'fifty_books':     return { current: Math.min(s.booksFinished, 50),  target: 50 }
    case 'hundred_books':   return { current: Math.min(s.booksFinished, 100), target: 100 }
    case 'diamond_reader':  return { current: Math.min(s.booksFinished, 200), target: 200 }
    case 'obsidian_scholar':return { current: Math.min(s.booksFinished, 500), target: 500 }
    // — sessions
    case 'first_session':        return { current: Math.min(s.sessionCount, 1),   target: 1 }
    case 'ten_sessions':         return { current: Math.min(s.sessionCount, 10),  target: 10 }
    case 'fifteen_sessions':     return { current: Math.min(s.sessionCount, 15),  target: 15 }
    case 'twenty_sessions':      return { current: Math.min(s.sessionCount, 20),  target: 20 }
    case 'fifty_sessions':       return { current: Math.min(s.sessionCount, 50),  target: 50 }
    case 'hundred_sessions':     return { current: Math.min(s.sessionCount, 100), target: 100 }
    case 'two_hundred_sessions': return { current: Math.min(s.sessionCount, 200), target: 200 }
    case 'five_hundred_sessions':return { current: Math.min(s.sessionCount, 500), target: 500 }
    case 'thousand_sessions':    return { current: Math.min(s.sessionCount, 1000),target: 1000 }
    // — notes
    case 'first_note':  return { current: Math.min(s.notesCount, 1),   target: 1 }
    case 'notes_10':    return { current: Math.min(s.notesCount, 10),  target: 10 }
    case 'notes_25':    return { current: Math.min(s.notesCount, 25),  target: 25 }
    case 'notes_50':    return { current: Math.min(s.notesCount, 50),  target: 50 }
    case 'notes_100':   return { current: Math.min(s.notesCount, 100), target: 100 }
    // — streak
    case 'streak_3':     return { current: Math.min(s.streak, 3),   target: 3 }
    case 'streak_7':     return { current: Math.min(s.streak, 7),   target: 7 }
    case 'streak_30':    return { current: Math.min(s.streak, 30),  target: 30 }
    case 'streak_100':   return { current: Math.min(s.streak, 100), target: 100 }
    case 'eternal_flame':return { current: Math.min(s.streak, 365), target: 365 }
    // — pages
    case 'five_hundred_pages':    return { current: Math.min(s.totalPages, 500),    target: 500 }
    case 'one_thousand_pages':    return { current: Math.min(s.totalPages, 1000),   target: 1000 }
    case 'ten_thousand_pages':    return { current: Math.min(s.totalPages, 10000),  target: 10000 }
    case 'fifty_thousand_pages':  return { current: Math.min(s.totalPages, 50000),  target: 50000 }
    case 'hundred_thousand_pages':return { current: Math.min(s.totalPages, 100000), target: 100000 }
    // — hours
    case 'two_hours':    return { current: Math.min(Math.round(s.totalHours * 10) / 10, 2),    target: 2 }
    case 'dark_library': return { current: Math.min(Math.round(s.totalHours),       1000), target: 1000 }
    // — genre diversity
    case 'genre_curious': return {
      current: Math.min(Object.values(s.genreCounts).filter(v => v > 0).length, 3),
      target: 3,
    }
    // — genre depth
    case 'romance_reader':    return { current: Math.min(genre(s, 'romance'), 5),  target: 5 }
    case 'romance_master':    return { current: Math.min(genre(s, 'romance'), 15), target: 15 }
    case 'fantasy_master':    return { current: Math.min(genre(s, 'fantasy'), 20), target: 20 }
    case 'detective':         return { current: Math.min(genre(s, 'mystery', 'thriller', 'crime'), 10), target: 10 }
    case 'magic_realm':       return { current: Math.min(genre(s, 'fantasy', 'science fiction', 'sci-fi', 'scifi'), 15), target: 15 }
    case 'cosmic_explorer':   return { current: Math.min(genre(s, 'science fiction', 'sci-fi', 'scifi'), 5), target: 5 }
    case 'horror_fan':        return { current: Math.min(genre(s, 'horror'), 10), target: 10 }
    case 'history_lover':     return { current: Math.min(genre(s, 'historical fiction', 'history', 'historical'), 10), target: 10 }
    case 'nonfiction_scholar':return { current: Math.min(genre(s, 'nonfiction', 'non-fiction', 'self-help', 'self help', 'biography', 'memoir'), 8), target: 8 }
    default: return null
  }
}
