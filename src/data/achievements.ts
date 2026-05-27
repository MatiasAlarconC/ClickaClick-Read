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
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum'
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

// ─── Achievement catalog ──────────────────────────────────────────────────────
export const ACHIEVEMENTS: Achievement[] = [
  // ── Bronze ──────────────────────────────────────────────────────────────────
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

  // ── Silver ───────────────────────────────────────────────────────────────────
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
    id: 'five_hundred_pages',
    name: 'Page Turner',
    description: 'Read 500 pages in total.',
    tier: 'silver',
    reward: { type: 'badge' },
    check: s => s.totalPages >= 500,
  },

  // ── Gold ─────────────────────────────────────────────────────────────────────
  {
    id: 'thirty_books',
    name: 'The Scholar',
    description: 'Finish 30 books. Knowledge is your power.',
    tier: 'gold',
    reward: { type: 'title', value: 'The Scholar' },
    check: s => s.booksFinished >= 30,
  },
  {
    id: 'fantasy_master',
    name: 'Fantasy Master',
    description: 'Read 20+ books in the Fantasy genre.',
    tier: 'gold',
    reward: { type: 'title', value: 'Fantasy Master' },
    check: s => (s.genreCounts['Fantasy'] ?? 0) + (s.genreCounts['fantasy'] ?? 0) >= 20,
  },
  {
    id: 'detective',
    name: 'The Detective',
    description: 'Read 10+ Mystery or Thriller books.',
    tier: 'gold',
    reward: { type: 'character', characterId: 'fox' },
    check: s =>
      (s.genreCounts['Mystery'] ?? 0) +
      (s.genreCounts['mystery'] ?? 0) +
      (s.genreCounts['Thriller'] ?? 0) +
      (s.genreCounts['thriller'] ?? 0) >= 10,
  },
  {
    id: 'magic_realm',
    name: 'Magic Realm',
    description: 'Read 15+ Fantasy or Sci-Fi books.',
    tier: 'gold',
    reward: { type: 'character', characterId: 'mage' },
    check: s =>
      (s.genreCounts['Fantasy'] ?? 0) +
      (s.genreCounts['fantasy'] ?? 0) +
      (s.genreCounts['Science Fiction'] ?? 0) +
      (s.genreCounts['Sci-Fi'] ?? 0) +
      (s.genreCounts['sci-fi'] ?? 0) >= 15,
  },
  {
    id: 'cosmic_explorer',
    name: 'Cosmic Explorer',
    description: 'Read 5+ Science Fiction books.',
    tier: 'gold',
    reward: { type: 'character', characterId: 'cosmic' },
    check: s =>
      (s.genreCounts['Science Fiction'] ?? 0) +
      (s.genreCounts['Sci-Fi'] ?? 0) +
      (s.genreCounts['sci-fi'] ?? 0) >= 5,
  },
  {
    id: 'ten_thousand_pages',
    name: 'Marathon Reader',
    description: 'Read 10,000 pages in total.',
    tier: 'gold',
    reward: { type: 'title', value: 'Marathon Reader' },
    check: s => s.totalPages >= 10000,
  },

  // ── Platinum ──────────────────────────────────────────────────────────────────
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
    id: 'fifty_thousand_pages',
    name: 'Speed Reader',
    description: 'Read 50,000 total pages.',
    tier: 'platinum',
    reward: { type: 'title', value: 'Speed Reader' },
    check: s => s.totalPages >= 50000,
  },
]

// ─── Characters that are unlocked by default ────────────────────────────────
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

/** Tier styling helpers */
export const TIER_COLORS: Record<AchievementTier, string> = {
  bronze:   '#CD7F32',
  silver:   '#A8A9AD',
  gold:     '#FFD700',
  platinum: '#E8E6F0',
}

export const TIER_EMISSIVE: Record<AchievementTier, string> = {
  bronze:   '#8B4513',
  silver:   '#808080',
  gold:     '#B8860B',
  platinum: '#9370DB',
}
