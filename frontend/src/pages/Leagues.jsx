import { useState, useEffect, useLayoutEffect, useCallback } from 'react'
import { api } from '../api'
import { usePageLoading } from '../components/PageLoadingContext'

// ---------------------------------------------------------------------------
// Small shared primitives
// ---------------------------------------------------------------------------

function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-jet-dark border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">{title}</h2>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2 mt-3">
      {message}
    </p>
  )
}

function Badge({ children, colour = 'teal' }) {
  const colours = {
    teal:   'bg-teal/15 border-teal/30 text-teal',
    red:    'bg-red-400/15 border-red-400/30 text-red-400',
    yellow: 'bg-yellow-400/15 border-yellow-400/30 text-yellow-400',
    muted:  'bg-white/5 border-white/10 text-white/50',
  }
  return (
    <span className={`inline-flex items-center border text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider ${colours[colour]}`}>
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Rank medal colours for top 3
// ---------------------------------------------------------------------------

function rankLabel(rank) {
  if (rank === 1) return { symbol: '🥇', cls: 'text-yellow-400' }
  if (rank === 2) return { symbol: '🥈', cls: 'text-white/60' }
  if (rank === 3) return { symbol: '🥉', cls: 'text-amber-600' }
  return { symbol: String(rank), cls: 'text-white/40' }
}

// ---------------------------------------------------------------------------
// Create league modal
// ---------------------------------------------------------------------------

function CreateLeagueModal({ season, onClose, onCreate }) {
  const [name, setName]     = useState('')
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('League name is required'); return }
    setBusy(true)
    setError('')
    try {
      const league = await api.post('/api/leagues/', { name: trimmed, season })
      onCreate(league)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Create a league" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-white/60 text-xs block mb-1.5">League name</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. The Office Draft"
            maxLength={40}
            className="w-full bg-jet border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal/50 transition-colors"
          />
        </div>
        <div className="bg-jet rounded-xl px-4 py-2.5 flex items-center justify-between">
          <span className="text-white/40 text-xs">Season</span>
          <span className="text-white text-xs font-mono">{season}</span>
        </div>
        <ErrorBanner message={error} />
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-teal text-white font-semibold text-sm py-2.5 rounded-xl hover:bg-jet transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-2"
        >
          {busy ? 'Creating…' : 'Create league'}
        </button>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Join league modal
// ---------------------------------------------------------------------------

function JoinLeagueModal({ onClose, onJoin }) {
  const [code, setCode]   = useState('')
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) { setError('Invite code is required'); return }
    setBusy(true)
    setError('')
    try {
      const league = await api.post('/api/leagues/join', { code: trimmed })
      onJoin(league)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Join a league" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-white/60 text-xs block mb-1.5">Invite code</label>
          <input
            autoFocus
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. X7K2PQ"
            maxLength={6}
            className="w-full bg-jet border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm font-mono tracking-widest placeholder-white/20 focus:outline-none focus:border-teal/50 transition-colors uppercase"
          />
        </div>
        <ErrorBanner message={error} />
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-teal text-white font-semibold text-sm py-2.5 rounded-xl hover:bg-jet transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-2"
        >
          {busy ? 'Joining…' : 'Join league'}
        </button>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Transfer ownership modal
// ---------------------------------------------------------------------------

function TransferOwnershipModal({ members, currentUserId, leagueId, onClose, onTransferred }) {
  const [targetId, setTargetId] = useState('')
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState('')

  const candidates = members.filter(m => m.user_id !== currentUserId)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!targetId) { setError('Select a member to transfer to'); return }
    setBusy(true)
    setError('')
    try {
      await api.post(`/api/leagues/${leagueId}/transfer-ownership`, { new_owner_id: Number(targetId) })
      onTransferred()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Transfer ownership" onClose={onClose}>
      <p className="text-white/40 text-xs mb-4">
        You will become a regular member. This cannot be undone without the new owner's agreement.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-white/60 text-xs block mb-1.5">New owner</label>
          <select
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            className="w-full bg-jet border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal/50 transition-colors"
          >
            <option value="">Select a member…</option>
            {candidates.map(m => (
              <option key={m.user_id} value={m.user_id}>{m.name}</option>
            ))}
          </select>
        </div>
        <ErrorBanner message={error} />
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-teal text-white font-semibold text-sm py-2.5 rounded-xl hover:bg-jet transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? 'Transferring…' : 'Transfer ownership'}
        </button>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// League detail view
// ---------------------------------------------------------------------------

function LeagueDetail({ leagueId, currentUserId, onBack, onDeleted }) {
  const [league, setLeague]           = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [actionError, setActionError] = useState('')
  const [modal, setModal]             = useState(null) // 'transfer' | 'confirm-leave' | 'confirm-delete' | 'confirm-kick'
  const [kickTarget, setKickTarget]   = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/api/leagues/${leagueId}`)
      setLeague(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [leagueId])

  useEffect(() => { load() }, [load])

  const myMembership = league?.members.find(m => m.user_id === currentUserId)
  const isOwner      = myMembership?.role === 'owner'
  const memberCount  = league?.members.length ?? 0

  async function handleLeave() {
    setActionError('')
    try {
      await api.delete(`/api/leagues/${leagueId}/leave`)
      onBack(true)
    } catch (err) {
      setActionError(err.message)
      setModal(null)
    }
  }

  async function handleDelete() {
    setActionError('')
    try {
      await api.delete(`/api/leagues/${leagueId}`)
      onDeleted(leagueId)
    } catch (err) {
      setActionError(err.message)
      setModal(null)
    }
  }

  async function handleKick() {
    setActionError('')
    try {
      await api.delete(`/api/leagues/${leagueId}/members/${kickTarget.user_id}`)
      setModal(null)
      setKickTarget(null)
      await load()
    } catch (err) {
      setActionError(err.message)
      setModal(null)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-white/30 text-sm">Loading…</span>
      </div>
    )
  }

  if (error || !league) {
    return (
      <div className="max-w-2xl mx-auto w-full px-4 py-6">
        <button onClick={() => onBack(false)} className="text-teal-muted text-sm hover:text-white transition-colors mb-4">
          ← Back to leagues
        </button>
        <p className="text-red-400 text-sm">{error || 'League not found.'}</p>
      </div>
    )
  }

  // Ranked list — sort is applied server-side after kick-off; before that, members
  // arrive in join order, which is fine.
  const ranked = league.members.map((m, i) => ({
    ...m,
    displayRank: league.kicked_off && m.current_points != null ? i + 1 : null,
  }))

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6">

      {/* back */}
      <button
        onClick={() => onBack(false)}
        className="text-teal-muted text-sm hover:text-white transition-colors mb-5 flex items-center gap-1"
      >
        ← Back to leagues
      </button>

      {/* header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold leading-tight break-all">{league.name}</h1>
          <p className="text-teal-muted text-xs mt-1">{league.season} · {memberCount} member{memberCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {league.kicked_off
            ? <Badge colour="red">Season live</Badge>
            : <Badge colour="teal">Predictions open</Badge>
          }
          {isOwner && <Badge colour="yellow">Owner</Badge>}
        </div>
      </div>

      {/* invite code card */}
      {!league.kicked_off && (
        <div className="bg-jet-dark rounded-2xl p-4 mb-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-white/40 text-xs mb-1">Invite code</p>
            <p className="text-white font-mono text-2xl font-bold tracking-widest">{league.code}</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(league.code)
            }}
            className="text-teal text-xs border border-teal/30 px-4 py-2 rounded-xl hover:bg-teal/10 transition-colors"
          >
            Copy code
          </button>
        </div>
      )}

      {/* pre-season note */}
      {!league.kicked_off && (
        <div className="bg-teal/10 border border-teal/20 rounded-2xl px-4 py-3 mb-4">
          <p className="text-teal text-xs">
            Predictions and scores are hidden until the season kicks off. The leaderboard will appear once the first match has been played.
          </p>
        </div>
      )}

      {/* leaderboard */}
      <div className="bg-jet-dark rounded-2xl p-4 mb-4">
        <p className="text-teal-muted text-xs uppercase tracking-widest mb-3">Leaderboard</p>
        <div className="space-y-2">
          {ranked.map((member, idx) => {
            const rank   = member.displayRank ?? idx + 1
            const { symbol, cls } = rankLabel(rank)
            const isMe   = member.user_id === currentUserId

            return (
              <div
                key={member.user_id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${isMe ? 'bg-teal/10 border border-teal/20' : 'bg-jet'}`}
              >
                {/* rank */}
                <span className={`font-mono text-sm w-6 text-center shrink-0 ${cls}`}>
                  {symbol}
                </span>

                {/* name */}
                <span className="text-white text-sm flex-1 truncate">
                  {member.name}
                  {isMe && <span className="text-teal-muted text-xs ml-1.5">(you)</span>}
                  {member.role === 'owner' && (
                    <span className="text-yellow-400/60 text-[10px] uppercase tracking-wider ml-1.5">owner</span>
                  )}
                </span>

                {/* prediction status / score */}
                {league.kicked_off ? (
                  member.current_points != null
                    ? <span className="text-white font-mono text-sm font-bold shrink-0">{member.current_points} pts</span>
                    : <span className="text-white/30 text-xs shrink-0 italic">No prediction</span>
                ) : (
                  member.has_prediction
                    ? <Badge colour="teal">Predicted</Badge>
                    : <Badge colour="muted">Not yet</Badge>
                )}

                {/* owner kick button */}
                {isOwner && !isMe && (
                  <button
                    onClick={() => { setKickTarget(member); setModal('confirm-kick') }}
                    className="text-white/20 hover:text-red-400 transition-colors text-xs ml-1 shrink-0"
                    aria-label={`Remove ${member.name}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* action error */}
      {actionError && <ErrorBanner message={actionError} />}

      {/* owner actions */}
      {isOwner && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setModal('transfer')}
            className="text-white/60 text-xs border border-white/10 px-4 py-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            Transfer ownership
          </button>
          <button
            onClick={() => setModal('confirm-delete')}
            className="text-red-400 text-xs border border-red-400/20 px-4 py-2 rounded-xl hover:bg-red-400/10 transition-colors"
          >
            Delete league
          </button>
        </div>
      )}

      {/* member leave */}
      {!isOwner && (
        <div className="mt-4">
          <button
            onClick={() => setModal('confirm-leave')}
            className="text-red-400 text-xs border border-red-400/20 px-4 py-2 rounded-xl hover:bg-red-400/10 transition-colors"
          >
            Leave league
          </button>
        </div>
      )}

      {/* owner leave note */}
      {isOwner && memberCount > 1 && (
        <p className="text-white/20 text-xs mt-3">
          Transfer ownership before leaving, or delete the league.
        </p>
      )}

      {/* ── modals ── */}
      {modal === 'transfer' && (
        <TransferOwnershipModal
          members={league.members}
          currentUserId={currentUserId}
          leagueId={leagueId}
          onClose={() => setModal(null)}
          onTransferred={() => { setModal(null); load() }}
        />
      )}

      {modal === 'confirm-leave' && (
        <Modal title="Leave league?" onClose={() => setModal(null)}>
          <p className="text-white/50 text-sm mb-5">You will no longer appear in this league's leaderboard.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setModal(null)}
              className="flex-1 text-white/60 text-sm border border-white/10 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLeave}
              className="flex-1 bg-red-500 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-red-600 transition-colors"
            >
              Leave
            </button>
          </div>
        </Modal>
      )}

      {modal === 'confirm-delete' && (
        <Modal title="Delete league?" onClose={() => setModal(null)}>
          <p className="text-white/50 text-sm mb-5">
            This will permanently remove <strong className="text-white">{league.name}</strong> and all its members. There's no undo.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setModal(null)}
              className="flex-1 text-white/60 text-sm border border-white/10 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 bg-red-500 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}

      {modal === 'confirm-kick' && kickTarget && (
        <Modal title={`Remove ${kickTarget.name}?`} onClose={() => { setModal(null); setKickTarget(null) }}>
          <p className="text-white/50 text-sm mb-5">
            They will be removed from the league immediately.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { setModal(null); setKickTarget(null) }}
              className="flex-1 text-white/60 text-sm border border-white/10 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleKick}
              className="flex-1 bg-red-500 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-red-600 transition-colors"
            >
              Remove
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// League list (main view)
// ---------------------------------------------------------------------------

function LeagueList({ leagues, season, onSelect, onCreated, onJoined }) {
  const [modal, setModal] = useState(null) // 'create' | 'join'

  // Build the ordered list of seasons present in the user's leagues, always
  // putting the current season first even if the user has no leagues in it yet.
  const availableSeasons = Array.from(
    new Set([season, ...leagues.map(l => l.season)].filter(Boolean))
  ).sort((a, b) => {
    const yr = s => parseInt(s?.split('-')[0] ?? '0', 10)
    return yr(b) - yr(a)
  })

  const [filterSeason, setFilterSeason] = useState(season)

  // Keep the filter on the current season when the page first loads and season arrives.
  const isPastSeason = filterSeason && filterSeason !== season

  const visibleLeagues = filterSeason
    ? leagues.filter(l => l.season === filterSeason)
    : leagues

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="text-white text-2xl font-bold leading-tight">Leagues</h1>
          <p className="text-teal-muted text-xs mt-1">Compete with friends across the {season} season</p>
        </div>
        <div className="flex gap-2">
          {!isPastSeason && (
            <button
              onClick={() => setModal('join')}
              className="text-white/70 text-sm border border-white/10 px-4 py-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              Join
            </button>
          )}
          <button
            onClick={() => setModal('create')}
            className="bg-teal text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-jet transition-colors"
          >
            Create
          </button>
        </div>
      </div>

      {/* Season filter — only shown when the user has leagues spanning multiple seasons */}
      {availableSeasons.length > 1 && (
        <div className="mb-5">
          <select
            value={filterSeason}
            onChange={e => setFilterSeason(e.target.value)}
            className="bg-jet border border-white/10 rounded-xl px-4 py-2 text-white text-xs focus:outline-none focus:border-teal/50 transition-colors"
          >
            {availableSeasons.map(s => (
              <option key={s} value={s}>
                {s}{s === season ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {isPastSeason && (
        <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 mb-4">
          <p className="text-white/40 text-xs">
            Leagues from the {filterSeason} season are view-only. You can still manage, leave, or delete them, but new members can't join.
          </p>
        </div>
      )}

      {visibleLeagues.length === 0 ? (
        <div className="bg-jet-dark rounded-2xl p-10 text-center">
          <p className="text-white/40 text-sm mb-1">No leagues for this season yet.</p>
          <p className="text-white/20 text-xs">Create one or ask a friend for their invite code.</p>
          {!isPastSeason && (
            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={() => setModal('join')}
                className="text-white/60 text-sm border border-white/10 px-5 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
              >
                Join with a code
              </button>
              <button
                onClick={() => setModal('create')}
                className="bg-teal text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-jet transition-colors"
              >
                Create a league
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleLeagues.map(league => (
            <button
              key={league.id}
              onClick={() => onSelect(league.id)}
              className="w-full bg-jet-dark hover:bg-jet rounded-2xl p-4 text-left transition-colors group"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{league.name}</p>
                  <p className="text-white/40 text-xs mt-0.5">{league.season} · {league.member_count} member{league.member_count !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {league.season !== season && <Badge colour="muted">Past season</Badge>}
                  {league.role === 'owner' && <Badge colour="yellow">Owner</Badge>}
                  <span className="text-white/20 group-hover:text-white/50 transition-colors text-sm">→</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {modal === 'create' && season && (
        <CreateLeagueModal
          season={season}
          onClose={() => setModal(null)}
          onCreate={league => { setModal(null); onCreated(league) }}
        />
      )}

      {modal === 'join' && (
        <JoinLeagueModal
          onClose={() => setModal(null)}
          onJoin={league => { setModal(null); onJoined(league) }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

export default function Leagues() {
  const { setPageLoading } = usePageLoading()
  const [leagues, setLeagues]       = useState([])
  const [season, setSeason]         = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [pageState, setPageState]   = useState('loading') // 'loading' | 'list' | 'detail' | 'error'

  useLayoutEffect(() => {
    setPageLoading(true)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const [{ season: s }, leagueList, me] = await Promise.all([
          api.get('/api/standings/current-season'),
          api.get('/api/leagues/'),
          api.get('/api/auth/me'),
        ])
        setSeason(s)
        setLeagues(leagueList)
        setCurrentUserId(me.id)
        setPageState('list')
      } catch (err) {
        console.error(err)
        setPageState('error')
      } finally {
        setPageLoading(false)
      }
    }
    load()
  }, [setPageLoading])

  function handleCreated(league) {
    // Optimistically add and open the new league
    setLeagues(prev => [...prev, { ...league, role: 'owner', member_count: 1 }])
    setSelectedId(league.id)
    setPageState('detail')
  }

  function handleJoined(league) {
    setLeagues(prev => [...prev, { ...league, role: 'member', member_count: 1 }])
    setSelectedId(league.id)
    setPageState('detail')
  }

  function handleBack(refetch = false) {
    setSelectedId(null)
    setPageState('list')
    if (refetch) {
      // User left a league — refresh the list
      api.get('/api/leagues/').then(setLeagues).catch(() => {})
    }
  }

  function handleDeleted(leagueId) {
    setLeagues(prev => prev.filter(l => l.id !== leagueId))
    setSelectedId(null)
    setPageState('list')
  }

  if (pageState === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-white/30 text-sm">Loading…</span>
      </div>
    )
  }

  if (pageState === 'error') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-red-400 text-sm">Something went wrong. Try refreshing.</p>
      </div>
    )
  }

  if (pageState === 'detail' && selectedId != null) {
    return (
      <LeagueDetail
        leagueId={selectedId}
        currentUserId={currentUserId}
        onBack={handleBack}
        onDeleted={handleDeleted}
      />
    )
  }

  return (
    <LeagueList
      leagues={leagues}
      season={season}
      onSelect={id => { setSelectedId(id); setPageState('detail') }}
      onCreated={handleCreated}
      onJoined={handleJoined}
    />
  )
}
