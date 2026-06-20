import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import {
  ACHIEVEMENTS, TIER_COLORS, getUnlockedCharacters, getUnlockedTitles, getAchievementProgress,
  type Achievement, type AchievementTier, type AchievementStats
} from '../data/achievements'
import { CHARACTERS, AvatarCharacter, type CharacterId } from '../components/AvatarCharacter'
import Medal3D from '../components/Medal3D'
import MedalIcon from '../components/MedalIcon'
import Character3D, { CharacterSnapshotBatch, type SnapshotCharacter } from '../components/Character3D'
import {
  evaluateCondition, getConditionProgress,
  type DBAchievement, type DBCharacter, type AchievementCondition,
} from '../lib/achievementEvaluator'

interface UnifiedAchievement extends Achievement {
  condition?: AchievementCondition
}

// ─── Genre count helper ───────────────────────────────────────────────────────
function countGenres(userBooks: { book?: { genres?: string[] | null } | null }[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const ub of userBooks) {
    for (const g of ub.book?.genres ?? []) {
      counts[g] = (counts[g] ?? 0) + 1
    }
  }
  return counts
}

// ─── Tier label ───────────────────────────────────────────────────────────────
const TIER_LABEL: Record<AchievementTier, string> = {
  bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum',
  diamond: 'Diamond', obsidian: 'Obsidian',
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function AchievementsScreen() {
  const { theme } = useTheme()
  const { user, profile, updateProfile } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState<AchievementStats | null>(null)
  const [selectedTitle, setSelectedTitle] = useState<string | null>(
    (profile as any)?.title ?? null
  )
  const [savingTitle, setSavingTitle] = useState(false)
  const [showTitlePicker, setShowTitlePicker] = useState(false)
  const [dbAchievements, setDbAchievements] = useState<DBAchievement[]>([])
  const [dbCharacters, setDbCharacters] = useState<DBCharacter[]>([])
  const [dbAchievementsLoaded, setDbAchievementsLoaded] = useState(false)
  const [dbCharactersLoaded, setDbCharactersLoaded] = useState(false)
  const notifyCheckedRef = useRef(false)

  // Static PNG snapshots of 3D models — avoids multiple WebGL contexts
  const SNAPSHOT_CACHE_KEY = 'char_snapshots_v1'
  const [charSnapshots, setCharSnapshots] = useState<Record<string, string>>(() => {
    try { return JSON.parse(sessionStorage.getItem(SNAPSHOT_CACHE_KEY) ?? '{}') } catch { return {} }
  })
  // DB snapshots from admin take priority — no auto-capture needed for these
  const dbSnapshotMap = useMemo(
    () => {
      const m: Record<string, string> = {}
      for (const c of dbCharacters) { if (c.snapshot_url) m[c.id] = c.snapshot_url }
      return m
    },
    [dbCharacters]
  )

  // Only auto-capture chars that don't already have a DB snapshot
  const snapshotChars = useMemo<SnapshotCharacter[]>(
    () => [
      ...CHARACTERS.filter(c => !dbSnapshotMap[c.id]).map(c => ({ id: c.id, primaryColor: c.defaultPrimary })),
      ...dbCharacters.filter(c => !c.snapshot_url).map(c => ({ id: c.id, glbUrl: c.glb_url, primaryColor: c.default_primary })),
    ],
    [dbCharacters, dbSnapshotMap]
  )

  const snapshotsReady = dbCharactersLoaded && snapshotChars.every(c => charSnapshots[c.id])
  const handleSnapshots = useCallback((snaps: Record<string, string>) => {
    setCharSnapshots(snaps)
    try { sessionStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify(snaps)) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    supabase.from('achievements_config').select('*').eq('enabled', true).order('sort_order')
      .then(({ data }) => {
        if (data) setDbAchievements(data as DBAchievement[])
        setDbAchievementsLoaded(true)
      })
    supabase.from('characters_config').select('*').eq('enabled', true)
      .then(({ data }) => {
        if (data) setDbCharacters(data as DBCharacter[])
        setDbCharactersLoaded(true)
      })
  }, [])

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('user_books').select('*, book:books(genres, title, series_data)').eq('user_id', user.id),
      supabase.from('reading_sessions').select('pages_read, duration_seconds, started_at, is_manual').eq('user_id', user.id),
      supabase.from('book_notes').select('id').eq('user_id', user.id),
    ]).then(([ubRes, sessRes, notesRes]) => {
      const userBooks = (ubRes.data ?? []) as any[]
      const sessions = (sessRes.data ?? []) as any[]
      const booksFinished = userBooks.filter((b: any) => b.status === 'finished').length
      const totalBooks = userBooks.length
      const timedSessions = sessions.filter((s: any) => !s.is_manual)
      const totalPages = sessions.reduce((sum: number, s: any) => sum + (s.pages_read ?? 0), 0)
      const totalHours = timedSessions.reduce((sum: number, s: any) => sum + ((s.duration_seconds ?? 0) / 3600), 0)
      const sessionCount = timedSessions.length
      const notesCount = (notesRes.data ?? []).length

      // Streak
      const dates = new Set(timedSessions.map((s: any) => new Date(s.started_at).toDateString()))
      let streak = 0
      const today = new Date()
      for (let i = 0; i < 366; i++) {
        const d = new Date(today); d.setDate(today.getDate() - i)
        if (dates.has(d.toDateString())) streak++
        else if (i > 0) break
      }

      const seriesBooks = userBooks.filter((b: any) =>
        b.status === 'finished' && (b.book?.series_data as any)?.seriesName
      ).length

      setStats({
        booksFinished, totalBooks, totalPages,
        totalHours, streak,
        genreCounts: countGenres(userBooks),
        sessionCount, notesCount, seriesBooks,
      })
    })
  }, [user])

  // Notification check — runs only once per session and only after BOTH stats
  // and DB achievements are loaded, to avoid false "new unlock" notifications
  // caused by the double-render (dbAchievements=[] first, then populated).
  useEffect(() => {
    if (!user || !stats || !dbAchievementsLoaded || notifyCheckedRef.current) return
    notifyCheckedRef.current = true

    const dbConverted: UnifiedAchievement[] = dbAchievements.map(a => ({
      id: a.id, name: a.name, description: a.description,
      tier: a.tier as AchievementTier,
      reward: a.reward_type === 'badge'
        ? { type: 'badge' as const }
        : a.reward_type === 'title'
        ? { type: 'title' as const, value: a.reward_value! }
        : { type: 'character' as const, characterId: a.reward_value! },
      check: (s: AchievementStats) => evaluateCondition(a.condition, s),
      condition: a.condition,
    }))
    const allAchs = [...ACHIEVEMENTS, ...dbConverted]
    const currentUnlocked = allAchs.filter(a => a.check(stats)).map(a => a.id)

    const seenKey = `seen_achievements_${user.id}`
    const seen: string[] = JSON.parse(localStorage.getItem(seenKey) ?? '[]')

    if (seen.length === 0) {
      localStorage.setItem(seenKey, JSON.stringify(currentUnlocked))
    } else {
      const newlyUnlocked = currentUnlocked.filter(id => !seen.includes(id))
      if (newlyUnlocked.length > 0) {
        localStorage.setItem(seenKey, JSON.stringify(currentUnlocked))
        const toNotify = allAchs.filter(a => newlyUnlocked.includes(a.id))
        const notifRows = toNotify.map(a => ({
          user_id: user.id,
          type: 'achievement',
          title: 'Achievement unlocked',
          body: `You unlocked "${a.name}".`,
          data: { achievement_id: a.id },
        }))
        supabase.from('notifications').insert(notifRows).then(() => {})
      }
    }
  }, [user, stats, dbAchievementsLoaded])

  const dbConverted: UnifiedAchievement[] = dbAchievements.map(a => ({
    id: a.id, name: a.name, description: a.description,
    tier: a.tier as AchievementTier,
    reward: a.reward_type === 'badge'
      ? { type: 'badge' as const }
      : a.reward_type === 'title'
      ? { type: 'title' as const, value: a.reward_value! }
      : { type: 'character' as const, characterId: a.reward_value! },
    check: (s: AchievementStats) => evaluateCondition(a.condition, s),
    condition: a.condition,
  }))
  const allAchievements: UnifiedAchievement[] = [...ACHIEVEMENTS, ...dbConverted]

  const unlockedSet = stats ? new Set(allAchievements.filter(a => a.check(stats)).map(a => a.id)) : new Set<string>()
  const unlockedCharacters = stats
    ? new Set([
        ...getUnlockedCharacters(stats),
        ...dbConverted
          .filter(a => a.reward.type === 'character' && a.check(stats))
          .map(a => (a.reward as { type: 'character'; characterId: string }).characterId),
      ])
    : new Set(['lion'])
  const unlockedTitles = stats
    ? [
        ...getUnlockedTitles(stats),
        ...dbConverted
          .filter(a => a.reward.type === 'title' && a.check(stats))
          .map(a => (a.reward as { type: 'title'; value: string }).value),
      ]
    : []
  const unlockedCount = unlockedSet.size
  const total = allAchievements.length

  const equipTitle = async (title: string | null) => {
    setSelectedTitle(title)
    setSavingTitle(true)
    await updateProfile({ title } as any)
    setSavingTitle(false)
    setShowTitlePicker(false)
  }

  const tiers: AchievementTier[] = ['obsidian', 'diamond', 'platinum', 'gold', 'silver', 'bronze']

  return (
    <div style={{ minHeight: '100%', background: theme.bg }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: theme.bg, borderBottom: `1px solid ${theme.border}`, padding: '16px 22px 16px', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 56px)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => navigate(-1)} style={{ width: 34, height: 34, borderRadius: '50%', background: theme.bgSecondary, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke={theme.fg} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: theme.fg }}>Achievements</div>
          {stats && (
            <div style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>{unlockedCount} / {total} unlocked</div>
          )}
        </div>
      </div>

      {/* Sequential snapshot renderer — runs in background, one canvas at a time */}
      {!snapshotsReady && dbCharactersLoaded && (
        <CharacterSnapshotBatch
          characters={snapshotChars}
          onSnapshots={handleSnapshots}
          size={72}
        />
      )}

      <div style={{ padding: '22px 22px 80px' }}>
        {/* Progress bar */}
        {stats && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ height: 6, background: theme.bgSecondary, borderRadius: 3, overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(unlockedCount / total) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{ height: '100%', background: `linear-gradient(90deg, #FFD700, #CD7F32)`, borderRadius: 3 }}
              />
            </div>
          </div>
        )}

        {/* Title section */}
        {unlockedTitles.length > 0 && (
          <div style={{ marginBottom: 28, padding: '16px', background: theme.bgSecondary, borderRadius: 14, border: `1px solid ${theme.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 10 }}>Your Title</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#FFD700' }}>
                {selectedTitle ?? <span style={{ color: theme.muted, fontSize: 14, fontFamily: 'inherit' }}>None equipped</span>}
              </div>
              <button onClick={() => setShowTitlePicker(t => !t)} style={{ padding: '8px 14px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 12, color: theme.fg }}>
                {showTitlePicker ? 'Close' : 'Change'}
              </button>
            </div>
            {showTitlePicker && (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button onClick={() => equipTitle(null)} style={{ padding: '6px 12px', borderRadius: 999, background: selectedTitle === null ? theme.fg : theme.bg, color: selectedTitle === null ? theme.bg : theme.fg, border: `1px solid ${theme.border}`, fontSize: 13 }}>
                  None
                </button>
                {unlockedTitles.map(t => (
                  <button key={t} onClick={() => equipTitle(t)} style={{ padding: '6px 12px', borderRadius: 999, background: selectedTitle === t ? '#FFD700' : theme.bg, color: selectedTitle === t ? '#000' : theme.fg, border: `1px solid ${theme.border}`, fontSize: 13, fontWeight: selectedTitle === t ? 600 : 400 }}>
                    {t}
                  </button>
                ))}
                {savingTitle && <span style={{ fontSize: 12, color: theme.muted, alignSelf: 'center' }}>Saving…</span>}
              </div>
            )}
          </div>
        )}

        {/* Unlocked characters section */}
        {unlockedCharacters.size > 1 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 14 }}>Unlocked Characters</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {/* Built-in characters: DB admin snapshot → auto-batch snapshot → SVG fallback */}
              {CHARACTERS.map(c => {
                const unlocked = unlockedCharacters.has(c.id)
                const snap = dbSnapshotMap[c.id] || charSnapshots[c.id]
                return (
                  <div key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: unlocked ? 1 : 0.35 }}>
                    <div style={{ width: 72, height: 72, background: theme.bgSecondary, borderRadius: 16, border: `2px solid ${unlocked ? c.defaultPrimary + '80' : theme.border}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', filter: unlocked ? 'none' : 'grayscale(0.85)' }}>
                      {snap
                        ? <img src={snap} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <AvatarCharacter character={c.id} primaryColor={c.defaultPrimary} secondaryColor={c.defaultSecondary} size={55} />
                      }
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: unlocked ? theme.fg : theme.muted }}>{c.name}</div>
                    {!unlocked && <div style={{ fontSize: 10, color: theme.muted }}>locked</div>}
                  </div>
                )
              })}
              {/* DB characters: DB admin snapshot → auto-batch snapshot → 3D fallback */}
              {dbCharacters.map(c => {
                const unlocked = unlockedCharacters.has(c.id)
                const snap = dbSnapshotMap[c.id] || charSnapshots[c.id]
                return (
                  <div key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: unlocked ? 1 : 0.35 }}>
                    <div style={{ width: 72, height: 72, background: theme.bgSecondary, borderRadius: 16, border: `2px solid ${unlocked ? c.default_primary + '80' : theme.border}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', filter: unlocked ? 'none' : 'grayscale(0.7)' }}>
                      {snap
                        ? <img src={snap} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <Character3D character={c.id} size={72} interactive={false} locked={!unlocked} primaryColor={c.default_primary} secondaryColor={c.default_secondary} glbUrl={c.glb_url} modelScale={c.zoom_scale} offsetX={c.offset_x} offsetY={c.offset_y} textureUrl={c.texture_url} textureRoughnessUrl={c.texture_roughness_url} />
                      }
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: unlocked ? theme.fg : theme.muted }}>{c.name}</div>
                    {!unlocked && <div style={{ fontSize: 10, color: theme.muted }}>locked</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Achievements by tier */}
        {tiers.map(tier => {
          const tierAchievements = allAchievements.filter(a => a.tier === tier)
          return (
            <div key={tier} style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: TIER_COLORS[tier], boxShadow: `0 0 8px ${TIER_COLORS[tier]}80` }} />
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: TIER_COLORS[tier] }}>{TIER_LABEL[tier]}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tierAchievements.map((ach, i) => {
                  const unlocked = stats ? ach.check(stats) : false
                  return (
                    <motion.div
                      key={ach.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '12px 14px',
                        background: theme.bgSecondary,
                        borderRadius: 14,
                        border: `1px solid ${unlocked ? TIER_COLORS[tier] + '50' : theme.border}`,
                        opacity: unlocked ? 1 : 0.55,
                      }}
                    >
                      {/* Left icon: SVG avatar for built-in chars, 3D for custom, medal for others */}
                      {ach.reward.type === 'character' ? (() => {
                        const charId = (ach.reward as { type: 'character'; characterId: string }).characterId
                        const dynChar = dbCharacters.find(c => c.id === charId)
                        const builtinChar = CHARACTERS.find(c => c.id === charId)
                        return (
                          <div style={{ flexShrink: 0, width: 72, height: 72, borderRadius: 12, overflow: 'hidden',
                            border: `2px solid ${unlocked ? TIER_COLORS[ach.tier] + '60' : theme.border}`,
                            background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {builtinChar ? (
                              <div style={{ filter: unlocked ? 'none' : 'grayscale(1)', opacity: unlocked ? 1 : 0.5, width: '100%', height: '100%' }}>
                                {(dbSnapshotMap[builtinChar.id] || charSnapshots[builtinChar.id])
                                  ? <img src={dbSnapshotMap[builtinChar.id] || charSnapshots[builtinChar.id]} alt={builtinChar.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : <AvatarCharacter character={builtinChar.id} primaryColor={builtinChar.defaultPrimary} secondaryColor={builtinChar.defaultSecondary} size={55} />
                                }
                              </div>
                            ) : (
                              <div style={{ filter: unlocked ? 'none' : 'grayscale(1)', opacity: unlocked ? 1 : 0.5, width: '100%', height: '100%' }}>
                                {dynChar && (dbSnapshotMap[dynChar.id] || charSnapshots[dynChar.id])
                                  ? <img src={dbSnapshotMap[dynChar.id] || charSnapshots[dynChar.id]} alt={dynChar.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : <Character3D character={charId} locked={!unlocked} size={72} interactive={false} glbUrl={dynChar?.glb_url} />
                                }
                              </div>
                            )}
                          </div>
                        )
                      })() : (
                        <MedalIcon tier={ach.tier} locked={!unlocked} size={72} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: unlocked ? theme.fg : theme.muted }}>{ach.name}</div>
                        <div style={{ fontSize: 12, color: theme.muted, marginTop: 2, lineHeight: 1.5 }}>{ach.description}</div>
                        {/* Reward badge */}
                        <div style={{ marginTop: 6 }}>
                          {ach.reward.type === 'title' && (
                            <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 999, background: unlocked ? '#FFD70020' : theme.bg, border: `1px solid ${unlocked ? '#FFD700' : theme.border}`, fontSize: 11, color: unlocked ? '#FFD700' : theme.muted }}>
                              ✦ Title: "{ach.reward.value}"
                            </span>
                          )}
                          {ach.reward.type === 'character' && (
                            <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 999, background: unlocked ? TIER_COLORS[ach.tier] + '15' : theme.bg, border: `1px solid ${unlocked ? TIER_COLORS[ach.tier] + '80' : theme.border}`, fontSize: 11, color: unlocked ? TIER_COLORS[ach.tier] : theme.muted }}>
                              ✶ Unlocks: {
                                CHARACTERS.find(c => c.id === (ach.reward as { type: 'character'; characterId: string }).characterId)?.name
                                ?? dbCharacters.find(c => c.id === (ach.reward as { type: 'character'; characterId: string }).characterId)?.name
                                ?? (ach.reward as any).characterId
                              }
                            </span>
                          )}
                          {ach.reward.type === 'badge' && (
                            <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 999, background: theme.bg, border: `1px solid ${theme.border}`, fontSize: 11, color: theme.muted }}>
                              ◆ Badge
                            </span>
                          )}
                        </div>
                        {/* Progress bar */}
                        {!unlocked && stats && (() => {
                          const p = (ach as UnifiedAchievement).condition
                            ? getConditionProgress((ach as UnifiedAchievement).condition!, stats)
                            : getAchievementProgress(ach.id, stats)
                          if (!p) return null
                          const pct = p.target > 0 ? Math.min(100, (p.current / p.target) * 100) : 0
                          const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n)
                          return (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: 10, color: theme.muted }}>{fmt(p.current)} / {fmt(p.target)}</span>
                                <span style={{ fontSize: 10, color: theme.muted }}>{Math.round(pct)}%</span>
                              </div>
                              <div style={{ height: 4, background: theme.bg, borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: TIER_COLORS[ach.tier], borderRadius: 2, transition: 'width 0.6s ease' }}/>
                              </div>
                            </div>
                          )
                        })()}
                        {unlocked && (
                          <div style={{ fontSize: 11, color: TIER_COLORS[tier], marginTop: 4, fontWeight: 600 }}>✓ Unlocked</div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
