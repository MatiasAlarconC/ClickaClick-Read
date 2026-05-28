import React, { useEffect, useState, useCallback } from 'react'
import { TabBar, Spinner } from '../components/UI'
import { useAuth, useTheme } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

interface Profile {
  id: string
  username: string | null
  avatar_url: string | null
}

type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted'

interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: string
}

export default function SocialScreen() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)

  const [friends, setFriends] = useState<Profile[]>([])
  const [incoming, setIncoming] = useState<(Friendship & { profile: Profile })[]>([])
  const [outgoing, setOutgoing] = useState<(Friendship & { profile: Profile })[]>([])
  const [loadingFriends, setLoadingFriends] = useState(true)

  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // ── Load friendships ──────────────────────────────────────────────────────
  const loadFriendships = useCallback(async () => {
    if (!user) return
    setLoadingFriends(true)
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    if (!data) { setLoadingFriends(false); return }

    const otherIds = data.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id)
    const { data: profiles } = otherIds.length
      ? await supabase.from('profiles').select('id, username, avatar_url').in('id', otherIds)
      : { data: [] }

    const profileMap: Record<string, Profile> = {}
    for (const p of profiles ?? []) profileMap[p.id] = p

    const accepted: Profile[] = []
    const inc: (Friendship & { profile: Profile })[] = []
    const out: (Friendship & { profile: Profile })[] = []

    for (const f of data) {
      const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id
      const profile = profileMap[otherId] ?? { id: otherId, username: 'Unknown', avatar_url: null }
      if (f.status === 'accepted') {
        accepted.push(profile)
      } else if (f.status === 'pending') {
        if (f.addressee_id === user.id) inc.push({ ...f, profile })
        else out.push({ ...f, profile })
      }
    }
    setFriends(accepted)
    setIncoming(inc)
    setOutgoing(out)
    setLoadingFriends(false)
  }, [user])

  useEffect(() => { loadFriendships() }, [loadFriendships])

  // ── Search users ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim() || !user) { setSearchResults([]); return }
    const timeout = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${searchQuery.trim()}%`)
        .neq('id', user.id)
        .limit(15)
      setSearchResults((data ?? []) as Profile[])
      setSearching(false)
    }, 400)
    return () => clearTimeout(timeout)
  }, [searchQuery, user])

  // ── Friendship actions ────────────────────────────────────────────────────
  const getFriendStatus = (profileId: string): FriendStatus => {
    for (const f of incoming) if (f.profile.id === profileId) return 'pending_received'
    for (const f of outgoing) if (f.profile.id === profileId) return 'pending_sent'
    for (const f of friends) if (f.id === profileId) return 'accepted'
    return 'none'
  }

  const sendRequest = async (addresseeId: string) => {
    if (!user) return
    setActionLoading(addresseeId)
    await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: addresseeId, status: 'pending' })
    await loadFriendships()
    setActionLoading(null)
  }

  const acceptRequest = async (friendshipId: string) => {
    setActionLoading(friendshipId)
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
    await loadFriendships()
    setActionLoading(null)
  }

  const declineRequest = async (friendshipId: string) => {
    setActionLoading(friendshipId)
    await supabase.from('friendships').delete().eq('id', friendshipId)
    await loadFriendships()
    setActionLoading(null)
  }

  const removeFriend = async (friendId: string) => {
    if (!user) return
    setActionLoading(friendId)
    await supabase.from('friendships').delete().or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`
    )
    await loadFriendships()
    setActionLoading(null)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const avatar = (p: Profile, size = 42) => (
    <div style={{ width: size, height: size, borderRadius: '50%', background: theme.bgSecondary, border: `1px solid ${theme.border}`, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, color: theme.muted }}>
      {p.avatar_url
        ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
        : (p.username?.[0] ?? '?').toUpperCase()
      }
    </div>
  )

  const btn = (label: string, onClick: () => void, accent = false, loading = false) => (
    <button onClick={onClick} disabled={loading} style={{ padding: '7px 14px', borderRadius: 8, border: accent ? 'none' : `1px solid ${theme.border}`, background: accent ? theme.accent : 'none', color: accent ? theme.accentFg : theme.muted, fontSize: 12, fontWeight: 500, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1, flexShrink: 0 }}>
      {loading ? '…' : label}
    </button>
  )

  const showSearchPane = searchQuery.trim().length > 0

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, paddingBottom: 90 }}>
      {/* Header */}
      <div style={{ padding: '56px 22px 16px', borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: theme.fg, letterSpacing: -0.5, marginBottom: 14 }}>Friends</div>
        {/* Search bar */}
        <div style={{ position: 'relative' }}>
          <svg width="16" height="16" viewBox="0 0 22 22" fill="none" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="10" cy="10" r="6.5" stroke={theme.muted} strokeWidth="1.5"/>
            <line x1="15" y1="15" x2="20" y2="20" stroke={theme.muted} strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by username…"
            style={{ width: '100%', padding: '10px 14px 10px 36px', background: theme.bgSecondary, border: `1px solid ${theme.border}`, borderRadius: 12, fontSize: 14, color: theme.fg, outline: 'none', boxSizing: 'border-box' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: theme.muted, fontSize: 18, lineHeight: 1, cursor: 'pointer' }}>×</button>
          )}
        </div>
      </div>

      <div style={{ padding: '0 22px' }}>
        {/* ── Search results ── */}
        {showSearchPane && (
          <div style={{ marginTop: 20 }}>
            {searching
              ? <div style={{ textAlign: 'center', padding: 24 }}><Spinner color={theme.muted}/></div>
              : searchResults.length === 0
              ? <div style={{ textAlign: 'center', padding: 24, color: theme.muted, fontSize: 13 }}>No users found for "{searchQuery}"</div>
              : searchResults.map(p => {
                  const status = getFriendStatus(p.id)
                  const loading = actionLoading === p.id
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${theme.border}` }}>
                      {avatar(p)}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: theme.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{p.username ?? 'unnamed'}</div>
                      </div>
                      {status === 'none' && btn('Add Friend', () => sendRequest(p.id), true, loading)}
                      {status === 'pending_sent' && btn('Sent ✓', () => {}, false, false)}
                      {status === 'pending_received' && btn('Accept', () => {
                        const f = incoming.find(i => i.profile.id === p.id)
                        if (f) acceptRequest(f.id)
                      }, true, loading)}
                      {status === 'accepted' && btn('Friends ✓', () => {}, false, false)}
                    </div>
                  )
                })
            }
          </div>
        )}

        {/* ── Friend list pane (shown when not searching) ── */}
        {!showSearchPane && (
          <>
            {/* Incoming requests */}
            {incoming.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 12 }}>Friend Requests ({incoming.length})</div>
                {incoming.map(f => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${theme.border}` }}>
                    {avatar(f.profile)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: theme.fg }}>@{f.profile.username ?? 'unnamed'}</div>
                      <div style={{ fontSize: 11, color: theme.muted }}>Wants to be your friend</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {btn('Accept', () => acceptRequest(f.id), true, actionLoading === f.id)}
                      {btn('Decline', () => declineRequest(f.id), false, actionLoading === f.id)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Outgoing pending */}
            {outgoing.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 12 }}>Sent Requests</div>
                {outgoing.map(f => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${theme.border}` }}>
                    {avatar(f.profile)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: theme.fg }}>@{f.profile.username ?? 'unnamed'}</div>
                      <div style={{ fontSize: 11, color: theme.muted }}>Request pending…</div>
                    </div>
                    {btn('Cancel', () => declineRequest(f.id), false, actionLoading === f.id)}
                  </div>
                ))}
              </div>
            )}

            {/* Friends */}
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 12 }}>
                {friends.length > 0 ? `Friends (${friends.length})` : 'Friends'}
              </div>
              {loadingFriends
                ? <div style={{ textAlign: 'center', padding: 24 }}><Spinner color={theme.muted}/></div>
                : friends.length === 0
                ? <div style={{ padding: '32px 0', textAlign: 'center', color: theme.muted, fontSize: 13 }}>
                    No friends yet — search for users above to get started.
                  </div>
                : friends.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${theme.border}` }}>
                    {avatar(p)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: theme.fg }}>@{p.username ?? 'unnamed'}</div>
                    </div>
                    {btn('Remove', () => removeFriend(p.id), false, actionLoading === p.id)}
                  </div>
                ))
              }
            </div>
          </>
        )}
      </div>

      <TabBar activeTab="social" onTabChange={t => navigate(`/${t}`)} theme={theme}/>
    </div>
  )
}
