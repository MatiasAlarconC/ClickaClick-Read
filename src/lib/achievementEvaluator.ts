import type { AchievementStats } from '../data/achievements'

// ─── Condition DSL stored as JSONB in achievements_config ─────────────────────
export type AchievementCondition =
  | { type: 'stat'; field: 'booksFinished' | 'totalBooks' | 'totalPages' | 'totalHours' | 'streak' | 'sessionCount' | 'notesCount' | 'seriesBooks'; value: number }
  | { type: 'genre'; genres: string[]; value: number }
  | { type: 'genreDiversity'; value: number }
  | { type: 'genreDepth'; minBooks: number; genreCount: number }

function sumGenres(stats: AchievementStats, genres: string[]): number {
  return genres.reduce((sum, g) => {
    const lower = g.toLowerCase()
    return sum + Object.entries(stats.genreCounts).reduce(
      (acc, [k, v]) => k.toLowerCase() === lower ? acc + v : acc, 0
    )
  }, 0)
}

export function evaluateCondition(condition: AchievementCondition, stats: AchievementStats): boolean {
  switch (condition.type) {
    case 'stat':
      return stats[condition.field] >= condition.value
    case 'genre':
      return sumGenres(stats, condition.genres) >= condition.value
    case 'genreDiversity':
      return Object.values(stats.genreCounts).filter(v => v > 0).length >= condition.value
    case 'genreDepth':
      return Object.values(stats.genreCounts).filter(v => v >= condition.minBooks).length >= condition.genreCount
    default:
      return false
  }
}

export function getConditionProgress(
  condition: AchievementCondition,
  stats: AchievementStats,
): { current: number; target: number } | null {
  switch (condition.type) {
    case 'stat':
      return { current: Math.min(stats[condition.field], condition.value), target: condition.value }
    case 'genre':
      return { current: Math.min(sumGenres(stats, condition.genres), condition.value), target: condition.value }
    case 'genreDiversity':
      return {
        current: Math.min(Object.values(stats.genreCounts).filter(v => v > 0).length, condition.value),
        target: condition.value,
      }
    case 'genreDepth':
      return null
    default:
      return null
  }
}

// ─── DB row shape from achievements_config ────────────────────────────────────
export interface DBAchievement {
  id: string
  name: string
  description: string
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'obsidian'
  reward_type: 'badge' | 'title' | 'character'
  reward_value: string | null
  condition: AchievementCondition
  sort_order: number
  enabled: boolean
}

// ─── DB row shape from characters_config ──────────────────────────────────────
export interface DBCharacter {
  id: string
  name: string
  description: string
  default_primary: string
  default_secondary: string
  glb_url: string
  rarity?: string
  enabled: boolean
}
