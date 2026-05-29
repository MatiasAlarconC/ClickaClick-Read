import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { TabBar } from '../components/UI'

interface FriendProfile { id: string; username: string | null; avatar_url: string | null }
interface Friendship { id: string; requester_id: string; addressee_id: string; status: string }

function Avatar({ p, size = 38 }: { p: FriendProfile; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#333', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4 }}>
      {p.avatar_url
        ? <img src={p.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={p.username ?? '?'} />
        : <span style={{ color: '#999' }}>{(p.username?.[0] ?? '?').toUpperCase()}</span>}
    </div>
  )
}

export default function FriendsScreen() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [search,       setSearch]       = useState('')
  const [searching,    setSearching]    = useState(false)
  const [searchRes,    setSearchRes]    = useState<FriendProfile[]>([])
  const [friends,      setFriends]      = useState<FriendProfile[]>([])
  const [incoming,     setIncoming]     = useState<(Friendship & { profile: FriendProfile })[]>([])
  const [outgoing,     setOutgoing]     = useState<(Friendship & { profile: FriendProfile })[]>([])
  const [actionId,     setActionId]     = useState<string | null>(null)
  const [loading,      setLoading]      = useState(true)

  // ── Load friends & requests ──────────────────────────────────────────────
  const reload = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    const rows = (data ?? []) as Friendship[]
    const peerIds = rows.map(r => (r.requester_id === user.id ? r.addressee_id : r.requester_id))
    const profiles: Record<string, FriendProfile> = {}

    if (peerIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, username, avatar_url').in('id', peerIds)
      for (const p of profs ?? []) profiles[p.id] = p as FriendProfile
    }

    const accepted: FriendProfile[] = []
    const inc: (Friendship & { profile: FriendProfile })[] = []
    const out: (Friendship & { profile: FriendProfile })[] = []

    for (const r of rows) {
      const peerId = r.requester_id === user.id ? r.addressee_id : r.requester_id
      const prof = profiles[peerId] ?? { id: peerId, username: null, avatar_url: null }
      if (r.status === 'accepted') { accepted.push(prof) }
      else if (r.status === 'pending' && r.addressee_id === user.id) { inc.push({ ...r, profile: prof }) }
      else if (r.status === 'pending' && r.requester_id === user.id) { out.push({ ...r, profile: prof }) }
    }

    setFriends(accepted)
    setIncoming(inc)
    setOutgoing(out)
    setLoading(false)
  }, [user])

  useEffect(() => { reload() }, [reload])

  // ── Search users by username ──────────────────────────────────────────────
  useEffect(() => {
    if (!search.trim() || !user) { setSearchRes([]); return }
    const id = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${search.trim()}%`)
        .neq('id', user.id)
        .limit(12)
      setSearchRes((data ?? []) as FriendProfile[])
      setSearching(false)
    }, 350)
    return () => clearTimeout(id)
  }, [search, user])

  // ── Friend actions ────────────────────────────────────────────────────────
  const getStatus = (id: string) => {
    if (incoming.some(f => f.profile.id === id)) return 'incoming'
    if (outgoing.some(f => f.profile.id === id)) return 'outgoing'
    if (friends.some(f => f.id === id)) return 'friends'
    return 'none'
  }

  const sendReq = async (addresseeId: string) => {
    if (!user) return
    setActionId(addresseeId)
    await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: addresseeId, status: 'pending' })
    await reload(); setActionId(null)
  }

  const accept = async (fid: string) => {
    setActionId(fid)
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', fid)
    await reload(); setActionId(null)
  }

  const remove = async (fid: string) => {
    setActionId(fid)
    await supabase.from('friendships').delete().eq('id', fid)
    await reload(); setActionId(null)
  }

  const cancel = async (fid: string) => {
    setActionId(fid)
    await supabase.from('friendships').delete().eq('id', fid)
    await reload(); setActionId(null)
  }

  const removeFriend = async (friendId: string) => {
    if (!user) return
    setActionId(friendId)
    await supabase.from('friendships').delete().or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`
    )
    await reload(); setActionId(null)
  }

  const { accent, accentFg, fg, muted, bg, bgSecondary, border } = theme

  return (
    <div style={{ minHeight: '100vh', background: bg, paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ padding: '56px 20px 0', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate('/profile')} style={{ width: 36, height: 36, borderRadius: '50%', background: bgSecondary, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none"><path d="M8 2L2 8l6 6" stroke={muted} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: fg, margin: 0, lineHeight: 1.1 }}>Friends</h1>
          {!loading && <p style={{ fontSize: 12, color: muted, margin: 0 }}>{friends.length} friend{friends.length !== 1 ? 's' : ''}{incoming.length > 0 ? ` · ${incoming.length} pending` : ''}</p>}
        </div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Search bar */}
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke={muted} strokeWidth="1.5"/><path d="M21 21l-4-4" stroke={muted} strokeWidth="1.5" strokeLinecap="round"/></svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search readers by username…"
            style={{ width: '100%', padding: '11px 36px 11px 36px', background: bgSecondary, border: `1px solid ${border}`, borderRadius: 12, fontSize: 14, color: fg, outline: 'none', boxSizing: 'border-box' }}
          />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: muted, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>}
        </div>

        {/* Search results */}
        <AnimatePresence>
          {search.trim() && (
            <motion.div key="results" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {searching && <div style={{ fontSize: 13, color: muted, padding: '4px 0' }}>Searching…</div>}
              {!searching && searchRes.length === 0 && <div style={{ fontSize: 13, color: muted }}>No users found for "{search}"</div>}
              {!searching && searchRes.map(p => {
                const st = getStatus(p.id)
                const busy = actionId === p.id
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: bgSecondary, borderRadius: 12, border: `1px solid ${border}` }}>
                    <Avatar p={p} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: fg }}>@{p.username ?? 'unnamed'}</div>
                    </div>
                    {st === 'none' && <button disabled={busy} onClick={() => sendReq(p.id)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: accent, color: accentFg, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? '…' : 'Add'}</button>}
                    {st === 'outgoing' && <span style={{ fontSize: 12, color: muted }}>Sent ✓</span>}
                    {st === 'incoming' && <button disabled={busy} onClick={() => { const f = incoming.find(i => i.profile.id === p.id); if (f) accept(f.id) }} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: accent, color: accentFg, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{busy ? '…' : 'Accept'}</button>}
                    {st === 'friends' && <span style={{ fontSize: 12, color: muted }}>Friends ✓</span>}
                  </div>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Incoming requests */}
        {!search.trim() && incoming.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.9, textTransform: 'uppercase', color: muted, marginBottom: 10 }}>
              Requests ({incoming.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {incoming.map(f => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: bgSecondary, borderRadius: 12, border: `1px solid ${accent}30` }}>
                  <Avatar p={f.profile} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: fg }}>@{f.profile.username ?? 'unnamed'}</div>
                    <div style={{ fontSize: 11, color: muted }}>Wants to be friends</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button disabled={actionId === f.id} onClick={() => accept(f.id)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: accent, color: accentFg, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{actionId === f.id ? '…' : 'Accept'}</button>
                    <button disabled={actionId === f.id} onClick={() => remove(f.id)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${border}`, background: 'none', color: muted, fontSize: 12, cursor: 'pointer' }}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outgoing requests */}
        {!search.trim() && outgoing.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.9, textTransform: 'uppercase', color: muted, marginBottom: 10 }}>Sent</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {outgoing.map(f => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: bgSecondary, borderRadius: 12, border: `1px solid ${border}` }}>
                  <Avatar p={f.profile} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: fg }}>@{f.profile.username ?? 'unnamed'}</div>
                    <div style={{ fontSize: 11, color: muted }}>Pending…</div>
                  </div>
                  <button disabled={actionId === f.id} onClick={() => cancel(f.id)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${border}`, background: 'none', color: muted, fontSize: 12, cursor: 'pointer' }}>{actionId === f.id ? '…' : 'Cancel'}</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends list */}
        {!search.trim() && (
          <div>
            {friends.length > 0 ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.9, textTransform: 'uppercase', color: muted, marginBottom: 10 }}>Your Friends</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {friends.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: bgSecondary, borderRadius: 12, border: `1px solid ${border}` }}>
                      <button onClick={() => navigate(`/profile/${p.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                        <Avatar p={p} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: fg }}>@{p.username ?? 'unnamed'}</div>
                          <div style={{ fontSize: 11, color: muted }}>View profile →</div>
                        </div>
                      </button>
                      <button disabled={actionId === p.id} onClick={() => removeFriend(p.id)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${border}`, background: 'none', color: muted, fontSize: 12, cursor: 'pointer' }}>{actionId === p.id ? '…' : 'Remove'}</button>
                    </div>
                  ))}
                </div>
              </>
            ) : !loading && incoming.length === 0 && outgoing.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: muted }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>👥</div>
                <div style={{ fontSize: 15, color: fg, marginBottom: 6 }}>No friends yet</div>
                <div style={{ fontSize: 13 }}>Search for readers above to add them as friends.</div>
              </div>
            )}
          </div>
        )}
      </div>

      <TabBar activeTab="profile" onTabChange={t => navigate(`/${t === 'home' ? 'home' : t}`)} theme={theme} />
    </div>
  )
}
