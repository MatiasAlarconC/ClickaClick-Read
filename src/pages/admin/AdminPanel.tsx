import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useTheme } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'

interface Config { key: string; value: string }
interface UserSummary { id: string; email: string; username: string | null; books_count: number; created_at: string }
interface AILog { id: string; feature: string; tokens_used: number; model: string; created_at: string }

type AdminTab = 'config' | 'users' | 'ai'

const DEFAULT_CONFIGS: Config[] = [
  { key: 'gemini_enabled', value: 'true' },
  { key: 'gemini_model', value: 'gemini-1.5-flash' },
  { key: 'gemini_summary_enabled', value: 'true' },
  { key: 'gemini_recommendations_enabled', value: 'true' },
  { key: 'gemini_wrapped_enabled', value: 'true' },
  { key: 'monthly_token_budget', value: '500000' },
]

export default function AdminPanel() {
  const { theme } = useTheme()
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<AdminTab>('config')
  const [config, setConfig] = useState<Config[]>(DEFAULT_CONFIGS)
  const [users, setUsers] = useState<UserSummary[]>([])
  const [aiLogs, setAiLogs] = useState<AILog[]>([])
  const [totalTokens, setTotalTokens] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!user) { navigate('/'); return }
    if (!isAdmin) { navigate('/home'); return }
    loadConfig()
  }, [user, isAdmin])

  useEffect(() => {
    if (tab === 'users') loadUsers()
    if (tab === 'ai') loadAiLogs()
  }, [tab])

  const loadConfig = async () => {
    const { data } = await supabase.from('admin_config').select('*')
    if (data?.length) setConfig(data as Config[])
  }

  const loadUsers = async () => {
    const { data } = await supabase.from('profiles').select('id, username, created_at').limit(50)
    if (data) setUsers(data.map((u: { id: string; username: string | null; created_at: string }) => ({ id: u.id, email: '', username: u.username, books_count: 0, created_at: u.created_at })))
  }

  const loadAiLogs = async () => {
    const { data } = await supabase.from('ai_usage_log').select('*').order('created_at', { ascending: false }).limit(100)
    if (data) {
      setAiLogs(data as AILog[])
      setTotalTokens((data as AILog[]).reduce((s, l) => s + l.tokens_used, 0))
    }
  }

  const saveConfig = async () => {
    setSaving(true)
    for (const c of config) {
      await supabase.from('admin_config').upsert({ key: c.key, value: c.value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    }
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const updateConfig = (key: string, value: string) => {
    setConfig(prev => prev.map(c => c.key === key ? { ...c, value } : c))
  }

  const configValue = (key: string) => config.find(c => c.key === key)?.value ?? ''

  const bg = theme.bg; const fg = theme.fg; const muted = theme.muted; const border = theme.border; const secondary = theme.bgSecondary

  return (
    <div style={{ minHeight: '100%', background: bg, padding: '24px 20px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button onClick={() => navigate('/home')} style={{ width: 34, height: 34, borderRadius: '50%', background: secondary, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke={fg} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: fg, letterSpacing: -0.5 }}>Admin</div>
          <div style={{ fontSize: 11, color: muted }}>ClickaClick Dashboard</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['config', 'users', 'ai'] as AdminTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', borderRadius: 999, background: tab === t ? theme.accent : secondary, color: tab === t ? theme.accentFg : muted, border: 'none', fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>
            {t === 'ai' ? 'AI Usage' : t === 'config' ? 'Settings' : 'Users'}
          </button>
        ))}
      </div>

      {/* Config tab */}
      {tab === 'config' && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>

            {/* Toggle: Gemini enabled */}
            {[
              { key: 'gemini_enabled', label: 'AI Features Enabled', type: 'toggle' },
              { key: 'gemini_summary_enabled', label: 'Progressive Summaries', type: 'toggle' },
              { key: 'gemini_recommendations_enabled', label: 'AI Recommendations', type: 'toggle' },
              { key: 'gemini_wrapped_enabled', label: 'Year in Review AI', type: 'toggle' },
            ].map(item => (
              <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: secondary, borderRadius: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 14, color: fg }}>{item.label}</span>
                <button onClick={() => updateConfig(item.key, configValue(item.key) === 'true' ? 'false' : 'true')} style={{ width: 44, height: 26, borderRadius: 13, background: configValue(item.key) === 'true' ? theme.accent : border, border: 'none', position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: configValue(item.key) === 'true' ? theme.accentFg : '#fff', position: 'absolute', top: 4, left: configValue(item.key) === 'true' ? 22 : 4, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                </button>
              </div>
            ))}

            {/* Model selector */}
            <div style={{ padding: '14px 16px', background: secondary, borderRadius: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: muted, marginBottom: 8 }}>Gemini Model</div>
              <select value={configValue('gemini_model')} onChange={e => updateConfig('gemini_model', e.target.value)}
                style={{ width: '100%', padding: '10px', background: bg, border: `1px solid ${border}`, borderRadius: 8, fontSize: 14, color: fg, WebkitAppearance: 'none' }}>
                <option value="gemini-1.5-flash">gemini-1.5-flash (fast, cheap)</option>
                <option value="gemini-1.5-pro">gemini-1.5-pro (smart, slower)</option>
                <option value="gemini-2.0-flash">gemini-2.0-flash (latest)</option>
              </select>
            </div>

            {/* Token budget */}
            <div style={{ padding: '14px 16px', background: secondary, borderRadius: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: muted, marginBottom: 8 }}>Monthly Token Budget</div>
              <input type="number" value={configValue('monthly_token_budget')} onChange={e => updateConfig('monthly_token_budget', e.target.value)}
                style={{ width: '100%', padding: '10px', background: bg, border: `1px solid ${border}`, borderRadius: 8, fontSize: 16, color: fg }} />
            </div>
          </div>

          <button onClick={saveConfig} disabled={saving} style={{ width: '100%', padding: 14, background: theme.accent, color: theme.accentFg, border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 500 }}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>
      )}

      {/* Users tab */}
      {tab === 'users' && (
        <div>
          <div style={{ fontSize: 12, color: muted, marginBottom: 16 }}>{users.length} registered users</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {users.map((u, i) => (
              <div key={u.id} style={{ padding: '14px 16px', background: secondary, borderRadius: 12, marginBottom: 6 }}>
                <div style={{ fontSize: 14, color: fg, fontWeight: 500 }}>{u.username ?? 'No username'}</div>
                <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>Joined {new Date(u.created_at).toLocaleDateString()}</div>
              </div>
            ))}
            {users.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: muted }}>No users found</div>}
          </div>
        </div>
      )}

      {/* AI Usage tab */}
      {tab === 'ai' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Total Tokens', value: totalTokens.toLocaleString() },
              { label: 'API Calls', value: String(aiLogs.length) },
            ].map(s => (
              <div key={s.label} style={{ padding: '16px', background: secondary, borderRadius: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: muted, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: fg }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {aiLogs.slice(0, 20).map(log => (
              <div key={log.id} style={{ padding: '12px 16px', background: secondary, borderRadius: 10, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, color: fg, fontWeight: 500 }}>{log.feature}</div>
                  <div style={{ fontSize: 11, color: muted }}>{log.model} · {new Date(log.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ fontSize: 13, color: muted }}>{log.tokens_used.toLocaleString()} tokens</div>
              </div>
            ))}
            {aiLogs.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: muted }}>No AI usage yet</div>}
          </div>
        </div>
      )}
    </div>
  )
}
