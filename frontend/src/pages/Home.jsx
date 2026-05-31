import { useState, useEffect, useLayoutEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
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

function PredictionCard({ prediction, season, kickedOff }) {
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

  return (
    <div className="bg-jet-dark rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-white font-semibold text-sm">Your prediction</p>
          <p className="text-white/30 text-xs mt-0.5">
            {updated_at ? `Updated ${dateLabel}` : `Submitted ${dateLabel}`}
          </p>
        </div>
        {points !== null && points !== undefined && (
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
        <div className="space-y-1.5">
          {standings.slice(0, 5).map((team, i) => {
            const pos = i + 1
            const posColour =
              pos === 1 ? 'text-yellow-400' :
              pos >= 18 ? 'text-red-400' :
              'text-white/40'
            return (
              <div key={team} className="flex items-center gap-3">
                <span className={`font-mono text-xs w-4 text-right shrink-0 ${posColour}`}>{pos}</span>
                <div className="flex-1 h-7 bg-jet rounded-lg px-3 flex items-center">
                  <span className="text-white text-xs truncate">{team}</span>
                </div>
              </div>
            )
          })}
          {standings.length > 5 && (
            <Link to="/predictions" className="block text-center text-white/30 text-[10px] mt-2 hover:text-teal-muted transition-colors">
              + {standings.length - 5} more · view full prediction
            </Link>
          )}
        </div>
      )}

      {!standings && !kickedOff && (
        <p className="text-white/30 text-xs">
          Your full table will be revealed once the season kicks off.
        </p>
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
      to="/leagues"
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
          <p className="text-white font-bold text-sm leading-none">
            {rank.rank}<span className="text-white/30 font-normal">/{rank.total}</span>
          </p>
          <p className="text-white/30 text-[10px] mt-0.5">rank</p>
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

  return (
    <div className="border border-white/8 rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-white font-medium text-sm">{season}</span>
          {global_rank && (
            <span className="text-teal text-xs">
              #{global_rank.rank} of {global_rank.total}
            </span>
          )}
          {prediction?.points !== null && prediction?.points !== undefined && (
            <span className="text-white/40 text-xs">{prediction.points} pts</span>
          )}
        </div>
        <span className={`text-white/30 text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-white/8 pt-4 space-y-4">
          {prediction ? (
            <div>
              <SectionHeading>Prediction</SectionHeading>
              {prediction.standings ? (
                <div className="space-y-1.5">
                  {prediction.standings.slice(0, 20).map((team, i) => {
                    const pos = i + 1
                    const posColour =
                      pos === 1 ? 'text-yellow-400' :
                      pos >= 18 ? 'text-red-400' :
                      'text-white/40'
                    return (
                      <div key={team} className="flex items-center gap-3">
                        <span className={`font-mono text-xs w-4 text-right shrink-0 ${posColour}`}>{pos}</span>
                        <div className="flex-1 h-6 bg-jet rounded-lg px-3 flex items-center">
                          <span className="text-white text-xs truncate">{team}</span>
                        </div>
                      </div>
                    )
                  })}
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
                    <span className="text-white text-xs">{l.name}</span>
                    {l.rank ? (
                      <span className="text-teal text-xs font-medium">
                        #{l.rank.rank}/{l.rank.total}
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

  useLayoutEffect(() => {
    setPageLoading(true)
  }, [])

  useEffect(() => {
    api.get('/api/users/me/dashboard')
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setPageLoading(false))
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
    current,
    history,
  } = data

  const deadlineLabel = deadline
    ? new Date(deadline).toLocaleString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit',
      })
    : null

  const hasPrediction     = !!current?.prediction
  const globalRank        = current?.global_rank
  const currentLeagues    = current?.leagues ?? []

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 py-2">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-white text-2xl font-bold leading-tight">
            Hey, {user.first_name}
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            {current_season ? `${current_season} season` : '—'}
            {deadlineLabel && !kicked_off && (
              <span className="ml-2 text-teal-muted">· deadline {deadlineLabel}</span>
            )}
            {kicked_off && (
              <span className="ml-2 text-white/25">· season in progress</span>
            )}
          </p>
        </div>
        {!hasPrediction && !kicked_off && current_season && (
          <Link
            to="/predictions"
            className="bg-teal text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-teal/80 transition-colors shrink-0"
          >
            Submit prediction
          </Link>
        )}
      </div>

      {/* ── Stats row ── */}
      <div className="flex gap-3 flex-wrap">
        <StatCard
          label="Global rank"
          value={globalRank ? `#${globalRank.rank}` : '—'}
          sub={globalRank ? `of ${globalRank.total} predictors` : kicked_off ? 'no prediction' : 'season not started'}
        />
        <StatCard
          label="Your score"
          value={current?.prediction?.points ?? '—'}
          sub={current?.prediction?.points !== null && current?.prediction?.points !== undefined ? 'lower is better' : kicked_off ? 'no prediction' : 'pending kick-off'}
        />
        <StatCard
          label="Leagues"
          value={currentLeagues.length || '—'}
          sub={currentLeagues.length > 0 ? `${current_season} season` : 'none joined yet'}
        />
      </div>

      {/* ── Two-column grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Prediction */}
        <div>
          <SectionHeading>Your prediction · {current_season}</SectionHeading>
          <PredictionCard
            prediction={current?.prediction}
            season={current_season}
            kickedOff={kicked_off}
          />
        </div>

        {/* Leagues */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionHeading>Current leagues</SectionHeading>
            <Link
              to="/leagues"
              className="text-teal text-[10px] uppercase tracking-widest hover:text-teal-muted transition-colors"
            >
              Manage →
            </Link>
          </div>
          {currentLeagues.length > 0 ? (
            <div className="space-y-2">
              {currentLeagues.map(l => (
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
        </div>
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

