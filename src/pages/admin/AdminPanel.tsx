import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useTheme } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import type { AchievementCondition, DBAchievement, DBCharacter } from '../../lib/achievementEvaluator'
import { ACHIEVEMENTS, type Achievement } from '../../data/achievements'
import Character3D from '../../components/Character3D'

interface Config { key: string; value: string }
interface UserSummary { id: string; username: string | null; created_at: string }
interface AILog { id: string; feature: string; tokens_used: number; model: string; created_at: string }

type AdminTab = 'config' | 'users' | 'ai' | 'achievements' | 'characters'

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'obsidian'] as const
const STAT_FIELDS = ['booksFinished', 'totalBooks', 'totalPages', 'totalHours', 'streak', 'sessionCount', 'notesCount', 'seriesBooks'] as const

const BUILTIN_CHARACTERS = [
  { id: 'lion',    name: 'Leo',    description: 'The Bold Reader',       primary: '#C17F24', secondary: '#7B4F00', glbPath: '/models/lion.glb'    },
  { id: 'mage',    name: 'Sage',   description: 'The Wise Scholar',      primary: '#7C3AED', secondary: '#2D1B69', glbPath: '/models/mage.glb'    },
  { id: 'fox',     name: 'Vex',    description: 'The Cunning Explorer',  primary: '#D97706', secondary: '#7C2D12', glbPath: '/models/fox.glb'     },
  { id: 'owl',     name: 'Orion',  description: 'The Night Thinker',     primary: '#0F766E', secondary: '#042F2E', glbPath: '/models/owl.glb'     },
  { id: 'knight',  name: 'Vale',   description: 'The Story Guardian',    primary: '#475569', secondary: '#0F172A', glbPath: '/models/knight.glb'  },
  { id: 'cosmic',  name: 'Zara',   description: 'The Dream Weaver',      primary: '#DB2777', secondary: '#4C0519', glbPath: '/models/cosmic.glb'  },
  { id: 'phoenix', name: 'Ember',  description: 'The Eternal Flame',     primary: '#F97316', secondary: '#7C2D12', glbPath: '/models/phoenix.glb' },
  { id: 'shadow',  name: 'Void',   description: 'The Last Reader',       primary: '#4C1D95', secondary: '#0A0014', glbPath: '/models/void.glb'    },
]

// DSL conditions matching the built-in achievement check functions
const BUILTIN_CONDITIONS: Record<string, AchievementCondition> = {
  first_book:           { type: 'stat', field: 'totalBooks',    value: 1 },
  first_session:        { type: 'stat', field: 'sessionCount',  value: 1 },
  three_books:          { type: 'stat', field: 'booksFinished', value: 3 },
  ten_sessions:         { type: 'stat', field: 'sessionCount',  value: 10 },
  first_note:           { type: 'stat', field: 'notesCount',    value: 1 },
  library_five:         { type: 'stat', field: 'totalBooks',    value: 5 },
  two_hours:            { type: 'stat', field: 'totalHours',    value: 2 },
  genre_curious:        { type: 'genreDiversity', value: 3 },
  streak_3:             { type: 'stat', field: 'streak',        value: 3 },
  ten_books:            { type: 'stat', field: 'booksFinished', value: 10 },
  streak_7:             { type: 'stat', field: 'streak',        value: 7 },
  notes_10:             { type: 'stat', field: 'notesCount',    value: 10 },
  notes_25:             { type: 'stat', field: 'notesCount',    value: 25 },
  fifteen_sessions:     { type: 'stat', field: 'sessionCount',  value: 15 },
  twenty_sessions:      { type: 'stat', field: 'sessionCount',  value: 20 },
  five_hundred_pages:   { type: 'stat', field: 'totalPages',    value: 500 },
  one_thousand_pages:   { type: 'stat', field: 'totalPages',    value: 1000 },
  romance_reader:       { type: 'genre', genres: ['romance'], value: 5 },
  twenty_books:         { type: 'stat', field: 'booksFinished', value: 20 },
  thirty_books:         { type: 'stat', field: 'booksFinished', value: 30 },
  streak_30:            { type: 'stat', field: 'streak',        value: 30 },
  fifty_sessions:       { type: 'stat', field: 'sessionCount',  value: 50 },
  notes_50:             { type: 'stat', field: 'notesCount',    value: 50 },
  fantasy_master:       { type: 'genre', genres: ['fantasy'], value: 20 },
  detective:            { type: 'genre', genres: ['mystery', 'thriller', 'crime'], value: 10 },
  magic_realm:          { type: 'genre', genres: ['fantasy', 'science fiction', 'sci-fi', 'scifi'], value: 15 },
  cosmic_explorer:      { type: 'genre', genres: ['science fiction', 'sci-fi', 'scifi'], value: 5 },
  horror_fan:           { type: 'genre', genres: ['horror'], value: 10 },
  history_lover:        { type: 'genre', genres: ['historical fiction', 'history', 'historical'], value: 10 },
  nonfiction_scholar:   { type: 'genre', genres: ['nonfiction', 'non-fiction', 'self-help', 'self help', 'biography', 'memoir'], value: 8 },
  ten_thousand_pages:   { type: 'stat', field: 'totalPages',   value: 10000 },
  series_starter:       { type: 'stat', field: 'seriesBooks',  value: 2 },
  series_fan:           { type: 'stat', field: 'seriesBooks',  value: 6 },
  series_completionist: { type: 'stat', field: 'seriesBooks',  value: 9 },
  fifty_books:          { type: 'stat', field: 'booksFinished', value: 50 },
  hundred_books:        { type: 'stat', field: 'booksFinished', value: 100 },
  hundred_sessions:     { type: 'stat', field: 'sessionCount', value: 100 },
  streak_100:           { type: 'stat', field: 'streak',       value: 100 },
  notes_100:            { type: 'stat', field: 'notesCount',   value: 100 },
  two_hundred_sessions: { type: 'stat', field: 'sessionCount', value: 200 },
  romance_master:       { type: 'genre', genres: ['romance'], value: 15 },
  fifty_thousand_pages: { type: 'stat', field: 'totalPages',  value: 50000 },
  diamond_reader:       { type: 'stat', field: 'booksFinished', value: 200 },
  eternal_flame:        { type: 'stat', field: 'streak',      value: 365 },
  five_hundred_sessions:  { type: 'stat', field: 'sessionCount', value: 500 },
  hundred_thousand_pages: { type: 'stat', field: 'totalPages', value: 100000 },
  polymath:             { type: 'genreDepth', minBooks: 5, genreCount: 8 },
  obsidian_scholar:     { type: 'stat', field: 'booksFinished', value: 500 },
  thousand_sessions:    { type: 'stat', field: 'sessionCount', value: 1000 },
  dark_library:         { type: 'stat', field: 'totalHours',  value: 1000 },
}

const DEFAULT_CONFIGS: Config[] = [
  { key: 'gemini_enabled', value: 'true' },
  { key: 'gemini_model', value: 'gemini-2.5-flash' },
  { key: 'gemini_summary_enabled', value: 'true' },
  { key: 'gemini_recommendations_enabled', value: 'true' },
  { key: 'gemini_wrapped_enabled', value: 'true' },
  { key: 'monthly_token_budget', value: '500000' },
]

// ─── Achievement form state ───────────────────────────────────────────────────
interface AchievementForm {
  id: string
  name: string
  description: string
  tier: string
  rewardType: 'badge' | 'title' | 'character'
  rewardValue: string
  conditionType: 'stat' | 'genre' | 'genreDiversity' | 'genreDepth'
  statField: string
  statValue: string
  genreList: string
  genreValue: string
  diversityValue: string
  depthMinBooks: string
  depthGenreCount: string
}

const EMPTY_ACHIEVEMENT_FORM: AchievementForm = {
  id: '', name: '', description: '', tier: 'bronze',
  rewardType: 'badge', rewardValue: '',
  conditionType: 'stat', statField: 'booksFinished', statValue: '1',
  genreList: '', genreValue: '5',
  diversityValue: '3',
  depthMinBooks: '5', depthGenreCount: '5',
}

// ─── Character form state ─────────────────────────────────────────────────────
interface CharacterForm {
  id: string
  name: string
  description: string
  rarity: string
  defaultPrimary: string
  defaultSecondary: string
  zoomScale: number
  offsetX: number
  offsetY: number
  glbFile: File | null
  existingGlbUrl: string
  textureFile: File | null
  textureRoughnessFile: File | null
  existingTextureUrl: string
  existingTextureRoughnessUrl: string
  snapshotUrl: string
}

const CHAR_RARITIES = ['common', 'uncommon', 'rare', 'legendary', 'mythic'] as const

const EMPTY_CHARACTER_FORM: CharacterForm = {
  id: '', name: '', description: '', rarity: 'rare',
  defaultPrimary: '#888888', defaultSecondary: '#444444',
  zoomScale: 1.0, offsetX: 0, offsetY: 0,
  glbFile: null, existingGlbUrl: '',
  textureFile: null, textureRoughnessFile: null,
  existingTextureUrl: '', existingTextureRoughnessUrl: '',
  snapshotUrl: '',
}

export default function AdminPanel() {
  const { theme } = useTheme()
  const { user, isAdmin, loading } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState<AdminTab>('config')

  // ── Config tab state ──
  const [config, setConfig] = useState<Config[]>(DEFAULT_CONFIGS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // ── Users tab state ──
  const [users, setUsers] = useState<UserSummary[]>([])

  // ── AI tab state ──
  const [aiLogs, setAiLogs] = useState<AILog[]>([])
  const [totalTokens, setTotalTokens] = useState(0)

  // ── Achievements tab state ──
  const [dbAchievements, setDbAchievements] = useState<DBAchievement[]>([])
  const [showAchForm, setShowAchForm] = useState(false)
  const [achForm, setAchForm] = useState<AchievementForm>(EMPTY_ACHIEVEMENT_FORM)
  const [achSaving, setAchSaving] = useState(false)
  const [achError, setAchError] = useState('')

  // ── Characters tab state ──
  const [dbCharacters, setDbCharacters] = useState<DBCharacter[]>([])
  const [showCharForm, setShowCharForm] = useState(false)
  const [charForm, setCharForm] = useState<CharacterForm>(EMPTY_CHARACTER_FORM)
  const [charSaving, setCharSaving] = useState(false)
  const [charError, setCharError] = useState('')
  const [editingCharId, setEditingCharId] = useState<string | null>(null)
  const [editingAchId, setEditingAchId] = useState<string | null>(null)
  const charCaptureRef = useRef<(() => string | null) | null>(null)
  const [charSnapshotSaving, setCharSnapshotSaving] = useState(false)

  const bg = theme.bg
  const fg = theme.fg
  const muted = theme.muted
  const border = theme.border
  const secondary = theme.bgSecondary

  useEffect(() => {
    if (loading) return
    if (!user) { navigate('/'); return }
    if (!isAdmin) { navigate('/home'); return }
    loadConfig()
  }, [user, isAdmin, loading])

  useEffect(() => {
    if (tab === 'users') loadUsers()
    else if (tab === 'ai') loadAiLogs()
    else if (tab === 'achievements') { loadAchievements(); loadCharacters() }
    else if (tab === 'characters') loadCharacters()
  }, [tab])

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadConfig = async () => {
    const { data } = await supabase.from('admin_config').select('*')
    if (data?.length) setConfig(data as Config[])
  }

  const loadUsers = async () => {
    const { data } = await supabase.from('profiles').select('id, username, created_at').limit(50)
    if (data) setUsers(data as UserSummary[])
  }

  const loadAiLogs = async () => {
    const { data } = await supabase.from('ai_usage_log').select('*').order('created_at', { ascending: false }).limit(100)
    if (data) {
      setAiLogs(data as AILog[])
      setTotalTokens((data as AILog[]).reduce((s, l) => s + l.tokens_used, 0))
    }
  }

  const loadAchievements = async () => {
    const { data } = await supabase.from('achievements_config').select('*').order('sort_order')
    if (data) setDbAchievements(data as DBAchievement[])
  }

  const loadCharacters = async () => {
    const { data } = await supabase.from('characters_config').select('*').order('created_at')
    if (data) setDbCharacters(data as DBCharacter[])
  }

  // ── Config tab handlers ────────────────────────────────────────────────────

  const saveConfig = async () => {
    setSaving(true)
    for (const c of config) {
      await supabase.from('admin_config').upsert(
        { key: c.key, value: c.value, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
    }
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const updateConfig = (key: string, value: string) => {
    setConfig(prev => prev.map(c => c.key === key ? { ...c, value } : c))
  }

  const configValue = (key: string) => config.find(c => c.key === key)?.value ?? ''

  // ── Achievement handlers ───────────────────────────────────────────────────

  const buildCondition = (f: AchievementForm): AchievementCondition => {
    switch (f.conditionType) {
      case 'stat':
        return { type: 'stat', field: f.statField as any, value: Number(f.statValue) }
      case 'genre':
        return { type: 'genre', genres: f.genreList.split(',').map(s => s.trim()).filter(Boolean), value: Number(f.genreValue) }
      case 'genreDiversity':
        return { type: 'genreDiversity', value: Number(f.diversityValue) }
      case 'genreDepth':
        return { type: 'genreDepth', minBooks: Number(f.depthMinBooks), genreCount: Number(f.depthGenreCount) }
    }
  }

  const saveAchievement = async () => {
    setAchError('')
    if (!achForm.id || !achForm.name || !achForm.description) {
      setAchError('ID, name and description are required.'); return
    }
    if (achForm.rewardType === 'title' && !achForm.rewardValue) {
      setAchError('Title text is required.'); return
    }
    if (achForm.rewardType === 'character' && !achForm.rewardValue) {
      setAchError('Select a character.'); return
    }
    setAchSaving(true)

    const { error } = await supabase.from('achievements_config').upsert({
      id: achForm.id,
      name: achForm.name,
      description: achForm.description,
      tier: achForm.tier,
      reward_type: achForm.rewardType,
      reward_value: achForm.rewardType === 'badge' ? null : achForm.rewardValue,
      condition: buildCondition(achForm),
      sort_order: dbAchievements.length,
      enabled: true,
    }, { onConflict: 'id' })
    setAchSaving(false)
    if (error) { setAchError(error.message); return }
    setShowAchForm(false)
    setAchForm(EMPTY_ACHIEVEMENT_FORM)
    loadAchievements()
  }

  const deleteAchievement = async (id: string) => {
    await supabase.from('achievements_config').delete().eq('id', id)
    loadAchievements()
  }

  const toggleAchievement = async (id: string, enabled: boolean) => {
    await supabase.from('achievements_config').update({ enabled }).eq('id', id)
    loadAchievements()
  }

  // ── Character handlers ─────────────────────────────────────────────────────

  const saveCharacter = async () => {
    setCharError('')
    if (!charForm.id || !charForm.name || !charForm.description) {
      setCharError('ID, name and description are required.'); return
    }
    if (!charForm.glbFile && !charForm.existingGlbUrl) {
      setCharError('A GLB file is required.'); return
    }
    setCharSaving(true)

    let glbUrl = charForm.existingGlbUrl
    if (charForm.glbFile) {
      const filePath = `${charForm.id}.glb`
      const { error: uploadError } = await supabase.storage
        .from('character-models')
        .upload(filePath, charForm.glbFile, { upsert: true, contentType: 'model/gltf-binary' })
      if (uploadError) { setCharError(uploadError.message); setCharSaving(false); return }
      const { data: urlData } = supabase.storage.from('character-models').getPublicUrl(filePath)
      glbUrl = urlData.publicUrl
    }

    let textureUrl = charForm.existingTextureUrl || null
    if (charForm.textureFile) {
      const texPath = `textures/${charForm.id}_albedo.jpg`
      const { error: texErr } = await supabase.storage
        .from('character-models')
        .upload(texPath, charForm.textureFile, { upsert: true, contentType: charForm.textureFile.type || 'image/jpeg' })
      if (texErr) { setCharError(texErr.message); setCharSaving(false); return }
      const { data: texUrl } = supabase.storage.from('character-models').getPublicUrl(texPath)
      textureUrl = texUrl.publicUrl
    }

    let textureRoughnessUrl = charForm.existingTextureRoughnessUrl || null
    if (charForm.textureRoughnessFile) {
      const roughPath = `textures/${charForm.id}_roughness.png`
      const { error: roughErr } = await supabase.storage
        .from('character-models')
        .upload(roughPath, charForm.textureRoughnessFile, { upsert: true, contentType: charForm.textureRoughnessFile.type || 'image/png' })
      if (roughErr) { setCharError(roughErr.message); setCharSaving(false); return }
      const { data: roughUrl } = supabase.storage.from('character-models').getPublicUrl(roughPath)
      textureRoughnessUrl = roughUrl.publicUrl
    }

    const { error } = await supabase.from('characters_config').upsert({
      id: charForm.id,
      name: charForm.name,
      description: charForm.description,
      rarity: charForm.rarity,
      default_primary: charForm.defaultPrimary,
      default_secondary: charForm.defaultSecondary,
      zoom_scale: charForm.zoomScale,
      offset_x: charForm.offsetX,
      offset_y: charForm.offsetY,
      glb_url: glbUrl,
      texture_url: textureUrl,
      texture_roughness_url: textureRoughnessUrl,
      snapshot_url: charForm.snapshotUrl || null,
      enabled: true,
    }, { onConflict: 'id' })

    setCharSaving(false)
    if (error) { setCharError(error.message); return }
    setShowCharForm(false)
    setCharForm(EMPTY_CHARACTER_FORM)
    setEditingCharId(null)
    loadCharacters()
  }

  const startEditCharacter = (c: DBCharacter) => {
    setCharForm({ id: c.id, name: c.name, description: c.description, rarity: c.rarity ?? 'rare', defaultPrimary: c.default_primary, defaultSecondary: c.default_secondary, zoomScale: c.zoom_scale ?? 1.0, offsetX: c.offset_x ?? 0, offsetY: c.offset_y ?? 0, glbFile: null, existingGlbUrl: c.glb_url, textureFile: null, textureRoughnessFile: null, existingTextureUrl: c.texture_url ?? '', existingTextureRoughnessUrl: c.texture_roughness_url ?? '', snapshotUrl: c.snapshot_url ?? '' })
    setEditingCharId(c.id)
    setCharError('')
    setShowCharForm(false)
    setTimeout(() => setShowCharForm(true), 0)
  }

  const startEditBuiltinCharacter = (c: typeof BUILTIN_CHARACTERS[0]) => {
    const override = dbCharacters.find(d => d.id === c.id)
    setCharForm({
      id: c.id,
      name: override?.name ?? c.name,
      description: override?.description ?? c.description,
      rarity: override?.rarity ?? 'common',
      defaultPrimary: override?.default_primary ?? c.primary,
      defaultSecondary: override?.default_secondary ?? c.secondary,
      zoomScale: override?.zoom_scale ?? 1.0,
      offsetX: override?.offset_x ?? 0,
      offsetY: override?.offset_y ?? 0,
      glbFile: null,
      existingGlbUrl: override?.glb_url ?? c.glbPath,
      textureFile: null, textureRoughnessFile: null,
      existingTextureUrl: override?.texture_url ?? '',
      existingTextureRoughnessUrl: override?.texture_roughness_url ?? '',
      snapshotUrl: override?.snapshot_url ?? '',
    })
    setEditingCharId(c.id)
    setCharError('')
    setShowCharForm(false)
    setTimeout(() => setShowCharForm(true), 0)
  }

  const conditionToForm = (cond: AchievementCondition, f: AchievementForm) => {
    f.conditionType = cond.type as AchievementForm['conditionType']
    if (cond.type === 'stat') { f.statField = cond.field; f.statValue = String(cond.value) }
    else if (cond.type === 'genre') { f.genreList = cond.genres.join(', '); f.genreValue = String(cond.value) }
    else if (cond.type === 'genreDiversity') { f.diversityValue = String(cond.value) }
    else if (cond.type === 'genreDepth') { f.depthMinBooks = String(cond.minBooks); f.depthGenreCount = String(cond.genreCount) }
  }

  const startEditAchievement = (a: DBAchievement) => {
    const f: AchievementForm = {
      id: a.id, name: a.name, description: a.description, tier: a.tier,
      rewardType: a.reward_type, rewardValue: a.reward_value ?? '',
      conditionType: 'stat', statField: 'booksFinished', statValue: '1',
      genreList: '', genreValue: '5', diversityValue: '3', depthMinBooks: '5', depthGenreCount: '5',
    }
    conditionToForm(a.condition, f)
    setAchForm(f)
    setEditingAchId(a.id)
    setAchError('')
    setShowAchForm(false)
    setTimeout(() => setShowAchForm(true), 0)
  }

  const startEditBuiltinAchievement = (a: Achievement) => {
    const override = dbAchievements.find(d => d.id === a.id)
    const cond: AchievementCondition = override?.condition ?? BUILTIN_CONDITIONS[a.id] ?? { type: 'stat', field: 'booksFinished', value: 1 }
    const rewardType = (override?.reward_type ?? a.reward.type) as AchievementForm['rewardType']
    const rewardValue = override
      ? (override.reward_value ?? '')
      : a.reward.type === 'title' ? (a.reward as { type: 'title'; value: string }).value
      : a.reward.type === 'character' ? (a.reward as { type: 'character'; characterId: string }).characterId
      : ''
    const f: AchievementForm = {
      id: a.id, name: override?.name ?? a.name, description: override?.description ?? a.description,
      tier: override?.tier ?? a.tier,
      rewardType, rewardValue,
      conditionType: 'stat', statField: 'booksFinished', statValue: '1',
      genreList: '', genreValue: '5', diversityValue: '3', depthMinBooks: '5', depthGenreCount: '5',
    }
    conditionToForm(cond, f)
    setAchForm(f)
    setEditingAchId(a.id)
    setAchError('')
    setShowAchForm(false)
    setTimeout(() => setShowAchForm(true), 0)
  }

  const deleteCharacter = async (id: string) => {
    await supabase.storage.from('character-models').remove([`${id}.glb`])
    await supabase.from('characters_config').delete().eq('id', id)
    loadCharacters()
  }

  const takeCharSnapshot = async () => {
    const dataUrl = charCaptureRef.current?.()
    if (!dataUrl) return
    setCharSnapshotSaving(true)
    try {
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const filePath = `snapshots/${charForm.id}.png`
      const { error: uploadErr } = await supabase.storage
        .from('character-models')
        .upload(filePath, blob, { upsert: true, contentType: 'image/png' })
      if (uploadErr) { setCharSnapshotSaving(false); return }
      const { data: urlData } = supabase.storage.from('character-models').getPublicUrl(filePath)
      const snapshotUrl = urlData.publicUrl
      setCharForm(f => ({ ...f, snapshotUrl }))
      if (editingCharId) {
        await supabase.from('characters_config').update({ snapshot_url: snapshotUrl }).eq('id', charForm.id)
      }
    } finally {
      setCharSnapshotSaving(false)
    }
  }

  // ── Shared styles ──────────────────────────────────────────────────────────

  const card = { padding: '14px 16px', background: secondary, borderRadius: 12, marginBottom: 8 } as const
  const input = { width: '100%', padding: '10px 12px', background: bg, border: `1px solid ${border}`, borderRadius: 8, fontSize: 14, color: fg, boxSizing: 'border-box' as const }
  const label = { fontSize: 12, color: muted, marginBottom: 6, display: 'block' as const }

  const TIER_COLORS: Record<string, string> = {
    bronze: '#CD7F32', silver: '#A8A9AD', gold: '#FFD700',
    platinum: '#E8E6F0', diamond: '#B9F2FF', obsidian: '#C084FC',
  }

  // ── Inline form elements (rendered after the item being edited) ──────────────

  const achFormEl = !showAchForm ? null : (
    <div style={{ background: secondary, borderRadius: 16, padding: 20, marginTop: 8, marginBottom: 8 }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: fg, marginBottom: 20 }}>{editingAchId ? 'Edit Achievement' : 'New Achievement'}</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <span style={label}>ID (unique, no spaces)</span>
          <input value={achForm.id} readOnly={!!editingAchId} onChange={e => setAchForm(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s+/g, '_') }))} placeholder="e.g. speed_reader" style={{ ...input, opacity: editingAchId ? 0.5 : 1 }} />
        </div>
        <div>
          <span style={label}>Tier</span>
          <select value={achForm.tier} onChange={e => setAchForm(f => ({ ...f, tier: e.target.value }))} style={{ ...input, WebkitAppearance: 'none' }}>
            {TIERS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <span style={label}>Name</span>
        <input value={achForm.name} onChange={e => setAchForm(f => ({ ...f, name: e.target.value }))} placeholder="Achievement name" style={input} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <span style={label}>Description</span>
        <input value={achForm.description} onChange={e => setAchForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description" style={input} />
      </div>

      <div style={{ marginBottom: 16, padding: '14px', background: theme.bgElevated ?? bg, borderRadius: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: fg, marginBottom: 12 }}>Reward</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['badge', 'title', 'character'] as const).map(r => (
            <button key={r} onClick={() => setAchForm(f => ({ ...f, rewardType: r }))}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${achForm.rewardType === r ? theme.accent : border}`, background: achForm.rewardType === r ? theme.accent : 'none', color: achForm.rewardType === r ? theme.accentFg : fg, fontSize: 13, cursor: 'pointer' }}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
        {achForm.rewardType === 'title' && (
          <div>
            <span style={label}>Title text</span>
            <input value={achForm.rewardValue} onChange={e => setAchForm(f => ({ ...f, rewardValue: e.target.value }))} placeholder="e.g. The Speed Reader" style={input} />
          </div>
        )}
        {achForm.rewardType === 'character' && (() => {
          const allChars = [...BUILTIN_CHARACTERS, ...dbCharacters.map(c => ({ id: c.id, name: c.name, primary: c.default_primary }))]
          const usedIds = new Set<string>([
            ...ACHIEVEMENTS.filter(a => a.reward.type === 'character').map(a => (a.reward as { type: 'character'; characterId: string }).characterId),
            ...dbAchievements.filter(a => a.reward_type === 'character' && a.reward_value).map(a => a.reward_value!),
          ])
          return (
            <div>
              <span style={label}>Select character — create characters first in the Characters tab</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {allChars.map(c => {
                  const taken = usedIds.has(c.id) && c.id !== achForm.rewardValue
                  const selected = achForm.rewardValue === c.id
                  return (
                    <button key={c.id} disabled={taken} onClick={() => setAchForm(f => ({ ...f, rewardValue: c.id }))}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '10px 4px', borderRadius: 10, border: `1.5px solid ${selected ? theme.accent : border}`, background: selected ? `${theme.accent}22` : 'none', cursor: taken ? 'default' : 'pointer', opacity: taken ? 0.3 : 1 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: c.primary, flexShrink: 0 }} />
                      <div style={{ fontSize: 10, color: fg, textAlign: 'center', lineHeight: 1.2 }}>{c.name}</div>
                      {taken && <div style={{ fontSize: 9, color: muted }}>taken</div>}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      <div style={{ padding: '14px', background: theme.bgElevated ?? bg, borderRadius: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: fg, marginBottom: 12 }}>Condition</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {(['stat', 'genre', 'genreDiversity', 'genreDepth'] as const).map(t => (
            <button key={t} onClick={() => setAchForm(f => ({ ...f, conditionType: t }))}
              style={{ padding: '8px 0', borderRadius: 8, border: `1px solid ${achForm.conditionType === t ? theme.accent : border}`, background: achForm.conditionType === t ? theme.accent : 'none', color: achForm.conditionType === t ? theme.accentFg : fg, fontSize: 12, cursor: 'pointer' }}>
              {t === 'genreDiversity' ? 'Genre diversity' : t === 'genreDepth' ? 'Genre depth' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {achForm.conditionType === 'stat' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <span style={label}>Stat field</span>
              <select value={achForm.statField} onChange={e => setAchForm(f => ({ ...f, statField: e.target.value }))} style={{ ...input, WebkitAppearance: 'none' }}>
                {STAT_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <span style={label}>Minimum value</span>
              <input type="number" value={achForm.statValue} onChange={e => setAchForm(f => ({ ...f, statValue: e.target.value }))} style={input} />
            </div>
          </div>
        )}
        {achForm.conditionType === 'genre' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <div>
              <span style={label}>Genres (comma-separated)</span>
              <input value={achForm.genreList} onChange={e => setAchForm(f => ({ ...f, genreList: e.target.value }))} placeholder="fantasy, sci-fi" style={input} />
            </div>
            <div>
              <span style={label}>Min books</span>
              <input type="number" value={achForm.genreValue} onChange={e => setAchForm(f => ({ ...f, genreValue: e.target.value }))} style={input} />
            </div>
          </div>
        )}
        {achForm.conditionType === 'genreDiversity' && (
          <div>
            <span style={label}>Minimum number of different genres</span>
            <input type="number" value={achForm.diversityValue} onChange={e => setAchForm(f => ({ ...f, diversityValue: e.target.value }))} style={input} />
          </div>
        )}
        {achForm.conditionType === 'genreDepth' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <span style={label}>Min books per genre</span>
              <input type="number" value={achForm.depthMinBooks} onChange={e => setAchForm(f => ({ ...f, depthMinBooks: e.target.value }))} style={input} />
            </div>
            <div>
              <span style={label}>How many genres</span>
              <input type="number" value={achForm.depthGenreCount} onChange={e => setAchForm(f => ({ ...f, depthGenreCount: e.target.value }))} style={input} />
            </div>
          </div>
        )}
      </div>

      {achError && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{achError}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => { setShowAchForm(false); setEditingAchId(null) }} style={{ flex: 1, padding: 12, background: 'none', border: `1px solid ${border}`, borderRadius: 12, fontSize: 14, color: muted, cursor: 'pointer' }}>Cancel</button>
        <button onClick={saveAchievement} disabled={achSaving} style={{ flex: 2, padding: 12, background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          {achSaving ? 'Saving…' : editingAchId ? 'Update Achievement' : 'Save Achievement'}
        </button>
      </div>
    </div>
  )

  const charFormEl = !showCharForm ? null : (
    <div style={{ background: secondary, borderRadius: 16, padding: 20, marginTop: 8, marginBottom: 8 }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: fg, marginBottom: 20 }}>{editingCharId ? 'Edit Character' : 'New Character'}</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <span style={label}>ID (unique, no spaces)</span>
          <input value={charForm.id} readOnly={!!editingCharId} onChange={e => setCharForm(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s+/g, '_') }))} placeholder="e.g. dragon" style={{ ...input, opacity: editingCharId ? 0.5 : 1 }} />
        </div>
        <div>
          <span style={label}>Name</span>
          <input value={charForm.name} onChange={e => setCharForm(f => ({ ...f, name: e.target.value }))} placeholder="Display name" style={input} />
        </div>
        <div>
          <span style={label}>Rarity</span>
          <select value={charForm.rarity} onChange={e => setCharForm(f => ({ ...f, rarity: e.target.value }))} style={{ ...input, WebkitAppearance: 'none' }}>
            {CHAR_RARITIES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <span style={label}>Description</span>
        <input value={charForm.description} onChange={e => setCharForm(f => ({ ...f, description: e.target.value }))} placeholder="One-line character tagline" style={input} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <span style={label}>Primary color</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={charForm.defaultPrimary} onChange={e => setCharForm(f => ({ ...f, defaultPrimary: e.target.value }))} style={{ width: 44, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
            <input value={charForm.defaultPrimary} onChange={e => setCharForm(f => ({ ...f, defaultPrimary: e.target.value }))} style={{ ...input, flex: 1 }} />
          </div>
        </div>
        <div>
          <span style={label}>Secondary color</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={charForm.defaultSecondary} onChange={e => setCharForm(f => ({ ...f, defaultSecondary: e.target.value }))} style={{ width: 44, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
            <input value={charForm.defaultSecondary} onChange={e => setCharForm(f => ({ ...f, defaultSecondary: e.target.value }))} style={{ ...input, flex: 1 }} />
          </div>
        </div>
      </div>

      {charForm.existingGlbUrl && (
        <div style={{ marginBottom: 16 }}>
          <span style={label}>Preview & position</span>
          <div style={{ background: bg, borderRadius: 12, padding: '12px 0 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Character3D character={charForm.id} glbUrl={charForm.existingGlbUrl} primaryColor={charForm.defaultPrimary} size={160} modelScale={charForm.zoomScale} offsetX={charForm.offsetX} offsetY={charForm.offsetY} capturable captureRef={charCaptureRef} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', width: '100%' }}>
              <button
                onClick={takeCharSnapshot}
                disabled={charSnapshotSaving || !charForm.id}
                style={{ padding: '8px 16px', background: charSnapshotSaving ? secondary : theme.accent, color: theme.accentFg, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: charSnapshotSaving || !charForm.id ? 'default' : 'pointer', opacity: charSnapshotSaving || !charForm.id ? 0.5 : 1 }}>
                {charSnapshotSaving ? 'Saving…' : '📸 Take Snapshot'}
              </button>
              {charForm.snapshotUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src={charForm.snapshotUrl} alt="snapshot" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', border: `1px solid ${border}` }} />
                  <div style={{ fontSize: 11, color: muted }}>Saved snapshot</div>
                </div>
              )}
            </div>
            <div style={{ width: '100%', padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: muted }}>Scale</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: fg }}>{Math.round(charForm.zoomScale * 100)}%</span>
                    <button onClick={() => setCharForm(f => ({ ...f, zoomScale: 1.0 }))} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, border: `1px solid ${border}`, background: 'none', color: muted, cursor: 'pointer' }}>Reset</button>
                  </div>
                </div>
                <input type="range" min="0.01" max="5" step="0.01" value={charForm.zoomScale} onChange={e => setCharForm(f => ({ ...f, zoomScale: parseFloat(e.target.value) }))} style={{ width: '100%', accentColor: theme.accent, cursor: 'pointer' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: muted }}><span>1%</span><span>100%</span><span>500%</span></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: muted }}>Horizontal (X)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: fg }}>{charForm.offsetX.toFixed(2)}</span>
                    <button onClick={() => setCharForm(f => ({ ...f, offsetX: 0 }))} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, border: `1px solid ${border}`, background: 'none', color: muted, cursor: 'pointer' }}>Reset</button>
                  </div>
                </div>
                <input type="range" min="-3" max="3" step="0.05" value={charForm.offsetX} onChange={e => setCharForm(f => ({ ...f, offsetX: parseFloat(e.target.value) }))} style={{ width: '100%', accentColor: theme.accent, cursor: 'pointer' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: muted }}><span>Left</span><span>Center</span><span>Right</span></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: muted }}>Vertical (Y)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: fg }}>{charForm.offsetY.toFixed(2)}</span>
                    <button onClick={() => setCharForm(f => ({ ...f, offsetY: 0 }))} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, border: `1px solid ${border}`, background: 'none', color: muted, cursor: 'pointer' }}>Reset</button>
                  </div>
                </div>
                <input type="range" min="-3" max="3" step="0.05" value={charForm.offsetY} onChange={e => setCharForm(f => ({ ...f, offsetY: parseFloat(e.target.value) }))} style={{ width: '100%', accentColor: theme.accent, cursor: 'pointer' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: muted }}><span>Down</span><span>Center</span><span>Up</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <span style={label}>Texture — albedo / color map (jpg/png)</span>
          <div style={{ border: `2px dashed ${border}`, borderRadius: 10, padding: '14px', textAlign: 'center', background: bg }}>
            {charForm.textureFile ? (
              <div>
                <div style={{ fontSize: 12, color: fg, fontWeight: 500 }}>{charForm.textureFile.name}</div>
                <button onClick={() => setCharForm(f => ({ ...f, textureFile: null }))} style={{ marginTop: 4, fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
              </div>
            ) : charForm.existingTextureUrl ? (
              <div>
                <div style={{ fontSize: 11, color: muted, marginBottom: 4 }}>Texture uploaded</div>
                <label style={{ cursor: 'pointer', fontSize: 12, color: fg, textDecoration: 'underline' }}>
                  Replace<input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setCharForm(p => ({ ...p, textureFile: f })) }} />
                </label>
                <button onClick={() => setCharForm(f => ({ ...f, existingTextureUrl: '' }))} style={{ marginLeft: 8, fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
              </div>
            ) : (
              <label style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: 12, color: muted }}>Upload albedo texture</div>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setCharForm(p => ({ ...p, textureFile: f })) }} />
              </label>
            )}
          </div>
        </div>
        <div>
          <span style={label}>Texture — roughness / metallic map (png)</span>
          <div style={{ border: `2px dashed ${border}`, borderRadius: 10, padding: '14px', textAlign: 'center', background: bg }}>
            {charForm.textureRoughnessFile ? (
              <div>
                <div style={{ fontSize: 12, color: fg, fontWeight: 500 }}>{charForm.textureRoughnessFile.name}</div>
                <button onClick={() => setCharForm(f => ({ ...f, textureRoughnessFile: null }))} style={{ marginTop: 4, fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
              </div>
            ) : charForm.existingTextureRoughnessUrl ? (
              <div>
                <div style={{ fontSize: 11, color: muted, marginBottom: 4 }}>Roughness map uploaded</div>
                <label style={{ cursor: 'pointer', fontSize: 12, color: fg, textDecoration: 'underline' }}>
                  Replace<input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setCharForm(p => ({ ...p, textureRoughnessFile: f })) }} />
                </label>
                <button onClick={() => setCharForm(f => ({ ...f, existingTextureRoughnessUrl: '' }))} style={{ marginLeft: 8, fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
              </div>
            ) : (
              <label style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: 12, color: muted }}>Upload roughness map</div>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setCharForm(p => ({ ...p, textureRoughnessFile: f })) }} />
              </label>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <span style={label}>GLB Model File{editingCharId ? ' (leave empty to keep current)' : ''}</span>
        <div style={{ border: `2px dashed ${border}`, borderRadius: 10, padding: '20px', textAlign: 'center', background: bg }}>
          {charForm.glbFile ? (
            <div>
              <div style={{ fontSize: 14, color: fg, fontWeight: 500 }}>{charForm.glbFile.name}</div>
              <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>{(charForm.glbFile.size / 1024 / 1024).toFixed(2)} MB</div>
              <button onClick={() => setCharForm(f => ({ ...f, glbFile: null }))} style={{ marginTop: 8, fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
            </div>
          ) : editingCharId && charForm.existingGlbUrl ? (
            <div>
              <div style={{ fontSize: 12, color: muted, marginBottom: 6 }}>Current GLB uploaded</div>
              <label style={{ cursor: 'pointer', fontSize: 13, color: fg, textDecoration: 'underline' }}>
                Replace with new file<input type="file" accept=".glb" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setCharForm(prev => ({ ...prev, glbFile: f })) }} />
              </label>
            </div>
          ) : (
            <label style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 14, color: muted }}>Drop a .glb file here or tap to browse</div>
              <input type="file" accept=".glb" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setCharForm(prev => ({ ...prev, glbFile: f })) }} />
            </label>
          )}
        </div>
      </div>

      {charError && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{charError}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => { setShowCharForm(false); setEditingCharId(null) }} style={{ flex: 1, padding: 12, background: 'none', border: `1px solid ${border}`, borderRadius: 12, fontSize: 14, color: muted, cursor: 'pointer' }}>Cancel</button>
        <button onClick={saveCharacter} disabled={charSaving} style={{ flex: 2, padding: 12, background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          {charSaving ? 'Saving…' : editingCharId ? 'Update Character' : 'Save Character'}
        </button>
      </div>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100%', background: bg, padding: '24px 20px 60px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate('/home')} style={{ width: 34, height: 34, borderRadius: '50%', background: secondary, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke={fg} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: fg, letterSpacing: -0.5 }}>Admin</div>
          <div style={{ fontSize: 11, color: muted }}>ClickaClick Dashboard</div>
        </div>
      </div>

      {/* Tabs — horizontal scroll */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
        {(['config', 'users', 'ai', 'achievements', 'characters'] as AdminTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 14px', borderRadius: 999, whiteSpace: 'nowrap',
            background: tab === t ? theme.accent : secondary,
            color: tab === t ? theme.accentFg : muted,
            border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>
            {t === 'ai' ? 'AI Usage' : t === 'config' ? 'Settings' : t === 'achievements' ? 'Achievements' : t === 'characters' ? 'Characters' : 'Users'}
          </button>
        ))}
      </div>

      {/* ── SETTINGS TAB ─────────────────────────────────────────────────── */}
      {tab === 'config' && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[
              { key: 'gemini_enabled', label: 'AI Features Enabled', type: 'toggle' },
              { key: 'gemini_summary_enabled', label: 'Progressive Summaries', type: 'toggle' },
              { key: 'gemini_recommendations_enabled', label: 'AI Recommendations', type: 'toggle' },
              { key: 'gemini_wrapped_enabled', label: 'Year in Review AI', type: 'toggle' },
            ].map(item => (
              <div key={item.key} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: fg }}>{item.label}</span>
                <button onClick={() => updateConfig(item.key, configValue(item.key) === 'true' ? 'false' : 'true')}
                  style={{ width: 44, height: 26, borderRadius: 13, background: configValue(item.key) === 'true' ? theme.accent : border, border: 'none', position: 'relative', transition: 'background 0.2s', cursor: 'pointer' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: configValue(item.key) === 'true' ? theme.accentFg : '#fff', position: 'absolute', top: 4, left: configValue(item.key) === 'true' ? 22 : 4, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                </button>
              </div>
            ))}
            <div style={card}>
              <div style={label}>Gemini Model</div>
              <select value={configValue('gemini_model')} onChange={e => updateConfig('gemini_model', e.target.value)}
                style={{ ...input, WebkitAppearance: 'none' }}>
                <option value="gemini-2.5-flash">gemini-2.5-flash (recommended)</option>
                <option value="gemini-2.0-flash">gemini-2.0-flash (stable)</option>
                <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite (fast, cheap)</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro (most capable)</option>
              </select>
            </div>
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={label}>Monthly Token Budget</div>
              <input type="number" value={configValue('monthly_token_budget')} onChange={e => updateConfig('monthly_token_budget', e.target.value)} style={input} />
            </div>
          </div>
          <button onClick={saveConfig} disabled={saving} style={{ width: '100%', padding: 14, background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>
      )}

      {/* ── USERS TAB ────────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div>
          <div style={{ fontSize: 12, color: muted, marginBottom: 16 }}>{users.length} registered users</div>
          {users.map(u => (
            <div key={u.id} style={card}>
              <div style={{ fontSize: 14, color: fg, fontWeight: 500 }}>{u.username ?? 'No username'}</div>
              <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>Joined {new Date(u.created_at).toLocaleDateString()}</div>
            </div>
          ))}
          {users.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: muted }}>No users found</div>}
        </div>
      )}

      {/* ── AI USAGE TAB ──────────────────────────────────────────────────── */}
      {tab === 'ai' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[{ label: 'Total Tokens', value: totalTokens.toLocaleString() }, { label: 'API Calls', value: String(aiLogs.length) }].map(s => (
              <div key={s.label} style={{ padding: 16, background: secondary, borderRadius: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: muted, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: fg }}>{s.value}</div>
              </div>
            ))}
          </div>
          {aiLogs.slice(0, 20).map(log => (
            <div key={log.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, color: fg, fontWeight: 500 }}>{log.feature}</div>
                <div style={{ fontSize: 11, color: muted }}>{log.model} · {new Date(log.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ fontSize: 13, color: muted }}>{log.tokens_used.toLocaleString()} tokens</div>
            </div>
          ))}
          {aiLogs.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: muted }}>No AI usage yet</div>}
        </div>
      )}

      {/* ── ACHIEVEMENTS TAB ──────────────────────────────────────────────── */}
      {tab === 'achievements' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: muted }}>{dbAchievements.length} custom achievement{dbAchievements.length !== 1 ? 's' : ''}</div>
            <button onClick={() => { setAchForm(EMPTY_ACHIEVEMENT_FORM); setAchError(''); setEditingAchId(null); setShowAchForm(true) }}
              style={{ padding: '8px 16px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              + New Achievement
            </button>
          </div>

          {/* Built-in achievements */}
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: muted, marginBottom: 8 }}>
            Built-in ({ACHIEVEMENTS.length})
          </div>
          {ACHIEVEMENTS.map(a => {
            const hasOverride = dbAchievements.some(d => d.id === a.id)
            const rewardLabel = a.reward.type === 'badge' ? 'badge'
              : a.reward.type === 'title' ? `title — ${(a.reward as { type: 'title'; value: string }).value}`
              : `character — ${(a.reward as { type: 'character'; characterId: string }).characterId}`
            return (
              <div key={a.id}>
                <div style={{ ...card, opacity: hasOverride ? 0.45 : 0.75 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: TIER_COLORS[a.tier] ?? '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>{a.tier}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: fg }}>{a.name}</span>
                        {hasOverride && <span style={{ fontSize: 9, fontWeight: 700, color: theme.accent, background: `${theme.accent}22`, padding: '2px 6px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.5 }}>overridden</span>}
                      </div>
                      <div style={{ fontSize: 11, color: muted }}>{a.description}</div>
                      <div style={{ fontSize: 11, color: muted, marginTop: 3 }}>
                        Reward: <span style={{ color: fg }}>{rewardLabel}</span>
                      </div>
                    </div>
                    <button onClick={() => startEditBuiltinAchievement(a)}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: `1px solid ${border}`, background: 'none', color: fg, cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}>
                      Edit
                    </button>
                  </div>
                </div>
                {editingAchId === a.id && achFormEl}
              </div>
            )
          })}

          {/* Custom DB achievements */}
          {dbAchievements.length > 0 && (
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: muted, margin: '16px 0 8px' }}>
              Custom ({dbAchievements.length})
            </div>
          )}
          {dbAchievements.map(a => (
            <div key={a.id}>
              <div style={{ ...card, opacity: a.enabled ? 1 : 0.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: TIER_COLORS[a.tier] ?? '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>{a.tier}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: fg }}>{a.name}</span>
                    </div>
                    <div style={{ fontSize: 12, color: muted, marginBottom: 4 }}>{a.description}</div>
                    <div style={{ fontSize: 11, color: muted }}>
                      Reward: <span style={{ color: fg }}>{a.reward_type}{a.reward_value ? ` — ${a.reward_value}` : ''}</span>
                      {' · '}Condition: <span style={{ color: fg }}>{a.condition.type}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginLeft: 8, flexShrink: 0 }}>
                    <button onClick={() => { setShowAchForm(false); setTimeout(() => startEditAchievement(a), 0) }}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: `1px solid ${border}`, background: 'none', color: fg, cursor: 'pointer' }}>
                      Edit
                    </button>
                    <button onClick={() => toggleAchievement(a.id, !a.enabled)}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: `1px solid ${border}`, background: 'none', color: muted, cursor: 'pointer' }}>
                      {a.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => deleteAchievement(a.id)}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid #ef4444', background: 'none', color: '#ef4444', cursor: 'pointer' }}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
              {editingAchId === a.id && achFormEl}
            </div>
          ))}

          {dbAchievements.length === 0 && !showAchForm && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: muted, fontSize: 13 }}>No custom achievements yet.</div>
          )}

          {/* New achievement form appears at bottom only when not editing an existing one */}
          {!editingAchId && achFormEl}
        </div>
      )}

      {/* ── CHARACTERS TAB ────────────────────────────────────────────────── */}
      {tab === 'characters' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: muted }}>{dbCharacters.length} custom character{dbCharacters.length !== 1 ? 's' : ''}</div>
            <button onClick={() => { setCharForm(EMPTY_CHARACTER_FORM); setCharError(''); setEditingCharId(null); setShowCharForm(true) }}
              style={{ padding: '8px 16px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              + New Character
            </button>
          </div>

          {/* Built-in characters */}
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: muted, marginBottom: 8 }}>
            Built-in ({BUILTIN_CHARACTERS.length})
          </div>
          {BUILTIN_CHARACTERS.map(c => {
            const hasOverride = dbCharacters.some(d => d.id === c.id)
            return (
              <div key={c.id}>
                <div style={{ ...card, opacity: hasOverride ? 0.45 : 0.75 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: c.primary, flexShrink: 0 }} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: fg }}>{c.name}</span>
                          {hasOverride && <span style={{ fontSize: 9, fontWeight: 700, color: theme.accent, background: `${theme.accent}22`, padding: '2px 6px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.5 }}>overridden</span>}
                        </div>
                        <div style={{ fontSize: 11, color: muted }}>ID: {c.id} · built-in</div>
                      </div>
                    </div>
                    <button onClick={() => startEditBuiltinCharacter(c)}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: `1px solid ${border}`, background: 'none', color: fg, cursor: 'pointer', flexShrink: 0 }}>
                      Edit
                    </button>
                  </div>
                </div>
                {editingCharId === c.id && charFormEl}
              </div>
            )
          })}

          {/* Custom characters */}
          {dbCharacters.length > 0 && (
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: muted, margin: '16px 0 8px' }}>
              Custom ({dbCharacters.length})
            </div>
          )}
          {dbCharacters.map(c => (
            <div key={c.id}>
              <div style={{ ...card, opacity: c.enabled ? 1 : 0.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: c.default_primary, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: fg }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: muted }}>{c.description}</div>
                      <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>ID: {c.id}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => { setShowCharForm(false); setTimeout(() => startEditCharacter(c), 0) }}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: `1px solid ${border}`, background: 'none', color: fg, cursor: 'pointer' }}>
                      Edit
                    </button>
                    <button onClick={() => deleteCharacter(c.id)}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid #ef4444', background: 'none', color: '#ef4444', cursor: 'pointer' }}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
              {editingCharId === c.id && charFormEl}
            </div>
          ))}

          {dbCharacters.length === 0 && !showCharForm && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: muted, fontSize: 13 }}>No custom characters yet.</div>
          )}

          {/* New character form at bottom only */}
          {!editingCharId && charFormEl}
        </div>
      )}
    </div>
  )
}
