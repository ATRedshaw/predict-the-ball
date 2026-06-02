import { useState, useEffect, useLayoutEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
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
// Member prediction view (with inline stats + history)
// ---------------------------------------------------------------------------

function MemberPredictionView({ member, season, kickedOff, currentUserId, onBack }) {
  const [prediction, setPrediction] = useState(null)
  const [actualStandings, setActual] = useState(null)
  const [profile, setProfile]       = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  const isMe = member.user_id === currentUserId

  useEffect(() => {
    async function load() {
      try {
        const predPromise = isMe
          ? api.get(`/api/predictions/${season}`)
          : api.get(`/api/predictions/${season}/user/${member.user_id}`)

        const actualPromise = kickedOff
          ? api.get(`/api/standings/${season}/actual/latest`)
          : Promise.resolve(null)

        const profilePromise = api.get(`/api/users/${member.user_id}/profile`)

        const [pred, actual, prof] = await Promise.all([predPromise, actualPromise, profilePromise])
        setPrediction(pred)
        setActual(actual)
        setProfile(prof)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [member.user_id, season, kickedOff, isMe])

  // Build a lookup from team name → actual position
  const actualPositionOf = {}
  if (actualStandings?.standings) {
    for (const row of actualStandings.standings) {
      actualPositionOf[row.team] = row.position
    }
  }

  // Stats for the season currently being viewed (may be a past season).
  const viewedSeasonStats = profile
    ? (profile.current_season?.season === season
        ? profile.current_season
        : profile.history?.find(h => h.season === season) ?? null)
    : null

  // All seasons combined, newest first.
  const allSeasons = [
    ...(profile?.current_season ? [profile.current_season] : []),
    ...(profile?.history ?? []),
  ].sort((a, b) => b.season.localeCompare(a.season))

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6">
      <button
        onClick={onBack}
        className="text-teal-muted text-sm hover:text-white transition-colors mb-5 flex items-center gap-1"
      >
        ← Back to league
      </button>

      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold leading-tight">
          {member.name}{isMe ? <span className="text-teal-muted text-base font-normal ml-2">(you)</span> : ''}
        </h1>
        <p className="text-teal-muted text-xs mt-1">{season} predictions</p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <span className="text-white/30 text-sm">Loading…</span>
        </div>
      ) : error ? (
        <div className="bg-red-400/10 border border-red-400/20 rounded-2xl px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      ) : (
        <>
          {/* Season stats header */}
          {kickedOff && viewedSeasonStats && (
            <div className="bg-jet-dark rounded-2xl p-4 mb-4">
              <p className="text-teal-muted text-xs uppercase tracking-widest mb-3">{season}</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-jet rounded-xl px-4 py-3">
                  <p className="text-white/40 text-xs mb-1">Score</p>
                  <p className="text-white font-mono font-bold text-lg">
                    {viewedSeasonStats.score != null ? `${viewedSeasonStats.score} pts` : '—'}
                  </p>
                </div>
                <div className="bg-jet rounded-xl px-4 py-3">
                  <p className="text-white/40 text-xs mb-1">Exact</p>
                  <p className="text-white font-mono font-bold text-lg">
                    {viewedSeasonStats.exact_predictions != null ? viewedSeasonStats.exact_predictions : '—'}
                  </p>
                </div>
                <div className="bg-jet rounded-xl px-4 py-3">
                  <p className="text-white/40 text-xs mb-1">Global rank</p>
                  <p className="text-white font-mono font-bold text-lg">
                    {viewedSeasonStats.global_rank ? `#${viewedSeasonStats.global_rank.rank}` : '—'}
                  </p>
                  {viewedSeasonStats.global_rank && (
                    <p className="text-white/30 text-xs">of {viewedSeasonStats.global_rank.total}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {!kickedOff && isMe && (
            <div className="bg-teal/10 border border-teal/20 rounded-2xl px-4 py-3 mb-4">
              <p className="text-teal text-xs">
                The season hasn't started yet. Actual positions and deltas will appear once the first match is played.
              </p>
            </div>
          )}

          {!prediction ? (
            <div className="bg-jet-dark rounded-2xl p-10 text-center">
              <p className="text-white/40 text-sm">No prediction submitted.</p>
            </div>
          ) : (
            <>
              <div className="bg-jet-dark rounded-2xl p-4">
                <div className="grid grid-cols-[2rem_1fr_3rem_3rem] gap-x-3 px-3 pb-2 mb-1">
                  <span className="text-white/30 text-[10px] uppercase tracking-widest text-center">#</span>
                  <span className="text-white/30 text-[10px] uppercase tracking-widest">Team</span>
                  {kickedOff && <span className="text-white/30 text-[10px] uppercase tracking-widest text-center">Act.</span>}
                  {kickedOff && <span className="text-white/30 text-[10px] uppercase tracking-widest text-center">Δ</span>}
                </div>
                <div className="space-y-1">
                  {prediction.standings.map((team, i) => {
                    const predictedPos = i + 1
                    const actualPos    = actualPositionOf[team] ?? null
                    const delta        = actualPos != null ? actualPos - predictedPos : null

                    return (
                      <div
                        key={team}
                        className="grid grid-cols-[2rem_1fr_3rem_3rem] gap-x-3 items-center rounded-xl px-3 py-2 bg-jet"
                      >
                        <span className="text-white/40 font-mono text-xs text-center">{predictedPos}</span>
                        <span className="text-white text-sm truncate">{team}</span>
                        {kickedOff && (
                          <span className="text-white/50 font-mono text-xs text-center">
                            {actualPos ?? '—'}
                          </span>
                        )}
                        {kickedOff && (
                          <span className={`font-mono text-xs text-center ${
                            delta === null ? 'text-white/30'
                            : delta === 0  ? 'text-teal'
                            : delta < 0   ? 'text-green-400'
                            : 'text-red-400'
                          }`}>
                            {delta === null ? '—' : delta === 0 ? '✓' : delta > 0 ? `+${delta}` : delta}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {kickedOff && (
                <p className="text-white/20 text-xs mt-3 text-center">
                  Δ = actual − predicted position. Negative means the team finished higher than predicted.
                </p>
              )}
            </>
          )}

          {/* All seasons */}
          {allSeasons.length > 0 && (
            <div className="bg-jet-dark rounded-2xl p-4 mt-4">
              <p className="text-teal-muted text-xs uppercase tracking-widest mb-3">All seasons</p>
              <div className="space-y-2">
                {allSeasons.map(h => (
                  <div
                    key={h.season}
                    className={`rounded-xl px-4 py-3 flex items-center justify-between ${
                      h.season === season ? 'bg-teal/10 border border-teal/20' : 'bg-jet'
                    }`}
                  >
                    <span className={`text-sm font-mono ${
                      h.season === season ? 'text-white' : 'text-white/60'
                    }`}>
                      {h.season}
                    </span>
                    <div className="flex items-center gap-3">
                      {h.global_rank && (
                        <span className="text-white/40 text-xs font-mono">
                          #{h.global_rank.rank}
                          <span className="text-white/20">/{h.global_rank.total}</span>
                        </span>
                      )}
                      <span className="text-white font-mono text-sm font-bold">
                        {h.score != null ? `${h.score} pts` : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// League detail view
// ---------------------------------------------------------------------------

function LeagueDetail({ leagueId, currentUserId, currentSeason, onBack, onDeleted }) {
  const [league, setLeague]           = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [actionError, setActionError] = useState('')
  const [modal, setModal]             = useState(null) // 'transfer' | 'confirm-leave' | 'confirm-delete' | 'confirm-kick'
  const [kickTarget, setKickTarget]   = useState(null)
  const [viewingMember, setViewingMember]   = useState(null)

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

  const myMembership  = league?.members.find(m => m.user_id === currentUserId)
  const isOwner       = myMembership?.role === 'owner'
  const memberCount   = league?.members.length ?? 0
  const isPastSeason  = league && currentSeason && league.season !== currentSeason

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

  // Build tie-aware rank map from the server-sorted member list.
  // Two players with identical points AND exact predictions share the same rank.
  const rankMap = (() => {
    const map = new Map()
    if (!league.kicked_off) return map
    const scored = league.members.filter(m => m.current_points != null)
    let rank = 1
    for (let i = 0; i < scored.length; i++) {
      if (i > 0) {
        const prev = scored[i - 1]
        const curr = scored[i]
        if (curr.current_points !== prev.current_points || curr.exact_predictions !== prev.exact_predictions) {
          rank = i + 1
        }
      }
      map.set(scored[i].user_id, rank)
    }
    return map
  })()

  const ranked = league.members.map(m => ({
    ...m,
    displayRank: rankMap.get(m.user_id) ?? null,
  }))

  if (viewingMember) {
    return (
      <MemberPredictionView
        member={viewingMember}
        season={league.season}
        kickedOff={league.kicked_off}
        currentUserId={currentUserId}
        onBack={() => setViewingMember(null)}
      />
    )
  }

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
          {isPastSeason
            ? <Badge colour="muted">Season ended</Badge>
            : league.kicked_off
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
            const isMe      = member.user_id === currentUserId
            const canView   = league.kicked_off || isMe

            return (
              <div
                key={member.user_id}
                onClick={canView ? () => setViewingMember(member) : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${isMe ? 'bg-teal/10 border border-teal/20' : 'bg-jet'} ${canView ? 'cursor-pointer hover:brightness-125 transition-[filter]' : ''}`}
              >
                {/* rank */}
                <span className={`font-mono text-sm w-6 text-center shrink-0 ${cls}`}>
                  {symbol}
                </span>

                {/* name + inline kick */}
                <span className="text-white text-sm flex-1 truncate flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{member.name}</span>
                  {isMe && <span className="text-teal-muted text-xs shrink-0">(you)</span>}
                  {member.role === 'owner' && (
                    <span className="text-yellow-400/60 text-[10px] uppercase tracking-wider shrink-0">owner</span>
                  )}
                  {isOwner && !isMe && !isPastSeason && (
                    <button
                      onClick={e => { e.stopPropagation(); setKickTarget(member); setModal('confirm-kick') }}
                      className="text-white/20 hover:text-red-400 transition-colors shrink-0 leading-none"
                      aria-label={`Remove ${member.name}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  )}
                </span>

                {/* prediction status / score */}
                {league.kicked_off ? (
                  member.current_points != null
                    ? (
                      <div className="text-right shrink-0">
                        <p className="text-white font-mono text-sm font-bold">{member.current_points} pts</p>
                        {member.exact_predictions != null && (
                          <p className="text-teal-muted font-mono text-[10px]">{member.exact_predictions} exact</p>
                        )}
                      </div>
                    )
                    : member.has_prediction
                      ? <span className="text-white/30 text-xs shrink-0 italic">Score pending</span>
                      : <span className="text-white/30 text-xs shrink-0 italic">No prediction</span>
                ) : (
                  member.has_prediction
                    ? <Badge colour="teal">Predicted</Badge>
                    : <Badge colour="muted">Not yet</Badge>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* action error */}
      {actionError && <ErrorBanner message={actionError} />}

      {/* owner actions — hidden for past-season leagues */}
      {isOwner && !isPastSeason && (
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

      {/* member leave — hidden for past-season leagues */}
      {!isOwner && !isPastSeason && (
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
      {isOwner && !isPastSeason && memberCount > 1 && (
        <p className="text-white/20 text-xs mt-3">
          Transfer ownership before leaving, or delete the league.
        </p>
      )}

      {/* past-season locked note */}
      {isPastSeason && (
        <p className="text-white/20 text-xs mt-4">
          This league is from a previous season and is now read-only.
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
            Leagues from the {filterSeason} season are view-only. 
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
  const location = useLocation()
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

        const params = new URLSearchParams(location.search)
        const targetId = Number(params.get('id'))
        if (targetId && leagueList.some(l => l.id === targetId)) {
          setSelectedId(targetId)
          setPageState('detail')
        } else {
          setPageState('list')
        }
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
        currentSeason={season}
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
