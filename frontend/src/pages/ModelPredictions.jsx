import { useState, useEffect, useLayoutEffect } from 'react'
import { api } from '../api'
import { usePageLoading } from '../components/PageLoadingContext'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(probabilities, ...positions) {
  return positions.reduce((sum, p) => sum + (probabilities?.[String(p)] ?? 0), 0)
}

function fmt(n, decimals = 1) {
  if (n == null) return '—'
  return Number(n).toFixed(decimals)
}

function toDateInput(isoString) {
  return isoString ? isoString.slice(0, 10) : ''
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeading({ children }) {
  return (
    <h2 className="text-teal-muted text-[10px] font-medium uppercase tracking-widest mb-3">
      {children}
    </h2>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`text-sm px-4 py-2 rounded-xl transition-colors font-medium ${
        active ? 'bg-teal text-white' : 'text-teal-muted hover:text-white hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  )
}

/** A small horizontal bar used inside probability cells. */
function ProbBar({ value, colour = 'bg-teal' }) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colour} transition-all`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-[11px] font-mono text-white/60 w-10 text-right shrink-0">
        {fmt(clamped, 1)}%
      </span>
    </div>
  )
}

function PositionBadge({ pos }) {
  const colour =
    pos === 1     ? 'text-yellow-400' :
    pos <= 4      ? 'text-teal'       :
    pos >= 18     ? 'text-red-400'    :
                    'text-white/40'
  return <span className={`font-mono text-xs w-5 text-right shrink-0 ${colour}`}>{pos}</span>
}

// ---------------------------------------------------------------------------
// Per-position breakdown panel
// ---------------------------------------------------------------------------

function positionColour(pos) {
  if (pos === 1)  return 'bg-yellow-400'
  if (pos <= 4)   return 'bg-teal'
  if (pos <= 10)  return 'bg-teal-muted'
  if (pos <= 17)  return 'bg-white/30'
  return 'bg-red-500'
}

function positionLabel(pos) {
  if (pos === 1)  return 'Champion'
  if (pos >= 18)  return 'Relegated'
  return null
}

function PositionBreakdown({ row }) {
  const fp = row.finish_probabilities
  const positions = Array.from({ length: 20 }, (_, i) => i + 1)
  const maxPct = Math.max(...positions.map(p => fp?.[String(p)] ?? 0), 0.1)

  return (
    <div className="mt-3 pt-3 border-t border-white/8">
      <p className="text-white/30 text-[10px] uppercase tracking-widest mb-3">
        Finish probability — every position
      </p>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { label: 'Title',       value: fp?.['1'] ?? 0,          colour: 'text-yellow-400' },
          { label: 'Relegation',  value: pct(fp, 18, 19, 20),     colour: 'text-red-400' },
        ].map(({ label, value, colour }) => (
          <div key={label} className="bg-jet-dark rounded-xl px-3 py-1.5 flex items-baseline gap-1.5">
            <span className={`text-sm font-bold font-mono ${colour}`}>{fmt(value, 1)}%</span>
            <span className="text-white/30 text-[10px]">{label}</span>
          </div>
        ))}
      </div>

      {/* Bar chart — all 20 positions */}
      <div className="space-y-1.5">
        {positions.map(pos => {
          const val   = fp?.[String(pos)] ?? 0
          const label = positionLabel(pos)
          const width = maxPct > 0 ? (val / maxPct) * 100 : 0

          return (
            <div key={pos} className="flex items-center gap-2">
              <span className={`font-mono text-[11px] w-5 text-right shrink-0 ${
                pos === 1 ? 'text-yellow-400' : pos <= 4 ? 'text-teal' : pos >= 18 ? 'text-red-400' : 'text-white/30'
              }`}>{pos}</span>
              <div className="flex-1 h-5 bg-white/5 rounded-md overflow-hidden relative">
                <div
                  className={`h-full rounded-md ${positionColour(pos)} transition-all duration-300`}
                  style={{ width: `${width}%`, opacity: val < 0.05 ? 0.2 : 0.85 }}
                />
                {label && (
                  <span className="absolute inset-y-0 left-2 flex items-center text-[9px] text-white/30 uppercase tracking-widest pointer-events-none">
                    {label}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-mono text-white/50 w-10 text-right shrink-0">
                {val < 0.05 ? '<0.1%' : `${fmt(val, 1)}%`}
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-white/20 text-[10px] mt-3 text-center">
        Mean projected finish: {fmt(row.mean_position)} · bars scaled relative to this team's peak position
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Projections table
// ---------------------------------------------------------------------------

function ProjectionsTable({ projections }) {
  const [expandedTeam, setExpandedTeam] = useState(null)

  if (!projections?.length) return (
    <p className="text-white/30 text-sm text-center py-8">No projection data available.</p>
  )

  return (
    <div>
      {/* Header */}
      <div className="grid grid-cols-[1.5rem_1fr_5rem_5rem_1.25rem] gap-x-3 px-3 pb-2 mb-1 hidden md:grid">
        <span className="text-white/30 text-[10px] uppercase tracking-widest text-right">#</span>
        <span className="text-white/30 text-[10px] uppercase tracking-widest">Team</span>
        <span className="text-white/30 text-[10px] uppercase tracking-widest text-center">Title</span>
        <span className="text-white/30 text-[10px] uppercase tracking-widest text-center">Relegation</span>
        <span />
      </div>

      <div className="space-y-1.5">
        {projections.map((row, i) => {
          const pos      = i + 1
          const fp       = row.finish_probabilities
          const titlePct = fp?.['1'] ?? 0
          const relegPct = pct(fp, 18, 19, 20)
          const expanded = expandedTeam === row.team

          return (
            <div
              key={row.team}
              className={`rounded-xl px-3 py-2.5 transition-colors ${expanded ? 'bg-jet-dark ring-1 ring-white/10' : 'bg-jet'}`}
            >
              {/* Clickable row — mobile */}
              <button
                onClick={() => setExpandedTeam(prev => prev === row.team ? null : row.team)}
                className="flex items-center gap-3 w-full text-left md:hidden"
              >
                <PositionBadge pos={pos} />
                <span className="text-white text-sm font-medium flex-1 truncate">{row.team}</span>
                <span className="text-white/40 text-xs font-mono shrink-0">~{fmt(row.mean_position)}</span>
                <span className={`text-white/30 text-[10px] ml-1 transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {!expanded && (
                <div className="mt-2 md:hidden space-y-1.5">
                  <div className="flex gap-4 text-[11px]">
                    <div><span className="text-white/30 mr-2">Title</span><span className="text-white/60 font-mono">{fmt(titlePct)}%</span></div>
                    <div><span className="text-white/30 mr-2">Relg.</span><span className="text-red-400/70 font-mono">{fmt(relegPct)}%</span></div>
                  </div>
                </div>
              )}

              {/* Clickable row — desktop */}
              <button
                onClick={() => setExpandedTeam(prev => prev === row.team ? null : row.team)}
                className="hidden md:grid w-full grid-cols-[1.5rem_1fr_5rem_5rem_1.25rem] gap-x-3 items-center text-left"
              >
                <PositionBadge pos={pos} />
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-white text-sm font-medium truncate">{row.team}</span>
                  <span className="text-white/25 text-xs font-mono shrink-0">~{fmt(row.mean_position)}</span>
                </div>
                <ProbBar value={titlePct}  colour="bg-yellow-400" />
                <ProbBar value={relegPct}  colour="bg-red-500" />
                <span className={`text-white/25 text-[10px] text-right transition-transform inline-block ${expanded ? 'rotate-180' : ''}`}>▼</span>
              </button>

              {/* Expanded breakdown */}
              {expanded && <PositionBreakdown row={row} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Compare tab
// ---------------------------------------------------------------------------

function CompareTable({ comparison, actualUpdatedAt, projectionUpdatedAt }) {
  if (!comparison?.length) return (
    <p className="text-white/30 text-sm text-center py-8">No comparison data available.</p>
  )

  return (
    <div>
      <div className="grid grid-cols-[1.5rem_1fr_3rem_5rem_4rem] gap-x-3 px-3 pb-2 mb-1">
        <span className="text-white/30 text-[10px] uppercase tracking-widest text-right">#</span>
        <span className="text-white/30 text-[10px] uppercase tracking-widest">Team</span>
        <span className="text-white/30 text-[10px] uppercase tracking-widest text-center">Act.</span>
        <span className="text-white/30 text-[10px] uppercase tracking-widest text-center">Model</span>
        <span className="text-white/30 text-[10px] uppercase tracking-widest text-center">Δ</span>
      </div>

      <div className="space-y-1.5">
        {comparison.map(({ team, actual_position, projected_rank, projected_mean_position, position_delta }, i) => {
          const deltaColour =
            position_delta == null ? 'text-white/20' :
            position_delta < 0    ? 'text-green-400' :
            position_delta > 0    ? 'text-red-400'   :
                                    'text-white/40'

          return (
            <div
              key={team}
              className="grid grid-cols-[1.5rem_1fr_3rem_5rem_4rem] gap-x-3 px-3 py-2 rounded-xl bg-jet items-center"
            >
              <PositionBadge pos={actual_position} />
              <span className="text-white text-sm truncate">{team}</span>
              <span className="text-white/50 text-xs font-mono text-center">{actual_position}</span>
              <div className="flex flex-col items-center">
                <span className="text-white/50 text-xs font-mono">{projected_rank ?? '—'}</span>
                {projected_mean_position != null && (
                  <span className="text-white/20 text-[10px] font-mono">{fmt(projected_mean_position)}</span>
                )}
              </div>
              <span className={`text-xs font-mono text-center ${deltaColour}`}>
                {position_delta == null
                  ? '—'
                  : position_delta === 0
                  ? '0'
                  : position_delta > 0
                  ? `+${position_delta}`
                  : position_delta}
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-white/20 text-[10px] mt-3 text-center">
        Model column shows projected rank (mean position in small text). Δ = actual − projected rank. Positive means finishing lower than the model expected.
      </p>

      <div className="mt-4 flex flex-wrap gap-4 justify-center text-[10px] text-white/30">
        {actualUpdatedAt && (
          <span>Actual table: {new Date(actualUpdatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        )}
        {projectionUpdatedAt && (
          <span>Projection baseline: {new Date(projectionUpdatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ModelPredictions() {
  const { setPageLoading } = usePageLoading()

  const [season, setSeason]       = useState(null)
  const [tab, setTab]             = useState('projections') // 'projections' | 'compare'
  const [error, setError]         = useState(null)

  // Projections tab state
  const [projData, setProjData]       = useState(null)
  const [projUpdatedAt, setProjUpdatedAt] = useState(null)
  const [dateInput, setDateInput]     = useState('')
  const [dateError, setDateError]     = useState(null)
  const [dateFetching, setDateFetching] = useState(false)

  // Compare tab state
  const [compareData, setCompareData] = useState(null)
  const [compareDateInput, setCompareDateInput] = useState('')
  const [compareFetching, setCompareFetching]   = useState(false)
  const [compareError, setCompareError]         = useState(null)

  useLayoutEffect(() => { setPageLoading(true) }, [])

  // Initial load — get season then fetch latest projection
  useEffect(() => {
    async function load() {
      try {
        const { season: s } = await api.get('/api/standings/current-season')
        setSeason(s)
        const data = await api.get(`/api/standings/${s}/elo/latest`)
        setProjData(data.projections)
        setProjUpdatedAt(data.updated_at)
        setDateInput(toDateInput(data.updated_at))
      } catch (err) {
        setError(err.message)
      } finally {
        setPageLoading(false)
      }
    }
    load()
  }, [setPageLoading])

  // Load compare data when that tab is selected
  useEffect(() => {
    if (tab !== 'compare' || !season || compareData) return
    fetchCompare(season)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, season])

  async function fetchProjectionOnDate(s, dateStr) {
    setDateError(null)
    setDateFetching(true)
    try {
      const data = await api.get(`/api/standings/${s}/elo/on?date=${dateStr}`)
      setProjData(data.projections)
      setProjUpdatedAt(data.updated_at)
    } catch (err) {
      setDateError(err.message)
    } finally {
      setDateFetching(false)
    }
  }

  async function fetchCompare(s, dateStr) {
    setCompareError(null)
    setCompareFetching(true)
    try {
      const url = dateStr
        ? `/api/standings/${s}/elo/compare?date=${dateStr}`
        : `/api/standings/${s}/elo/compare`
      const data = await api.get(url)
      setCompareData(data)
    } catch (err) {
      setCompareError(err.message)
    } finally {
      setCompareFetching(false)
    }
  }

  function handleDateSubmit(e) {
    e.preventDefault()
    if (!dateInput || !season) return
    fetchProjectionOnDate(season, dateInput)
  }

  function handleCompareDateSubmit(e) {
    e.preventDefault()
    if (!season) return
    fetchCompare(season, compareDateInput || undefined)
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  const updatedLabel = projUpdatedAt
    ? new Date(projUpdatedAt).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 py-2">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-white text-2xl font-bold leading-tight">Model projections</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {season ? `${season} season` : '—'}
            {updatedLabel && tab === 'projections' && (
              <span className="ml-2 text-white/25">· snapshot {updatedLabel}</span>
            )}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        <TabButton active={tab === 'projections'} onClick={() => setTab('projections')}>
          Projections
        </TabButton>
        <TabButton active={tab === 'compare'} onClick={() => setTab('compare')}>
          vs Actual
        </TabButton>
      </div>

      {/* ── Projections tab ── */}
      {tab === 'projections' && (
        <div className="space-y-5">

          {/* Date picker */}
          <div className="bg-jet-dark rounded-2xl p-5">
            <SectionHeading>View projection on date</SectionHeading>
            <form onSubmit={handleDateSubmit} className="flex items-center gap-3 flex-wrap">
              <input
                type="date"
                value={dateInput}
                max={todayISO()}
                onChange={e => setDateInput(e.target.value)}
                className="bg-jet border border-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-teal/50 [color-scheme:dark]"
              />
              <button
                type="submit"
                disabled={dateFetching || !dateInput}
                className="bg-teal text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-teal/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {dateFetching ? 'Loading…' : 'Load'}
              </button>
              {season && (
                <button
                  type="button"
                  onClick={() => fetchProjectionOnDate(season, todayISO())}
                  className="text-teal-muted text-sm hover:text-white transition-colors"
                >
                  Reset to latest
                </button>
              )}
            </form>
            {dateError && <p className="text-red-400 text-xs mt-2">{dateError}</p>}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-[11px] text-white/40 px-1">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-400 inline-block" /> Title</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> Relegation</span>
          </div>

          {/* Table */}
          <div className="bg-jet-dark rounded-2xl p-5">
            <SectionHeading>Finish probability — all 20 teams</SectionHeading>
            <ProjectionsTable projections={projData} />
          </div>

          {/* Methodology note */}
          <div className="bg-jet-dark/50 rounded-2xl px-5 py-4 border border-white/5">
            <p className="text-white/30 text-xs leading-relaxed">
              Projections are produced by a Monte Carlo simulation (10 000 runs) using ELO ratings over historical data.
              Remaining fixtures are sampled from three-way match probabilities derived from each team's current rating.
              The model updates whenever the actual table changes.
            </p>
          </div>
        </div>
      )}

      {/* ── Compare tab ── */}
      {tab === 'compare' && (
        <div className="space-y-5">

          {/* Date picker */}
          <div className="bg-jet-dark rounded-2xl p-5">
            <SectionHeading>Pin to a specific date</SectionHeading>
            <p className="text-white/30 text-xs mb-3">
              By default, actual standings are compared against the very first projection of the season — the model's view before any ball was kicked.
              Select a date to compare both snapshots at that point in time instead.
            </p>
            <form onSubmit={handleCompareDateSubmit} className="flex items-center gap-3 flex-wrap">
              <input
                type="date"
                value={compareDateInput}
                max={todayISO()}
                onChange={e => setCompareDateInput(e.target.value)}
                className="bg-jet border border-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-teal/50 [color-scheme:dark]"
              />
              <button
                type="submit"
                disabled={compareFetching}
                className="bg-teal text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-teal/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {compareFetching ? 'Loading…' : compareDateInput ? 'Load date' : 'Load baseline'}
              </button>
              {compareDateInput && (
                <button
                  type="button"
                  onClick={() => {
                    setCompareDateInput('')
                    setCompareData(null)
                    fetchCompare(season)
                  }}
                  className="text-teal-muted text-sm hover:text-white transition-colors"
                >
                  Reset to baseline
                </button>
              )}
            </form>
            {compareError && <p className="text-red-400 text-xs mt-2">{compareError}</p>}
          </div>

          {/* Table */}
          <div className="bg-jet-dark rounded-2xl p-5">
            <SectionHeading>
              {compareDateInput
                ? `Actual vs projection — on ${compareDateInput}`
                : 'Actual vs pre-season projection'}
            </SectionHeading>
            {compareFetching ? (
              <p className="text-white/30 text-sm text-center py-8">Loading…</p>
            ) : compareData ? (
              <CompareTable
                comparison={compareData.comparison}
                actualUpdatedAt={compareData.actual?.updated_at}
                projectionUpdatedAt={compareData.projection?.updated_at}
              />
            ) : (
              <p className="text-white/30 text-sm text-center py-8">Loading comparison…</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
