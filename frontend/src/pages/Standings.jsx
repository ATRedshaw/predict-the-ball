import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useSmoothLoading } from '../useSmoothLoading'
import { StandingsSkeleton } from '../components/PageSkeletons'

// ---------------------------------------------------------------------------
// Zone divider
// ---------------------------------------------------------------------------

function ZoneDivider({ label, lineColour }) {
  return (
    <tr>
      <td colSpan={10} className="py-0.5 px-0">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className={`h-px flex-1 ${lineColour}`} />
          <span className="text-[10px] uppercase tracking-widest text-white/40">{label}</span>
          <div className={`h-px flex-1 ${lineColour}`} />
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Form badge
// ---------------------------------------------------------------------------

function FormBadge({ result }) {
  const colours = {
    W: 'bg-green-500/20 text-green-400',
    D: 'bg-white/10 text-white/40',
    L: 'bg-red-500/20 text-red-400',
  }
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${colours[result] ?? ''}`}>
      {result}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Standings() {
  const [loading,   setLoading]   = useState(true)
  const [season,    setSeason]    = useState(null)
  const [standings, setStandings] = useState([])
  const [updatedAt, setUpdatedAt] = useState(null)
  const [error,     setError]     = useState(null)
  const [kickedOff, setKickedOff] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const { season: s } = await api.get('/api/standings/current-season')
        setSeason(s)

        const deadlineData = await api.get(`/api/standings/${s}/deadline`)
        setKickedOff(deadlineData.kicked_off)

        if (deadlineData.kicked_off) {
          const table = await api.get(`/api/standings/${s}/actual/latest`)
          setStandings(table.standings ?? [])
          setUpdatedAt(table.updated_at)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const showSkeleton = useSmoothLoading(loading)

  if (loading || showSkeleton) return <StandingsSkeleton visible={showSkeleton} />

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  const refreshedLabel = updatedAt
    ? new Date(updatedAt).toLocaleString('en-GB', {
        hour: '2-digit', minute: '2-digit',
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null

  return (
    <div className="page-ready max-w-4xl mx-auto w-full px-4 py-6">

      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-white text-2xl font-bold leading-tight">Standings</h1>
          <p className="text-teal-muted text-xs mt-1">
            {season ? `${season} Premier League` : ''}
          </p>
        </div>
        {refreshedLabel && (
          <span className="text-white/25 text-xs mt-1">
            Updated daily · Last changed: {refreshedLabel}
          </span>
        )}
      </div>

      {/* ── No data yet ── */}
      {!kickedOff && (
        <div className="bg-jet-dark rounded-2xl p-8 text-center">
          <p className="text-white/40 text-sm">The season hasn't kicked off yet.</p>
          <p className="text-white/20 text-xs mt-2">Standings will appear once the first fixture is played.</p>
          <Link to="/predictions" className="inline-block mt-4 text-teal text-xs font-medium hover:text-teal-muted transition-colors">
            Submit your prediction →
          </Link>
        </div>
      )}

      {/* ── Table ── */}
      {kickedOff && standings.length > 0 && (
        <div className="bg-jet-dark rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="text-white/30 text-[10px] uppercase tracking-widest font-medium text-right px-4 py-3 w-10">#</th>
                  <th className="text-white/30 text-[10px] uppercase tracking-widest font-medium text-left px-3 py-3">Team</th>
                  <th className="text-white/30 text-[10px] uppercase tracking-widest font-medium text-center px-3 py-3 w-10">P</th>
                  <th className="text-white/30 text-[10px] uppercase tracking-widest font-medium text-center px-3 py-3 w-10">W</th>
                  <th className="text-white/30 text-[10px] uppercase tracking-widest font-medium text-center px-3 py-3 w-10">D</th>
                  <th className="text-white/30 text-[10px] uppercase tracking-widest font-medium text-center px-3 py-3 w-10">L</th>
                  <th className="text-white/30 text-[10px] uppercase tracking-widest font-medium text-center px-3 py-3 w-12">GF</th>
                  <th className="text-white/30 text-[10px] uppercase tracking-widest font-medium text-center px-3 py-3 w-12">GA</th>
                  <th className="text-white/30 text-[10px] uppercase tracking-widest font-medium text-center px-3 py-3 w-12">GD</th>
                  <th className="text-white/30 text-[10px] uppercase tracking-widest font-medium text-center px-4 py-3 w-12">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, idx) => {
                  const pos = row.position
                  const isRelegation = pos >= 18

                  const posColour =
                    pos === 1    ? 'text-yellow-400' :
                    isRelegation ? 'text-red-400'    :
                    'text-white/40'

                  const rowBg = idx % 2 === 0 ? '' : 'bg-white/[0.02]'

                  const gdColour =
                    row.goal_difference > 0 ? 'text-green-400' :
                    row.goal_difference < 0 ? 'text-red-400'   :
                    'text-white/40'

                  // Zone divider rows
                  const showRelegationBar = pos === 18

                  return (
                    <>
                      {showRelegationBar && <ZoneDivider key={`div-rel-${pos}`} label="Relegation zone" lineColour="bg-red-400/30" />}
                      <tr
                        key={row.team}
                        className={`${rowBg} border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors`}
                      >
                        <td className="text-right px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {isRelegation && <div className="w-0.5 h-4 rounded-full bg-red-400/70 shrink-0" />}
                            <span className={`font-mono text-xs ${posColour}`}>{pos}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-white text-sm font-medium">{row.team}</span>
                          {row.points_deducted > 0 && (
                            <span className="ml-2 text-[10px] text-red-400/70">−{row.points_deducted} pts</span>
                          )}
                        </td>
                        <td className="text-center px-3 py-3 text-white/60 font-mono text-xs">{row.played}</td>
                        <td className="text-center px-3 py-3 text-white/60 font-mono text-xs">{row.won}</td>
                        <td className="text-center px-3 py-3 text-white/60 font-mono text-xs">{row.drawn}</td>
                        <td className="text-center px-3 py-3 text-white/60 font-mono text-xs">{row.lost}</td>
                        <td className="text-center px-3 py-3 text-white/50 font-mono text-xs">{row.goals_for}</td>
                        <td className="text-center px-3 py-3 text-white/50 font-mono text-xs">{row.goals_against}</td>
                        <td className={`text-center px-3 py-3 font-mono text-xs ${gdColour}`}>
                          {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
                        </td>
                        <td className="text-center px-4 py-3">
                          <span className="text-white font-bold text-sm">{row.points}</span>
                        </td>
                      </tr>
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-4 py-3 border-t border-white/8 flex flex-wrap gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-3 rounded-full bg-red-400/70" />
              <span className="text-white/30 text-[10px]">Relegation</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
