import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from './api'
import { useAuth } from './authState'
import { useSmoothLoading } from './useSmoothLoading'
import { LandingPageSkeleton } from './components/PageSkeletons'

function App() {
  const [loading,   setLoading]   = useState(true)
  const [season,    setSeason]    = useState(null)
  const [standings, setStandings] = useState([])
  const [updatedAt, setUpdatedAt] = useState(null)
  const [stats,     setStats]     = useState(null)

  const { accessToken } = useAuth()
  const isLoggedIn = !!accessToken

  useEffect(() => {
    async function load() {
      try {
        const [{ season: s }, platformStats] = await Promise.all([
          api.get('/api/standings/current-season'),
          api.get('/api/users/stats'),
        ])
        setSeason(s)
        setStats(platformStats)
        const table = await api.get(`/api/standings/${s}/actual/latest`)
        setStandings(table.standings)
        setUpdatedAt(table.updated_at)
      } catch {
        // Non-fatal — placeholders remain
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const showSkeleton = useSmoothLoading(loading)

  if (loading || showSkeleton) return <LandingPageSkeleton visible={showSkeleton} />

  const refreshedLabel = updatedAt
    ? new Date(updatedAt).toLocaleString('en-GB', {
        hour: '2-digit', minute: '2-digit',
        day: 'numeric', month: 'short',
      })
    : null

  function fmtNum(n) {
    if (n == null) return '—'
    const units = [
      { threshold: 1_000_000_000, suffix: 'b' },
      { threshold: 1_000_000, suffix: 'm' },
      { threshold: 1_000, suffix: 'k' },
    ]
    const unit = units.find(({ threshold }) => n >= threshold)
    if (unit) {
      const scaled = n / unit.threshold
      return `${scaled.toFixed(scaled >= 10 ? 0 : 1)}${unit.suffix}`
    }
    return n.toString()
  }

  return (
    <>
      {/* ── Bento grid ── */}
      <div className="page-ready grid grid-cols-12 grid-rows-[auto] gap-4 max-w-7xl mx-auto">

        {/* Hero — spans 8 cols */}
        <div className="col-span-12 md:col-span-8 bg-teal rounded-2xl p-8 md:p-10 flex flex-col justify-between min-h-64 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-jet opacity-20" />
          <div className="absolute bottom-0 left-1/2 w-48 h-48 rounded-full bg-teal-muted opacity-10" />

          <div className="relative z-10">
            <span className="inline-block bg-jet text-teal-muted text-xs font-medium px-3 py-1 rounded-full mb-4">
              {season ? `${season} Season` : '— Season · —'}
            </span>
            <h1 className="text-white text-4xl md:text-5xl font-bold leading-tight tracking-tight max-w-xl">
              Predict the table.
              <br />
              <span className="text-mist">Beat your mates.</span>
            </h1>
            <p className="text-mist mt-4 max-w-md text-base opacity-80">
              Submit a complete predicted table before the deadline. Scores measure the total positional difference from the current standings, and the lowest total wins.
            </p>
          </div>

          <div className="relative z-10 flex gap-3 mt-8">
            {isLoggedIn ? (
              <>
                <Link to="/dashboard" className="bg-white text-jet font-semibold text-sm px-6 py-3 rounded-xl hover:bg-bone transition-colors">
                  Go to dashboard
                </Link>
                <Link to="/how-it-works" className="border border-white/30 text-white text-sm px-6 py-3 rounded-xl hover:bg-white/10 transition-colors">
                  How it works
                </Link>
              </>
            ) : (
              <>
                <Link to="/signup" className="bg-white text-jet font-semibold text-sm px-6 py-3 rounded-xl hover:bg-bone transition-colors">
                  Get started
                </Link>
                <Link to="/how-it-works" className="border border-white/30 text-white text-sm px-6 py-3 rounded-xl hover:bg-white/10 transition-colors">
                  How it works
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Live standings — 4 cols */}
        <div className="col-span-12 md:col-span-4 bg-jet-dark rounded-2xl p-6 flex flex-col min-h-64">
          <div className="flex items-center justify-between mb-1">
            <span className="text-teal-muted text-xs font-medium uppercase tracking-widest">Current Table</span>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          </div>
          <p className="text-teal text-[10px] mb-4">
            {refreshedLabel
              ? `Updated daily · Last changed: ${refreshedLabel}`
              : 'Updated daily · Last changed: —'}
          </p>

          <div className="space-y-2 flex-1 overflow-y-auto scrollbar-none">
            {standings.length > 0
              ? standings.slice(0, 10).map(({ position, team, points }) => (
                <div key={position} className="flex items-center gap-3">
                  <span className="text-teal text-xs w-4 font-mono shrink-0">{position}</span>
                  <div className="flex-1 h-7 bg-jet rounded-lg px-3 flex items-center justify-between">
                    <span className="text-white text-xs truncate">{team}</span>
                    <span className="text-teal-muted text-xs font-mono ml-2 shrink-0">{points}</span>
                  </div>
                </div>
              ))
              : [1, 2, 3, 4, 5].map(pos => (
                <div key={pos} className="flex items-center gap-3">
                  <span className="text-teal text-xs w-4 font-mono">{pos}</span>
                  <div className="flex-1 h-7 bg-jet rounded-lg px-3 flex items-center justify-between">
                    <span className="text-white/30 text-xs italic">—</span>
                    <span className="text-teal-muted/40 text-xs font-mono">—</span>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Scoring — 4 cols */}
        <div className="col-span-12 md:col-span-4 bg-bone rounded-2xl p-6">
          <span className="text-teal text-xs font-medium uppercase tracking-widest">Scoring</span>
          <h2 className="text-jet text-xl font-bold mt-2 mb-1 leading-snug">Lowest score wins</h2>
          <p className="text-jet/60 text-xs mb-4">
            Your score is the total error across all 20 positions. Predict 3rd, finish 5th: that's 2 points added. Nail it exactly: 0.
          </p>
          <div className="space-y-2">
            {[
              { example: 'Predicted 1st, finished 1st', error: '+0' },
              { example: 'Predicted 3rd, finished 4th', error: '+1' },
              { example: 'Predicted 5th, finished 9th', error: '+4' },
              { example: 'Predicted 9th, finished 2nd', error: '+7' },
            ].map(({ example, error }) => (
              <div key={example} className="flex items-center justify-between bg-white/60 rounded-xl px-4 py-2.5">
                <span className="text-jet text-xs">{example}</span>
                <span className="text-teal font-bold text-sm">{error}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Elo engine callout — 4 cols */}
        <div className="col-span-12 md:col-span-4 bg-teal-muted rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <span className="text-jet text-xs font-medium uppercase tracking-widest">Under the hood</span>
            <h2 className="text-jet text-xl font-bold mt-2 leading-snug">
              Mathematical model as a running benchmark
            </h2>
            <p className="text-jet/70 text-sm mt-3">
              A separate mathematical model simulates the remaining fixtures each gameweek, giving a data-driven view of where the table could land. It won't affect your score, but gives a mathematical point of comparison as the season unfolds.
            </p>
          </div>
          <div className="mt-6 flex items-end gap-1 h-12">
            {[40, 55, 45, 70, 60, 80, 72, 90, 85, 95].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-teal rounded-sm opacity-80"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        {/* Leagues — 4 cols */}
        <div className="col-span-12 md:col-span-4 bg-mist rounded-2xl p-6">
          <span className="text-teal text-xs font-medium uppercase tracking-widest">Private Leagues</span>
          <h2 className="text-jet text-xl font-bold mt-2 mb-4 leading-snug">Compete with whoever you like</h2>
          <div className="space-y-2">
            {[
              { name: 'Weekend Warriors',   members: 2      },
              { name: 'Family League',       members: 5      },
              { name: 'Sunday League Boys', members: 12     },
              { name: 'The Office Draft',   members: 48      },
            ].map(({ name, members }) => (
              <div key={name} className="flex items-center justify-between bg-white/50 rounded-xl px-4 py-3">
                <span className="text-jet text-sm font-medium">{name}</span>
                <span className="text-teal text-xs">{members} members</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats strip — full width */}
        <div className="col-span-12 bg-jet-dark rounded-2xl px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-4">
          {[
            { value: fmtNum(stats?.total_match_outcomes_simulated), label: 'Match outcomes simulated' },
            { value: fmtNum(stats?.total_alternative_seasons_simulated), label: 'Alternative seasons simulated' },
            { value: fmtNum(stats?.total_predicted_positions), label: 'User positions predicted' },
          ].map(({ value, label }) => (
            <div key={label} className="text-center flex-1">
              <p className="text-white text-2xl font-bold">{value}</p>
              <p className="text-teal-muted text-xs mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* CTA — full width */}
        {isLoggedIn ? (
          <div className="col-span-12 bg-teal rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-white text-2xl font-bold">Your dashboard is waiting.</h2>
              <p className="text-mist text-sm mt-1 opacity-80">Check your predictions, league standings, and how the model thinks the season will unfold.</p>
            </div>
            <Link to="/dashboard" className="bg-white text-jet font-semibold px-8 py-3 rounded-xl hover:bg-bone transition-colors whitespace-nowrap">
              Go to dashboard
            </Link>
          </div>
        ) : (
          <div className="col-span-12 bg-teal rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-white text-2xl font-bold">Ready to make your call?</h2>
              <p className="text-mist text-sm mt-1 opacity-80">Predictions lock 90 minutes before the opening fixture.</p>
            </div>
            <Link to="/signup" className="bg-white text-jet font-semibold px-8 py-3 rounded-xl hover:bg-bone transition-colors whitespace-nowrap">
              Create free account
            </Link>
          </div>
        )}

      </div>
    </>
  )
}

export default App
