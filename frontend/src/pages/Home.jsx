import { useState, useEffect, useLayoutEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import DeadlineCountdown from '../components/DeadlineCountdown'
import { usePageLoading } from '../components/PageLoadingContext'

// ---------------------------------------------------------------------------
// Small shared primitives
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-jet-dark rounded-2xl px-6 py-5 flex flex-col gap-1 flex-1 min-w-0">
      <span className="text-teal-muted text-[10px] uppercase tracking-widest">{label}</span>
      <span className="text-white text-2xl font-bold leading-none">{value ?? '—'}</span>
      {sub && <span className="text-white/30 text-xs mt-0.5">{sub}</span>}
    </div>
  )
}

function SectionHeading({ children }) {
  return (
    <h2 className="text-teal-muted text-[10px] font-medium uppercase tracking-widest mb-3">
      {children}
    </h2>
  )
}

function EmptyState({ message, cta, to }) {
  return (
    <div className="rounded-2xl border border-white/8 px-6 py-8 flex flex-col items-center gap-3 text-center">
      <p className="text-white/40 text-sm">{message}</p>
      {cta && (
        <Link
          to={to}
          className="text-teal text-xs font-medium hover:text-teal-muted transition-colors"
        >
          {cta} →
        </Link>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Prediction card
// ---------------------------------------------------------------------------

function PredictionCard({ prediction, season, kickedOff, actualLookup }) {
  if (!prediction) {
    if (kickedOff) {
      return (
        <EmptyState
          message="No prediction was submitted for this season."
        />
      )
    }
    return (
      <EmptyState
        message="You haven't submitted a prediction yet."
        cta="Make your prediction"
        to="/predictions"
      />
    )
  }

  const { standings, points, submitted_at, updated_at } = prediction
  const dateLabel = new Date(updated_at ?? submitted_at).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const hasActual = actualLookup && Object.keys(actualLookup).length > 0

  return (
    <div className="bg-jet-dark rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-white font-semibold text-sm">Your prediction</p>
          <p className="text-white/30 text-xs mt-0.5">
            {updated_at ? `Updated ${dateLabel}` : `Submitted ${dateLabel}`}
          </p>
        </div>
        {kickedOff && points !== null && points !== undefined && (
          <div className="text-right">
            <p className="text-teal text-xl font-bold leading-none">{points}</p>
            <p className="text-white/30 text-[10px] mt-0.5">pts</p>
          </div>
        )}
        {!kickedOff && (
          <Link
            to="/predictions"
            className="text-xs text-teal-muted border border-teal/30 px-3 py-1.5 rounded-lg hover:bg-teal/10 transition-colors"
          >
            Edit
          </Link>
        )}
      </div>

      {standings && (
        <div>
          {hasActual && (
            <div className="grid grid-cols-[1.5rem_1fr_2.5rem_2.5rem] gap-x-3 px-2 pb-1.5">
              <span className="text-white/30 text-[10px] uppercase tracking-widest text-right">#</span>
              <span className="text-white/30 text-[10px] uppercase tracking-widest">Team</span>
              <span className="text-white/30 text-[10px] uppercase tracking-widest text-center">Act.</span>
              <span className="text-white/30 text-[10px] uppercase tracking-widest text-center">Δ</span>
            </div>
          )}
          <div className="space-y-1.5">
            {standings.slice(0, 5).map((team, i) => {
              const pos = i + 1
              const actualPos = actualLookup?.[team]
              const delta = actualPos != null ? actualPos - pos : null
              const posColour = pos === 1 ? 'text-yellow-400' : pos >= 18 ? 'text-red-400' : 'text-white/40'
              const deltaColour = delta == null ? 'text-white/20' : delta < 0 ? 'text-green-400' : delta > 0 ? 'text-red-400' : 'text-white/30'
              return hasActual ? (
                <div key={team} className="grid grid-cols-[1.5rem_1fr_2.5rem_2.5rem] gap-x-3 px-2 py-1.5 rounded-lg bg-jet items-center">
                  <span className={`font-mono text-xs text-right shrink-0 ${posColour}`}>{pos}</span>
                  <span className="text-white text-xs truncate">{team}</span>
                  <span className="text-white/40 text-xs text-center font-mono">{actualPos ?? '—'}</span>
                  <span className={`text-xs text-center font-mono ${deltaColour}`}>
                    {delta == null ? '—' : delta === 0 ? '0' : delta > 0 ? `+${delta}` : delta}
                  </span>
                </div>
              ) : (
                <div key={team} className="flex items-center gap-3">
                  <span className={`font-mono text-xs w-4 text-right shrink-0 ${posColour}`}>{pos}</span>
                  <div className="flex-1 h-7 bg-jet rounded-lg px-3 flex items-center">
                    <span className="text-white text-xs truncate">{team}</span>
                  </div>
                </div>
              )
            })}
          </div>
          {standings.length > 5 && (
            <Link to="/predictions" className="block text-center text-white/30 text-[10px] mt-2 hover:text-teal-muted transition-colors">
              + {standings.length - 5} more · view full prediction
            </Link>
          )}
        </div>
      )}

      {!standings && !kickedOff && (
        <p className="text-white/30 text-xs">
          A table snapshot will be visible once the season kicks off.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Compact actual standings card (used on dashboard)
// ---------------------------------------------------------------------------

function ActualStandingsCard({ standings, updatedAt, kickedOff, season }) {
  if (!kickedOff) {
    return (
      <EmptyState
        message="Standings will appear once the season kicks off."
        cta="Submit your prediction"
        to="/predictions"
      />
    )
  }

  // standings is the full array from the API: [{ position, team, points, ... }]
  const rows = standings
    ? [...standings].sort((a, b) => a.position - b.position)
    : []

  if (rows.length === 0) {
    return (
      <div className="bg-jet-dark rounded-2xl px-5 py-6 text-center">
        <p className="text-white/30 text-xs">No standings data available yet.</p>
      </div>
    )
  }

  const preview = rows.slice(0, 5)

  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null

  return (
    <div className="bg-jet-dark rounded-2xl p-5">
      <div className="mb-4">
        <p className="text-white font-semibold text-sm">Live PL table</p>
        {updatedLabel && (
          <p className="text-white/30 text-xs mt-0.5">
            Updated daily · Last changed: {updatedLabel}
          </p>
        )}
      </div>
      <div className="grid grid-cols-[1.5rem_1fr_2.5rem_2.5rem] gap-x-3 px-2 pb-1.5">
        <span className="text-white/30 text-[10px] uppercase tracking-widest text-right">#</span>
        <span className="text-white/30 text-[10px] uppercase tracking-widest">Team</span>
        <span className="text-white/30 text-[10px] uppercase tracking-widest text-center">P</span>
        <span className="text-white/30 text-[10px] uppercase tracking-widest text-center">Pts</span>
      </div>
      <div className="space-y-1.5">
        {preview.map(({ team, position, played, points }) => {
          const posColour =
            position === 1  ? 'text-yellow-400' :
            position >= 18  ? 'text-red-400'    :
            'text-white/40'

          return (
            <div
              key={team}
              className="grid grid-cols-[1.5rem_1fr_2.5rem_2.5rem] gap-x-3 px-2 py-1.5 rounded-lg bg-jet items-center"
            >
              <span className={`font-mono text-xs text-right shrink-0 ${posColour}`}>{position}</span>
              <span className="text-white text-xs truncate">{team}</span>
              <span className="text-white/40 text-xs text-center font-mono">{played ?? '—'}</span>
              <span className="text-white font-bold text-xs text-center font-mono">{points ?? '—'}</span>
            </div>
          )
        })}
      </div>
      {rows.length > 5 && (
        <Link
          to="/standings"
          className="block text-center text-white/30 text-[10px] mt-2 hover:text-teal-muted transition-colors"
        >
          + {rows.length - 5} more · view full table
        </Link>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// League card
// ---------------------------------------------------------------------------

function LeagueCard({ league, kickedOff }) {
  const { id, name, member_count, role, rank } = league
  return (
    <Link
      to={`/leagues?id=${id}`}
      className="bg-jet-dark rounded-2xl px-5 py-4 flex items-center justify-between hover:bg-jet transition-colors"
    >
      <div className="min-w-0">
        <p className="text-white text-sm font-medium truncate">{name}</p>
        <p className="text-white/30 text-xs mt-0.5">
          {member_count} {member_count === 1 ? 'member' : 'members'}
          {role === 'owner' && <span className="text-teal ml-2">· owner</span>}
        </p>
      </div>
      {kickedOff && rank ? (
        <div className="text-right shrink-0 ml-4">
          <p className="text-white/60 text-sm leading-none">
            #{rank.rank}<span className="text-white/30">/{rank.total}</span>
          </p>
        </div>
      ) : kickedOff ? (
        <span className="text-white/20 text-xs shrink-0 ml-4">no prediction</span>
      ) : (
        <span className="text-white/20 text-xs shrink-0 ml-4">pending →</span>
      )}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// History section
// ---------------------------------------------------------------------------

function HistoryRow({ entry, expanded, onToggle }) {
  const { season, prediction, leagues, global_rank } = entry
  const hasPoints = prediction?.points != null
  const [actual, setActual] = useState(null)

  useEffect(() => {
    if (!expanded || actual !== null || !prediction?.standings) return
    api.get(`/api/standings/${season}/actual/latest`)
      .then(d => {
        const lookup = {}
        ;(d.standings ?? []).forEach(({ position, team }) => { lookup[team] = position })
        setActual(lookup)
      })
      .catch(() => setActual({}))
  }, [expanded, season])

  const hasActualData = actual && Object.keys(actual).length > 0

  return (
    <div className="border border-white/8 rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-medium text-sm">{season}</span>
          {hasPoints && (
            <span className="text-white/40 text-xs font-mono">{prediction.points} pts</span>
          )}
          {global_rank && (
            <span className="bg-teal/15 text-teal text-[10px] font-medium px-2 py-0.5 rounded-full">
              #{global_rank.rank}/{global_rank.total} overall
            </span>
          )}
        </div>
        <span className={`text-white/30 text-xs transition-transform shrink-0 ml-3 ${expanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-white/8 pt-4 space-y-4">
          {prediction ? (
            <div>
              <SectionHeading>Prediction</SectionHeading>
              {prediction.standings ? (
                <div className="bg-jet rounded-xl p-3">
                  <div className={`grid ${hasActualData ? 'grid-cols-[1.5rem_1fr_2.5rem_2.5rem]' : 'grid-cols-[1.5rem_1fr]'} gap-x-3 px-2 pb-2 mb-1`}>
                    <span className="text-white/30 text-[10px] uppercase tracking-widest text-right">#</span>
                    <span className="text-white/30 text-[10px] uppercase tracking-widest">Team</span>
                    {hasActualData && <span className="text-white/30 text-[10px] uppercase tracking-widest text-center">Act.</span>}
                    {hasActualData && <span className="text-white/30 text-[10px] uppercase tracking-widest text-center">Δ</span>}
                  </div>
                  <div className="space-y-1">
                    {prediction.standings.map((team, i) => {
                      const pos = i + 1
                      const actualPos = actual?.[team]
                      const delta = actualPos != null ? actualPos - pos : null
                      const posColour = pos === 1 ? 'text-yellow-400' : pos >= 18 ? 'text-red-400' : 'text-white/40'
                      const deltaColour = delta == null ? 'text-white/20' : delta < 0 ? 'text-green-400' : delta > 0 ? 'text-red-400' : 'text-white/30'
                      return (
                        <div
                          key={team}
                          className={`grid ${hasActualData ? 'grid-cols-[1.5rem_1fr_2.5rem_2.5rem]' : 'grid-cols-[1.5rem_1fr]'} gap-x-3 px-2 py-1.5 rounded-lg bg-jet-dark items-center`}
                        >
                          <span className={`font-mono text-xs text-right shrink-0 ${posColour}`}>{pos}</span>
                          <span className="text-white text-xs truncate">{team}</span>
                          {hasActualData && <span className="text-white/40 text-xs text-center font-mono">{actualPos ?? '—'}</span>}
                          {hasActualData && (
                            <span className={`text-xs text-center font-mono ${deltaColour}`}>
                              {delta == null ? '—' : delta === 0 ? '0' : delta > 0 ? `+${delta}` : delta}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {hasActualData && (
                    <p className="text-white/20 text-[10px] mt-3 text-center">
                      Δ = actual − predicted. Negative means the team finished higher than predicted.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-white/30 text-xs">Standings not available.</p>
              )}
            </div>
          ) : (
            <p className="text-white/30 text-xs">No prediction submitted for this season.</p>
          )}

          {leagues.length > 0 && (
            <div>
              <SectionHeading>Leagues</SectionHeading>
              <div className="space-y-2">
                {leagues.map(l => (
                  <div key={l.id} className="flex items-center justify-between bg-jet rounded-xl px-4 py-2.5">
                    <div>
                      <span className="text-white text-xs">{l.name}</span>
                      {l.role === 'owner' && (
                        <span className="text-teal text-[10px] ml-1.5">owner</span>
                      )}
                    </div>
                    {l.rank ? (
                      <span className="text-white/60 text-sm shrink-0 ml-4">
                        #{l.rank.rank}<span className="text-white/30">/{l.rank.total}</span>
                      </span>
                    ) : (
                      <span className="text-white/20 text-xs">—</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export default function Home() {
  const { setPageLoading } = usePageLoading()
  const [data,  setData]  = useState(null)
  const [error, setError] = useState(null)
  const [expandedSeason, setExpandedSeason] = useState(null)
  const [actualLookup, setActualLookup] = useState(null)
  const [actualStandingsFull, setActualStandingsFull] = useState(null)
  const [actualStandingsUpdatedAt, setActualStandingsUpdatedAt] = useState(null)

  useLayoutEffect(() => {
    setPageLoading(true)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const dashboard = await api.get('/api/users/me/dashboard')
        setData(dashboard)
        if (dashboard.current_season && dashboard.kicked_off) {
          api.get(`/api/standings/${dashboard.current_season}/actual/latest`)
            .then(d => {
              const rows = d.standings ?? []
              const lookup = {}
              rows.forEach(({ position, team }) => { lookup[team] = position })
              setActualLookup(lookup)
              setActualStandingsFull(rows)
              setActualStandingsUpdatedAt(d.updated_at ?? null)
            })
            .catch(() => {})
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setPageLoading(false)
      }
    }
    load()
  }, [setPageLoading])

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  if (!data) return null

  const {
    user,
    current_season,
    kicked_off,
    deadline,
    avg_score,
    current,
    history,
  } = data

  const deadlineLabel = deadline
    ? new Date(deadline).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      })
    : null

  const hasPrediction     = !!current?.prediction
  const visiblePoints     = kicked_off ? current?.prediction?.points : null
  const globalRank        = kicked_off ? current?.global_rank : null
  const visibleAvgScore   = kicked_off ? avg_score : null
  const currentLeagues    = current?.leagues ?? []

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 py-2">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 max-w-full flex-1">
          <h1 className="truncate text-white text-2xl font-bold leading-tight">
            Hey, {user.first_name}
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            {current_season ? `${current_season} season` : '—'}
            {kicked_off && (
              <span className="ml-2 text-white/25">· predictions locked</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!hasPrediction && !kicked_off && current_season && (
            <Link
              to="/predictions"
              className="bg-teal text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-teal/80 transition-colors shrink-0"
            >
              Submit prediction
            </Link>
          )}
          <Link
            to="/how-it-works"
            className="shrink-0 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-medium text-teal-muted transition-colors hover:bg-white/5 hover:text-white"
          >
            Rules &amp; scoring
          </Link>
        </div>
      </div>

      {!kicked_off && deadlineLabel && (
        <DeadlineCountdown
          key={deadline}
          deadline={deadline}
          deadlineLabel={deadlineLabel}
        />
      )}

      {/* ── Stats row ── */}
      <div className="flex gap-3 flex-wrap">
        <StatCard
          label="Global rank"
          value={globalRank ? `#${globalRank.rank}` : '—'}
          sub={globalRank ? `of ${globalRank.total} predictors` : visiblePoints != null ? 'calculating…' : kicked_off ? 'no prediction' : 'season not started'}
        />
        <StatCard
          label="Your score"
          value={visiblePoints ?? '—'}
          sub={
            visiblePoints != null && visibleAvgScore != null
              ? `worldwide seasonal average: ${visibleAvgScore}`
              : visiblePoints != null
              ? 'lower is better'
              : kicked_off ? 'no prediction' : 'pending kick-off'
          }
        />
        <StatCard
          label="Leagues"
          value={currentLeagues.length || '—'}
          sub={currentLeagues.length > 0 ? `${current_season} season` : 'none joined yet'}
        />
      </div>

      {/* ── Two-column grid: prediction + standings ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Prediction */}
        <div>
          <SectionHeading>Your prediction · {current_season}</SectionHeading>
          <PredictionCard
            prediction={current?.prediction}
            season={current_season}
            kickedOff={kicked_off}
            actualLookup={actualLookup}
          />
        </div>

        {/* Actual standings (compact) */}
        <div>
          <div className="mb-3">
            <SectionHeading>Current standings · {current_season}</SectionHeading>
          </div>
          <ActualStandingsCard
            standings={actualStandingsFull}
            updatedAt={actualStandingsUpdatedAt}
            kickedOff={kicked_off}
            season={current_season}
          />
        </div>
      </div>

      {/* ── Leagues (full width below) ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionHeading>Current leagues</SectionHeading>
          {currentLeagues.length > 0 && (
            <Link
              to="/leagues"
              className="text-teal text-[10px] font-medium hover:text-teal-muted transition-colors -mt-3"
            >
              All leagues →
            </Link>
          )}
        </div>
        {currentLeagues.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {currentLeagues.slice(0, 6).map(l => (
              <LeagueCard key={l.id} league={l} kickedOff={kicked_off} />
            ))}
          </div>
        ) : (
          <EmptyState
            message="You're not in any leagues yet."
            cta="Create or join a league"
            to="/leagues"
          />
        )}
        {currentLeagues.length > 6 && (
          <Link
            to="/leagues"
            className="block text-center text-white/30 text-[10px] mt-2 hover:text-teal-muted transition-colors"
          >
            + {currentLeagues.length - 6} more · view all leagues
          </Link>
        )}
      </div>

      {/* ── Previous seasons ── */}
      {history.length > 0 && (
        <div>
          <SectionHeading>Previous seasons</SectionHeading>
          <div className="space-y-2">
            {history.map(entry => (
              <HistoryRow
                key={entry.season}
                entry={entry}
                expanded={expandedSeason === entry.season}
                onToggle={() =>
                  setExpandedSeason(prev =>
                    prev === entry.season ? null : entry.season
                  )
                }
              />
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
