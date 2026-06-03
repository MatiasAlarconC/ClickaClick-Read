import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useTheme } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import type { AchievementCondition, DBAchievement, DBCharacter } from '../../lib/achievementEvaluator'

interface Config { key: string; value: string }
interface UserSummary { id: string; username: string | null; created_at: string }
interface AILog { id: string; feature: string; tokens_used: number; model: string; created_at: string }

type AdminTab = 'config' | 'users' | 'ai' | 'achievements' | 'characters'

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'obsidian'] as const
const STAT_FIELDS = ['booksFinished', 'totalBooks', 'totalPages', 'totalHours', 'streak', 'sessionCount', 'notesCount'] as const

const DEFAULT_CONFIGS: Config[] = [
  { key: 'gemini_enabled', value: 'true' },
  { key: 'gemini_model', value: 'gemini-1.5-flash' },
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
  // Inline new-character fields (only used when rewardType === 'character' and newChar === true)
  newChar: boolean
  newCharId: string
  newCharName: string
  newCharDescription: string
  newCharPrimary: string
  newCharSecondary: string
  newCharGlb: File | null
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
  newChar: true, newCharId: '', newCharName: '', newCharDescription: '',
  newCharPrimary: '#888888', newCharSecondary: '#444444', newCharGlb: null,
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
  defaultPrimary: string
  defaultSecondary: string
  glbFile: File | null
}

const EMPTY_CHARACTER_FORM: CharacterForm = {
  id: '', name: '', description: '',
  defaultPrimary: '#888888', defaultSecondary: '#444444',
  glbFile: null,
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
    else if (tab === 'achievements') loadAchievements()
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
    if (achForm.rewardType === 'character') {
      if (achForm.newChar) {
        if (!achForm.newCharId || !achForm.newCharName || !achForm.newCharDescription) {
          setAchError('Character ID, name and description are required.'); return
        }
        if (!achForm.newCharGlb) {
          setAchError('A GLB file is required for the new character.'); return
        }
      } else if (!achForm.rewardValue) {
        setAchError('Character ID is required.'); return
      }
    }
    setAchSaving(true)

    let characterId = achForm.rewardValue

    // If creating a new character inline, upload GLB and insert record first
    if (achForm.rewardType === 'character' && achForm.newChar) {
      const filePath = `${achForm.newCharId}.glb`
      const { error: uploadErr } = await supabase.storage
        .from('character-models')
        .upload(filePath, achForm.newCharGlb!, { upsert: true, contentType: 'model/gltf-binary' })
      if (uploadErr) { setAchError(`GLB upload failed: ${uploadErr.message}`); setAchSaving(false); return }

      const { data: urlData } = supabase.storage.from('character-models').getPublicUrl(filePath)
      const { error: charErr } = await supabase.from('characters_config').upsert({
        id: achForm.newCharId,
        name: achForm.newCharName,
        description: achForm.newCharDescription,
        default_primary: achForm.newCharPrimary,
        default_secondary: achForm.newCharSecondary,
        glb_url: urlData.publicUrl,
        enabled: true,
      }, { onConflict: 'id' })
      if (charErr) { setAchError(`Character save failed: ${charErr.message}`); setAchSaving(false); return }
      characterId = achForm.newCharId
    }

    const { error } = await supabase.from('achievements_config').upsert({
      id: achForm.id,
      name: achForm.name,
      description: achForm.description,
      tier: achForm.tier,
      reward_type: achForm.rewardType,
      reward_value: achForm.rewardType === 'badge' ? null : characterId,
      condition: buildCondition(achForm),
      sort_order: dbAchievements.length,
      enabled: true,
    }, { onConflict: 'id' })
    setAchSaving(false)
    if (error) { setAchError(error.message); return }
    setShowAchForm(false)
    setAchForm(EMPTY_ACHIEVEMENT_FORM)
    loadAchievements()
    if (achForm.rewardType === 'character') loadCharacters()
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
    if (!charForm.glbFile) {
      setCharError('A GLB file is required.'); return
    }
    setCharSaving(true)

    const filePath = `${charForm.id}.glb`
    const { error: uploadError } = await supabase.storage
      .from('character-models')
      .upload(filePath, charForm.glbFile, { upsert: true, contentType: 'model/gltf-binary' })

    if (uploadError) { setCharError(uploadError.message); setCharSaving(false); return }

    const { data: urlData } = supabase.storage.from('character-models').getPublicUrl(filePath)
    const glbUrl = urlData.publicUrl

    const { error } = await supabase.from('characters_config').upsert({
      id: charForm.id,
      name: charForm.name,
      description: charForm.description,
      default_primary: charForm.defaultPrimary,
      default_secondary: charForm.defaultSecondary,
      glb_url: glbUrl,
      enabled: true,
    }, { onConflict: 'id' })

    setCharSaving(false)
    if (error) { setCharError(error.message); return }
    setShowCharForm(false)
    setCharForm(EMPTY_CHARACTER_FORM)
    loadCharacters()
  }

  const deleteCharacter = async (id: string) => {
    await supabase.storage.from('character-models').remove([`${id}.glb`])
    await supabase.from('characters_config').delete().eq('id', id)
    loadCharacters()
  }

  // ── Shared styles ──────────────────────────────────────────────────────────

  const card = { padding: '14px 16px', background: secondary, borderRadius: 12, marginBottom: 8 } as const
  const input = { width: '100%', padding: '10px 12px', background: bg, border: `1px solid ${border}`, borderRadius: 8, fontSize: 14, color: fg, boxSizing: 'border-box' as const }
  const label = { fontSize: 12, color: muted, marginBottom: 6, display: 'block' as const }

  const TIER_COLORS: Record<string, string> = {
    bronze: '#CD7F32', silver: '#A8A9AD', gold: '#FFD700',
    platinum: '#E8E6F0', diamond: '#B9F2FF', obsidian: '#C084FC',
  }

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
                <option value="gemini-1.5-flash">gemini-1.5-flash (fast, cheap)</option>
                <option value="gemini-1.5-pro">gemini-1.5-pro (smart, slower)</option>
                <option value="gemini-2.0-flash">gemini-2.0-flash (latest)</option>
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
            <button onClick={() => { setAchForm(EMPTY_ACHIEVEMENT_FORM); setAchError(''); setShowAchForm(true) }}
              style={{ padding: '8px 16px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              + New Achievement
            </button>
          </div>

          {/* Achievement list */}
          {dbAchievements.map(a => (
            <div key={a.id} style={{ ...card, opacity: a.enabled ? 1 : 0.5 }}>
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
                <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
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
          ))}

          {dbAchievements.length === 0 && !showAchForm && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: muted }}>No custom achievements yet.</div>
          )}

          {/* Create achievement form */}
          {showAchForm && (
            <div style={{ background: secondary, borderRadius: 16, padding: 20, marginTop: 16 }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: fg, marginBottom: 20 }}>New Achievement</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <span style={label}>ID (unique, no spaces)</span>
                  <input value={achForm.id} onChange={e => setAchForm(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s+/g, '_') }))} placeholder="e.g. speed_reader" style={input} />
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

              {/* Reward */}
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
                    <input value={achForm.rewardValue} onChange={e => setAchForm(f => ({ ...f, rewardValue: e.target.value }))}
                      placeholder="e.g. The Speed Reader" style={input} />
                  </div>
                )}

                {achForm.rewardType === 'character' && (
                  <div>
                    {/* Toggle: new character vs existing */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <button onClick={() => setAchForm(f => ({ ...f, newChar: true }))}
                        style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: `1px solid ${achForm.newChar ? theme.accent : border}`, background: achForm.newChar ? theme.accent : 'none', color: achForm.newChar ? theme.accentFg : fg }}>
                        New character
                      </button>
                      <button onClick={() => setAchForm(f => ({ ...f, newChar: false }))}
                        style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: `1px solid ${!achForm.newChar ? theme.accent : border}`, background: !achForm.newChar ? theme.accent : 'none', color: !achForm.newChar ? theme.accentFg : fg }}>
                        Existing character
                      </button>
                    </div>

                    {achForm.newChar ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div>
                            <span style={label}>Character ID (unique)</span>
                            <input value={achForm.newCharId} onChange={e => setAchForm(f => ({ ...f, newCharId: e.target.value.toLowerCase().replace(/\s+/g, '_') }))} placeholder="e.g. dragon" style={input} />
                          </div>
                          <div>
                            <span style={label}>Character name</span>
                            <input value={achForm.newCharName} onChange={e => setAchForm(f => ({ ...f, newCharName: e.target.value }))} placeholder="e.g. Ember" style={input} />
                          </div>
                        </div>
                        <div>
                          <span style={label}>Character description</span>
                          <input value={achForm.newCharDescription} onChange={e => setAchForm(f => ({ ...f, newCharDescription: e.target.value }))} placeholder="e.g. The Ancient Flame" style={input} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div>
                            <span style={label}>Primary color</span>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input type="color" value={achForm.newCharPrimary} onChange={e => setAchForm(f => ({ ...f, newCharPrimary: e.target.value }))}
                                style={{ width: 36, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                              <input value={achForm.newCharPrimary} onChange={e => setAchForm(f => ({ ...f, newCharPrimary: e.target.value }))} style={{ ...input, flex: 1 }} />
                            </div>
                          </div>
                          <div>
                            <span style={label}>Secondary color</span>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input type="color" value={achForm.newCharSecondary} onChange={e => setAchForm(f => ({ ...f, newCharSecondary: e.target.value }))}
                                style={{ width: 36, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                              <input value={achForm.newCharSecondary} onChange={e => setAchForm(f => ({ ...f, newCharSecondary: e.target.value }))} style={{ ...input, flex: 1 }} />
                            </div>
                          </div>
                        </div>
                        <div>
                          <span style={label}>GLB Model File</span>
                          <div style={{ border: `2px dashed ${border}`, borderRadius: 10, padding: '16px', textAlign: 'center', background: bg }}>
                            {achForm.newCharGlb ? (
                              <div>
                                <div style={{ fontSize: 13, color: fg, fontWeight: 500 }}>{achForm.newCharGlb.name}</div>
                                <div style={{ fontSize: 11, color: muted }}>{(achForm.newCharGlb.size / 1024 / 1024).toFixed(2)} MB</div>
                                <button onClick={() => setAchForm(f => ({ ...f, newCharGlb: null }))} style={{ marginTop: 6, fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                              </div>
                            ) : (
                              <label style={{ cursor: 'pointer' }}>
                                <div style={{ fontSize: 13, color: muted }}>Tap to select .glb file</div>
                                <input type="file" accept=".glb" style={{ display: 'none' }}
                                  onChange={e => { const f = e.target.files?.[0]; if (f) setAchForm(prev => ({ ...prev, newCharGlb: f })) }} />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span style={label}>Existing character ID</span>
                        <input value={achForm.rewardValue} onChange={e => setAchForm(f => ({ ...f, rewardValue: e.target.value }))}
                          placeholder="e.g. lion, mage, dragon…" style={input} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Condition */}
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
                <button onClick={() => setShowAchForm(false)} style={{ flex: 1, padding: 12, background: 'none', border: `1px solid ${border}`, borderRadius: 12, fontSize: 14, color: muted, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={saveAchievement} disabled={achSaving} style={{ flex: 2, padding: 12, background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  {achSaving ? 'Saving…' : 'Save Achievement'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CHARACTERS TAB ────────────────────────────────────────────────── */}
      {tab === 'characters' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: muted }}>{dbCharacters.length} custom character{dbCharacters.length !== 1 ? 's' : ''}</div>
            <button onClick={() => { setCharForm(EMPTY_CHARACTER_FORM); setCharError(''); setShowCharForm(true) }}
              style={{ padding: '8px 16px', background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              + New Character
            </button>
          </div>

          {/* Character list */}
          {dbCharacters.map(c => (
            <div key={c.id} style={{ ...card, opacity: c.enabled ? 1 : 0.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: c.default_primary }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: fg }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: muted }}>{c.description}</div>
                    <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>ID: {c.id}</div>
                  </div>
                </div>
                <button onClick={() => deleteCharacter(c.id)}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid #ef4444', background: 'none', color: '#ef4444', cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            </div>
          ))}

          {dbCharacters.length === 0 && !showCharForm && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: muted }}>No custom characters yet.</div>
          )}

          {/* Create character form */}
          {showCharForm && (
            <div style={{ background: secondary, borderRadius: 16, padding: 20, marginTop: 16 }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: fg, marginBottom: 20 }}>New Character</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <span style={label}>ID (unique, no spaces)</span>
                  <input value={charForm.id} onChange={e => setCharForm(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s+/g, '_') }))} placeholder="e.g. dragon" style={input} />
                </div>
                <div>
                  <span style={label}>Name</span>
                  <input value={charForm.name} onChange={e => setCharForm(f => ({ ...f, name: e.target.value }))} placeholder="Display name" style={input} />
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
                    <input type="color" value={charForm.defaultPrimary} onChange={e => setCharForm(f => ({ ...f, defaultPrimary: e.target.value }))}
                      style={{ width: 44, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                    <input value={charForm.defaultPrimary} onChange={e => setCharForm(f => ({ ...f, defaultPrimary: e.target.value }))} style={{ ...input, flex: 1 }} />
                  </div>
                </div>
                <div>
                  <span style={label}>Secondary color</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" value={charForm.defaultSecondary} onChange={e => setCharForm(f => ({ ...f, defaultSecondary: e.target.value }))}
                      style={{ width: 44, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                    <input value={charForm.defaultSecondary} onChange={e => setCharForm(f => ({ ...f, defaultSecondary: e.target.value }))} style={{ ...input, flex: 1 }} />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <span style={label}>GLB Model File</span>
                <div style={{ border: `2px dashed ${border}`, borderRadius: 10, padding: '20px', textAlign: 'center', background: bg }}>
                  {charForm.glbFile ? (
                    <div>
                      <div style={{ fontSize: 14, color: fg, fontWeight: 500 }}>{charForm.glbFile.name}</div>
                      <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>{(charForm.glbFile.size / 1024 / 1024).toFixed(2)} MB</div>
                      <button onClick={() => setCharForm(f => ({ ...f, glbFile: null }))} style={{ marginTop: 8, fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: 14, color: muted }}>Drop a .glb file here or tap to browse</div>
                      <input type="file" accept=".glb" style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) setCharForm(prev => ({ ...prev, glbFile: f })) }} />
                    </label>
                  )}
                </div>
              </div>

              {charError && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{charError}</div>}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowCharForm(false)} style={{ flex: 1, padding: 12, background: 'none', border: `1px solid ${border}`, borderRadius: 12, fontSize: 14, color: muted, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={saveCharacter} disabled={charSaving} style={{ flex: 2, padding: 12, background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  {charSaving ? 'Uploading & saving…' : 'Save Character'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
