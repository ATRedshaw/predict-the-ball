import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../authState'

const JOURNEY_STEPS = [
  { id: 'predict', number: '01', label: 'Predict' },
  { id: 'lock', number: '02', label: 'Deadline' },
  { id: 'score', number: '03', label: 'Scoring' },
  { id: 'compete', number: '04', label: 'Leagues' },
  { id: 'explore', number: '05', label: 'Features' },
]

const DEFAULT_TEAMS = [
  'Arsenal',
  'Liverpool',
  'Manchester City',
  'Chelsea',
  'Newcastle United',
  'Aston Villa',
]

const SCORING_ACTUAL = [
  'Arsenal',
  'Liverpool',
  'Chelsea',
  'Manchester City',
  'Newcastle United',
  'Aston Villa',
]

const SCORING_START = [
  'Liverpool',
  'Arsenal',
  'Manchester City',
  'Chelsea',
  'Newcastle United',
  'Aston Villa',
]

const FAQS = [
  {
    question: 'Can a prediction be changed after it is saved?',
    answer: 'Yes. The table can be reordered and saved again at any time before the deadline. The latest saved version becomes final 90 minutes before the opening fixture.',
  },
  {
    question: 'Do I need a different prediction for every league?',
    answer: 'No. There is one prediction per account for each season. That same table is used for the global ranking and every private league joined during that season.',
  },
  {
    question: 'What happens if I miss the deadline?',
    answer: 'New predictions and edits are not accepted after the deadline, which is 90 minutes before the opening fixture. The dashboard remains available, but the account will have no score for that season.',
  },
  {
    question: 'When do scores and tables update?',
    answer: 'The Premier League table, prediction scores and model snapshots are refreshed daily when new results are available. Each relevant screen shows when its data last changed.',
  },
  {
    question: 'What happens when two players have the same score?',
    answer: 'The player with more clubs in exactly the correct position ranks higher. If both the total score and exact-position count match, the players share the same rank.',
  },
  {
    question: 'Can I see another player’s prediction?',
    answer: 'Predictions are hidden from other players while entries are open. After the deadline, league members can open one another’s tables and compare every position.',
  },
  {
    question: 'Are there limits on private leagues?',
    answer: 'An account can own up to 10 leagues and belong to up to 30 leagues in a season. League owners can share invites, remove members, transfer ownership or delete a current-season league.',
  },
  {
    question: 'Can PredictTheBall be installed?',
    answer: 'Yes. On supported mobile browsers it can be installed as a progressive web app. After sign-in, follow the install prompt or use the browser’s Add to Home Screen option.',
  },
]

function Reveal({ children, className = '' }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.12 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={`guide-reveal ${visible ? 'is-visible' : ''} ${className}`}>
      {children}
    </div>
  )
}

function ArrowIcon({ direction }) {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <path d={direction === 'up' ? 'm5 12 5-5 5 5' : 'm5 8 5 5 5-5'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="9" y="21" width="30" height="21" rx="6" />
      <path d="M16 21v-7a8 8 0 0 1 16 0v7" />
      <path d="M24 29v6" strokeLinecap="round" />
    </svg>
  )
}

function JourneyNav({ activeStep, onSelect }) {
  return (
    <div className="sticky top-3 z-30 my-6 rounded-2xl border border-white/10 bg-jet-dark/90 p-2 shadow-2xl backdrop-blur-xl md:top-4 md:my-8 md:p-3">
      <div className="relative grid grid-cols-5 gap-1">
        <div className="pointer-events-none absolute left-[10%] right-[10%] top-4 hidden h-px bg-white/10 sm:block" />
        {JOURNEY_STEPS.map(step => {
          const isActive = step.id === activeStep
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onSelect(step.id)}
              aria-current={isActive ? 'step' : undefined}
              className={`relative flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-center transition-colors sm:flex-row sm:justify-center sm:gap-2 sm:px-3 ${
                isActive
                  ? 'bg-teal text-white'
                  : 'text-white/35 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] ${
                isActive ? 'bg-white text-teal' : 'bg-jet-dark ring-1 ring-white/10'
              }`}>
                {step.number}
              </span>
              <span className="truncate text-[10px] font-semibold sm:text-xs">{step.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function HeroTable({ teams }) {
  const deltas = [0, 2, -1, 1, -2, 0]

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="guide-orbit guide-orbit-one" />
      <div className="guide-orbit guide-orbit-two" />
      <div className="relative rounded-[1.75rem] border border-white/10 bg-jet-dark/90 p-4 shadow-2xl backdrop-blur sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-teal-muted">Example entry</p>
            <p className="mt-1 text-sm font-semibold text-white">Predicted table</p>
          </div>
          <span className="guide-live-chip rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-[10px] font-medium text-teal-muted">
            Editable
          </span>
        </div>

        <div className="space-y-1.5">
          {teams.map((team, index) => (
            <div
              key={team}
              className="guide-table-row grid grid-cols-[1.75rem_1fr_2.5rem] items-center gap-2 rounded-xl border border-white/[0.04] bg-jet px-3 py-2.5"
              style={{ '--guide-row': index }}
            >
              <span className={`font-mono text-xs ${index === 0 ? 'text-yellow-400' : 'text-white/35'}`}>
                {index + 1}
              </span>
              <span className="truncate text-xs font-medium text-white">{team}</span>
              <span className={`text-right font-mono text-[10px] ${
                deltas[index] === 0 ? 'text-teal-muted' : deltas[index] > 0 ? 'text-red-300' : 'text-green-300'
              }`}>
                {deltas[index] === 0 ? 'exact' : `${deltas[index] > 0 ? '+' : ''}${deltas[index]}`}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-3 text-center text-[9px] text-white/20">+ 14 clubs in the full prediction</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/[0.04] p-3">
            <p className="text-[9px] uppercase tracking-widest text-white/25">Live score</p>
            <p className="mt-1 font-mono text-xl font-bold text-white">42 <span className="text-xs font-normal text-white/30">pts</span></p>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-3">
            <p className="text-[9px] uppercase tracking-widest text-white/25">Global rank</p>
            <p className="mt-1 font-mono text-xl font-bold text-white">#12</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function PredictionBuilder({ teams }) {
  return (
    <div className="relative rounded-2xl border border-white/8 bg-jet-dark p-4 shadow-xl sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-teal-muted">Prediction builder</p>
          <p className="mt-1 text-sm font-semibold text-white">Drag into finishing order</p>
        </div>
        <span className="rounded-full bg-teal/10 px-2.5 py-1 text-[10px] text-teal">Open</span>
      </div>

      <div className="space-y-1.5">
        {teams.slice(0, 5).map((team, index) => (
          <div
            key={team}
            className={`flex items-center gap-3 rounded-xl bg-jet px-3 py-2.5 ${index === 2 ? 'guide-demo-drag border border-teal/30 shadow-lg' : ''}`}
          >
            <span className="text-sm text-white/20">⠿</span>
            <span className={`w-4 font-mono text-xs ${index === 0 ? 'text-yellow-400' : 'text-white/35'}`}>{index + 1}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-white">{team}</span>
            {index === 0 && <span className="text-[9px] uppercase tracking-wider text-yellow-400/60">Champion</span>}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-teal/15 bg-teal/8 px-3 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal text-sm text-white">✓</span>
        <div>
          <p className="text-xs font-medium text-white">One saved table</p>
          <p className="mt-0.5 text-[10px] text-white/35">Used globally and in every private league</p>
        </div>
      </div>
    </div>
  )
}

function ScoringLab() {
  const [prediction, setPrediction] = useState(SCORING_START)

  const result = useMemo(() => {
    const rows = prediction.map((team, index) => {
      const actualPosition = SCORING_ACTUAL.indexOf(team) + 1
      return {
        team,
        actualPosition,
        error: Math.abs(index + 1 - actualPosition),
      }
    })
    return {
      rows,
      total: rows.reduce((sum, row) => sum + row.error, 0),
      exact: rows.filter(row => row.error === 0).length,
    }
  }, [prediction])

  const maxScore = SCORING_ACTUAL.reduce(
    (sum, team, index) => sum + Math.abs(index + 1 - (SCORING_ACTUAL.length - SCORING_ACTUAL.indexOf(team))),
    0,
  )

  function moveTeam(index, direction) {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= prediction.length) return

    setPrediction(current => {
      const next = [...current]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return next
    })
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/8 bg-jet-dark shadow-2xl">
      <div className="grid border-b border-white/8 lg:grid-cols-[1fr_19rem]">
        <div className="p-5 sm:p-7">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-teal-muted">Interactive scoring example</p>
          <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl">One point for every place of error.</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">
            Move the predicted clubs below. The actual table stays fixed while the score recalculates instantly. This demo uses six clubs; the real game totals all 20.
          </p>
        </div>

        <div className="border-t border-white/8 bg-teal p-5 lg:border-l lg:border-t-0 sm:p-7">
          <p className="text-[10px] font-medium uppercase tracking-widest text-mist/70">Your demo score</p>
          <div className="mt-2 flex items-end gap-3" aria-live="polite">
            <span key={result.total} className="guide-score-pop font-mono text-5xl font-bold leading-none text-white">{result.total}</span>
            <span className="pb-1 text-sm text-mist">points</span>
          </div>
          <p className="mt-3 text-xs text-mist/80">{result.exact} of 6 positions exact</p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-jet/20">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-500"
              style={{ width: result.total === 0 ? '0%' : `${Math.max(4, (result.total / maxScore) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] text-mist/60">Shorter bar, better score</p>
        </div>
      </div>

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1fr_1fr]">
        <div>
          <div className="mb-2 grid grid-cols-[2rem_1fr_3rem_4rem] gap-2 px-3 text-[9px] uppercase tracking-widest text-white/25">
            <span>#</span>
            <span>Your prediction</span>
            <span className="text-center">Cost</span>
            <span className="text-center">Move</span>
          </div>
          <div className="space-y-1.5">
            {result.rows.map((row, index) => (
              <div key={row.team} className="grid grid-cols-[2rem_1fr_3rem_4rem] items-center gap-2 rounded-xl bg-jet px-3 py-2.5">
                <span className={`font-mono text-xs ${index === 0 ? 'text-yellow-400' : 'text-white/35'}`}>{index + 1}</span>
                <span className="min-w-0 truncate text-xs font-medium text-white">{row.team}</span>
                <span className={`text-center font-mono text-[10px] ${row.error === 0 ? 'text-teal-muted' : 'text-red-300'}`}>
                  {row.error === 0 ? '0' : `+${row.error}`}
                </span>
                <span className="flex justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveTeam(index, -1)}
                    disabled={index === 0}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/8 text-white/40 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-15"
                    aria-label={`Move ${row.team} up`}
                  >
                    <ArrowIcon direction="up" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveTeam(index, 1)}
                    disabled={index === result.rows.length - 1}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/8 text-white/40 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-15"
                    aria-label={`Move ${row.team} down`}
                  >
                    <ArrowIcon direction="down" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 grid grid-cols-[2rem_1fr_4rem] gap-2 px-3 text-[9px] uppercase tracking-widest text-white/25">
            <span>#</span>
            <span>Actual table</span>
            <span className="text-right">Difference</span>
          </div>
          <div className="space-y-1.5">
            {SCORING_ACTUAL.map((team, index) => {
              const predictedPosition = prediction.indexOf(team) + 1
              const error = Math.abs(predictedPosition - (index + 1))
              return (
                <div key={team} className="grid grid-cols-[2rem_1fr_4rem] items-center gap-2 rounded-xl bg-white/[0.035] px-3 py-2.5">
                  <span className={`font-mono text-xs ${index === 0 ? 'text-yellow-400' : 'text-white/35'}`}>{index + 1}</span>
                  <span className="min-w-0 truncate text-xs text-white/65">{team}</span>
                  <span className={`text-right text-[10px] ${error === 0 ? 'text-teal-muted' : 'text-white/35'}`}>
                    {error === 0 ? 'exact' : `${error} place${error === 1 ? '' : 's'}`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-white/8 bg-jet/35 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <code className="text-xs text-teal-muted">score = Σ | predicted position − actual position |</code>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPrediction(SCORING_ACTUAL)}
            className="rounded-lg bg-teal px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-muted"
          >
            Make every pick exact
          </button>
          <button
            type="button"
            onClick={() => setPrediction([...SCORING_ACTUAL].reverse())}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/50 transition-colors hover:bg-white/5 hover:text-white"
          >
            Reverse the table
          </button>
          <button
            type="button"
            onClick={() => setPrediction(SCORING_START)}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/50 transition-colors hover:bg-white/5 hover:text-white"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}

function LeaguePreview() {
  const [phase, setPhase] = useState('open')
  const openRows = [
    { name: 'You', status: 'Submitted' },
    { name: 'Jordan', status: 'Submitted' },
    { name: 'Priya', status: 'Waiting' },
    { name: 'Sam', status: 'Submitted' },
  ]
  const liveRows = [
    { name: 'Priya', points: 38, exact: 4 },
    { name: 'You', points: 42, exact: 3 },
    { name: 'Sam', points: 42, exact: 2 },
    { name: 'Jordan', points: 50, exact: 2 },
  ]

  return (
    <div className="rounded-2xl border border-white/8 bg-jet-dark p-4 shadow-xl sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-teal-muted">Weekend League</p>
          <p className="mt-1 text-sm font-semibold text-white">4 members · 2026–27</p>
        </div>
        <span className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 font-mono text-[10px] tracking-widest text-white/45">K8PL2Q</span>
      </div>

      <div className="mt-4 grid grid-cols-2 rounded-xl bg-jet p-1">
        <button
          type="button"
          onClick={() => setPhase('open')}
          className={`rounded-lg px-3 py-2 text-[10px] font-semibold transition-colors ${phase === 'open' ? 'bg-teal text-white' : 'text-white/35 hover:text-white'}`}
        >
          Entries open
        </button>
        <button
          type="button"
          onClick={() => setPhase('live')}
          className={`rounded-lg px-3 py-2 text-[10px] font-semibold transition-colors ${phase === 'live' ? 'bg-teal text-white' : 'text-white/35 hover:text-white'}`}
        >
          After deadline
        </button>
      </div>

      <div className="mt-4 space-y-2" aria-live="polite">
        {phase === 'open'
          ? openRows.map(({ name, status }) => (
              <div key={name} className={`flex items-center gap-3 rounded-xl px-3 py-3 ${name === 'You' ? 'border border-teal/20 bg-teal/10' : 'bg-jet'}`}>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-[10px] text-white/30">?</span>
                <span className="flex-1 text-xs font-medium text-white">{name}</span>
                <span className={`text-[10px] ${status === 'Submitted' ? 'text-teal-muted' : 'text-white/25'}`}>{status}</span>
              </div>
            ))
          : liveRows.map(({ name, points, exact }, index) => (
              <div key={name} className={`guide-league-row flex items-center gap-3 rounded-xl px-3 py-3 ${name === 'You' ? 'border border-teal/20 bg-teal/10' : 'bg-jet'}`} style={{ '--guide-row': index }}>
                <span className={`w-6 text-center font-mono text-xs font-bold ${index === 0 ? 'text-yellow-400' : 'text-white/35'}`}>{index + 1}</span>
                <span className="flex-1 text-xs font-medium text-white">{name}</span>
                <span className="text-right">
                  <span className="block font-mono text-xs font-bold text-white">{points} pts</span>
                  <span className="block font-mono text-[9px] text-teal-muted">{exact} exact</span>
                </span>
              </div>
            ))
        }
      </div>

      <p className="mt-4 text-center text-[10px] leading-4 text-white/25">
        {phase === 'open'
          ? 'Scores and other players’ tables remain hidden while entries are open.'
          : 'Lower points rank first. The 42-point tie is decided by the number of exact positions.'}
      </p>
    </div>
  )
}

function ModelPreview() {
  const rows = [
    { team: 'Arsenal', position: 1, mean: 1.8, title: 54, colour: 'bg-yellow-400' },
    { team: 'Liverpool', position: 2, mean: 2.4, title: 31, colour: 'bg-teal' },
    { team: 'Manchester City', position: 3, mean: 3.6, title: 12, colour: 'bg-teal-muted' },
    { team: 'Chelsea', position: 4, mean: 4.9, title: 3, colour: 'bg-white/35' },
  ]

  return (
    <div className="rounded-2xl border border-white/8 bg-jet-dark p-4 shadow-xl sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-teal-muted">10,000 season simulations</p>
          <p className="mt-1 text-sm font-semibold text-white">Projected finishing order</p>
        </div>
        <span className="guide-model-pulse mt-1 h-2 w-2 rounded-full bg-green-400" />
      </div>

      <div className="space-y-3">
        {rows.map(({ team, position, mean, title, colour }, index) => (
          <div key={team} className="grid grid-cols-[1.5rem_1fr_2.75rem] items-center gap-2">
            <span className={`font-mono text-xs ${position === 1 ? 'text-yellow-400' : 'text-white/35'}`}>{position}</span>
            <div className="min-w-0">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-white">{team}</span>
                <span className="font-mono text-[9px] text-white/25">mean {mean}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                <div
                  className={`guide-model-bar h-full rounded-full ${colour}`}
                  style={{ '--guide-width': `${title}%`, '--guide-row': index }}
                />
              </div>
            </div>
            <span className="text-right font-mono text-[10px] text-white/50">{title}%</span>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          ['Title', '54%'],
          ['Top four', '89%'],
          ['Relegation', '0.2%'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-jet px-2 py-3 text-center">
            <p className="font-mono text-sm font-bold text-white">{value}</p>
            <p className="mt-1 text-[9px] text-white/25">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepHeader({ number, label, title, children }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-teal">{number}</span>
        <span className="h-px w-8 bg-teal/50" />
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-teal-muted">{label}</span>
      </div>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
      {children && <div className="mt-4 max-w-2xl text-sm leading-7 text-white/50">{children}</div>}
    </div>
  )
}

function HowItWorks() {
  const { accessToken } = useAuth()
  const isLoggedIn = Boolean(accessToken)
  const [activeStep, setActiveStep] = useState('predict')
  const [seasonInfo, setSeasonInfo] = useState(null)
  const [teams, setTeams] = useState(DEFAULT_TEAMS)

  useEffect(() => {
    let cancelled = false

    async function loadSeason() {
      try {
        const { season } = await api.get('/api/standings/current-season')
        const [deadline, teamData] = await Promise.all([
          api.get(`/api/standings/${season}/deadline`),
          api.get(`/api/standings/${season}/teams`),
        ])
        if (cancelled) return
        setSeasonInfo({ season, ...deadline })
        if (teamData.teams?.length >= 6) {
          setTeams(teamData.teams.slice(0, 6))
        }
      } catch {
        if (!cancelled) setSeasonInfo(null)
      }
    }

    loadSeason()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const sections = JOURNEY_STEPS
      .map(step => document.getElementById(step.id))
      .filter(Boolean)

    if (typeof IntersectionObserver === 'undefined') return undefined

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target.id) setActiveStep(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -58% 0px', threshold: [0, 0.15, 0.35, 0.6] },
    )

    sections.forEach(section => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  const deadlineLabel = seasonInfo?.deadline
    ? new Date(seasonInfo.deadline).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : null

  const primaryCta = !isLoggedIn
    ? { to: '/signup', label: 'Create a free account' }
    : seasonInfo?.kicked_off
      ? { to: '/dashboard', label: 'Open dashboard' }
      : { to: '/predictions', label: 'Open predictions' }

  function scrollToStep(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="mx-auto w-full max-w-7xl">
      <section className="relative overflow-hidden rounded-3xl bg-teal px-6 py-10 sm:px-9 sm:py-12 lg:px-12 lg:py-16">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-jet/20" />
        <div className="absolute -bottom-32 left-1/3 h-80 w-80 rounded-full border border-white/10" />
        <div className="guide-hero-grid absolute inset-0 opacity-20" />

        <div className="relative grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-jet px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-muted">
                How it works
              </span>
              <span className="rounded-full border border-white/20 px-3 py-1.5 text-[10px] font-medium text-white/75">
                {seasonInfo
                  ? `${seasonInfo.season} · ${seasonInfo.kicked_off ? 'Predictions locked' : 'Predictions open'}`
                  : 'One prediction · all 20 clubs'}
              </span>
            </div>

            <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Predict the Premier League table.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-mist/85 sm:text-lg">
              Submit a complete finishing order before the deadline. Scores are calculated against the current table throughout the season, and the lowest total ranks first.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={primaryCta.to}
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-jet transition-colors hover:bg-bone"
              >
                {primaryCta.label}
              </Link>
              <button
                type="button"
                onClick={() => scrollToStep('score')}
                className="rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                See the scoring example
              </button>
            </div>

            <div className="mt-9 grid max-w-xl grid-cols-3 gap-3">
              {[
                ['20', 'clubs ranked'],
                ['90m', 'before first fixture'],
                ['Low', 'total ranks first'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-jet/10 px-3 py-3 backdrop-blur">
                  <p className="font-mono text-xl font-bold text-white">{value}</p>
                  <p className="mt-1 text-[10px] text-mist/65">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <HeroTable teams={teams} />
        </div>
      </section>

      <JourneyNav activeStep={activeStep} onSelect={scrollToStep} />

      <section id="predict" className="scroll-mt-28 py-14 sm:py-20">
        <Reveal className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <StepHeader number="01" label="Predict" title="Submit one complete table.">
              Create an account, confirm the email address and rank all 20 clubs from 1st to 20th.
            </StepHeader>

            <ol className="mt-7 space-y-4">
              {[
                ['Create your account', 'Registration is free. A six-digit email code confirms the address before the first sign-in.'],
                ['Order all 20 clubs', 'The list starts alphabetically. Drag each club into its predicted finishing position, from champions at 1st to the relegation places at 18th–20th.'],
                ['Review and update', 'A submitted table can be edited as often as needed before the deadline.'],
              ].map(([title, copy], index) => (
                <li key={title} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-teal/30 bg-teal/10 font-mono text-[10px] text-teal-muted">{index + 1}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-white/40">{copy}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <PredictionBuilder teams={teams} />
        </Reveal>
      </section>

      <section id="lock" className="scroll-mt-28 py-14 sm:py-20">
        <Reveal>
          <div className="overflow-hidden rounded-3xl border border-white/8 bg-jet-dark">
            <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
              <div className="relative flex min-h-80 items-center justify-center overflow-hidden bg-bone p-8 text-jet">
                <div className="guide-lock-ring absolute h-64 w-64 rounded-full border border-teal/20" />
                <div className="guide-lock-ring guide-lock-ring-two absolute h-44 w-44 rounded-full border border-teal/30" />
                <div className="relative text-center">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-teal text-white shadow-2xl">
                    <LockIcon />
                  </div>
                  <p className="mt-6 text-[10px] font-medium uppercase tracking-[0.2em] text-teal">Prediction deadline</p>
                  <p className="mt-2 max-w-xs text-lg font-bold">
                    {deadlineLabel ?? '90 minutes before the opening fixture'}
                  </p>
                  {seasonInfo && (
                    <span className={`mt-4 inline-flex rounded-full px-3 py-1 text-[10px] font-semibold ${
                      seasonInfo.kicked_off ? 'bg-red-500/10 text-red-700' : 'bg-teal/10 text-teal'
                    }`}>
                      {seasonInfo.kicked_off ? 'Locked for this season' : 'Entries currently open'}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-6 sm:p-9 lg:p-12">
                <StepHeader number="02" label="Deadline" title="Predictions close before the first fixture.">
                  The deadline is 90 minutes before the opening Premier League fixture. No new prediction or edit can be accepted after that time.
                </StepHeader>

                <div className="relative mt-8 space-y-6 pl-8">
                  <div className="guide-timeline-line absolute bottom-3 left-3 top-3 w-px bg-white/10" />
                  {[
                    ['Entries open', 'Submit and update freely. Other users can see that an entry exists, but not the order of the clubs.'],
                    ['90 minutes before kick-off', 'The latest saved version locks automatically. Accounts without a submitted prediction cannot enter late.'],
                    ['After the deadline', 'Predictions become visible. Scores and rankings are calculated as current table data becomes available.'],
                  ].map(([title, copy], index) => (
                    <div key={title} className="relative">
                      <span className={`absolute -left-8 top-0.5 h-3 w-3 rounded-full ring-4 ring-jet-dark ${index === 1 ? 'bg-red-400' : 'bg-teal'}`} />
                      <p className="text-sm font-semibold text-white">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-white/40">{copy}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <section id="score" className="scroll-mt-28 py-14 sm:py-20">
        <Reveal>
          <StepHeader number="03" label="Scoring" title="Scores measure positional error.">
            The calculation uses league positions rather than Premier League points or individual match scores. Each club’s distance from its predicted position is added to the total; zero is perfect and lower is better.
          </StepHeader>

          <div className="mt-8">
            <ScoringLab />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              ['All 20 clubs are included', 'There are no position weightings or bonuses. A club ten places away contributes ten points.'],
              ['Scores use the current table', 'Totals can rise or fall throughout the season as the Premier League standings change.'],
              ['Exact picks break ties', 'If totals match, more clubs in exactly the right position wins. Equal totals and exact counts share a rank.'],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-2 text-xs leading-5 text-white/40">{copy}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section id="compete" className="scroll-mt-28 py-14 sm:py-20">
        <Reveal className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <StepHeader number="04" label="Leagues" title="Global and private league rankings.">
              One saved prediction is used for the global ranking and every private league joined by the account during that season.
            </StepHeader>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {[
                ['Create', 'Name a league and receive an eight-character invite code.'],
                ['Invite', 'Copy the code or share a direct invitation link with friends.'],
                ['Join', 'Enter another league’s code. The existing seasonal prediction is used automatically.'],
                ['Compare', 'Open member tables after the deadline and follow league and global rankings.'],
              ].map(([title, copy], index) => (
                <div key={title} className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-teal">0{index + 1}</span>
                    <p className="text-xs font-semibold text-white">{title}</p>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-white/35">{copy}</p>
                </div>
              ))}
            </div>

            <p className="mt-5 text-xs leading-5 text-white/35">
              League owners can manage membership and transfer ownership. Past-season leagues remain in history so the final standings and predictions are not lost.
            </p>
          </div>

          <LeaguePreview />
        </Reveal>
      </section>

      <section id="explore" className="scroll-mt-28 py-14 sm:py-20">
        <Reveal>
          <StepHeader number="05" label="Features" title="Dashboard, standings, history and projections.">
            The dashboard summarises the current season. Separate views provide the full standings, prediction comparisons, past seasons and model projections.
          </StepHeader>

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              ['Dashboard', 'See the current score, global rank, league positions, saved prediction and previous seasons in one place.'],
              ['Live table', 'Follow the Premier League standings used for scoring, including match records, goal difference and any points deductions.'],
              ['Prediction history', 'Revisit past tables, final scores, exact picks and global or private-league finishes.'],
              ['Install the app', 'Add PredictTheBall to a supported phone’s home screen for a focused, app-like experience.'],
            ].map(([title, copy], index) => (
              <div key={title} className={`rounded-2xl p-5 ${index === 0 ? 'bg-teal text-white' : index === 2 ? 'bg-bone text-jet' : 'border border-white/8 bg-jet-dark text-white'}`}>
                <span className={`font-mono text-[10px] ${index === 0 ? 'text-mist' : index === 2 ? 'text-teal' : 'text-teal-muted'}`}>0{index + 1}</span>
                <p className="mt-4 text-sm font-bold">{title}</p>
                <p className={`mt-2 text-xs leading-5 ${index === 0 ? 'text-mist/75' : index === 2 ? 'text-jet/60' : 'text-white/40'}`}>{copy}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid items-center gap-8 overflow-hidden rounded-3xl border border-white/8 bg-jet-dark p-5 sm:p-7 lg:grid-cols-[1fr_1fr] lg:gap-12 lg:p-10">
            <div>
              <span className="inline-flex rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-teal-muted">The forecasting model</span>
              <h3 className="mt-4 text-2xl font-bold text-white">How the forecasting model is calculated.</h3>
              <p className="mt-4 text-sm leading-6 text-white/45">
                After kick-off, the Elo model combines historical results with the current season, accounting for home advantage, winning margin and off-season rating changes. It simulates the remaining fixtures 10,000 times for each snapshot.
              </p>
              <ul className="mt-5 space-y-3 text-xs leading-5 text-white/40">
                <li className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />See each club’s mean finish and probability for every position from 1st to 20th.</li>
                <li className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />Explore title chances, top-four likelihood, relegation risk and older projection dates.</li>
                <li className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />Compare your score with the model’s indicative score and hypothetical global rank.</li>
              </ul>
              <p className="mt-5 rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3 text-[11px] leading-5 text-white/35">
                The model is a benchmark only. It never changes a player’s score and is not betting advice.
              </p>
            </div>

            <ModelPreview />
          </div>
        </Reveal>
      </section>

      <section className="py-14 sm:py-20" aria-labelledby="guide-faq-title">
        <Reveal>
          <div className="grid gap-8 lg:grid-cols-[0.55fr_1fr] lg:gap-16">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-teal-muted">Reference</p>
              <h2 id="guide-faq-title" className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">Frequently asked questions.</h2>
              <p className="mt-4 text-sm leading-6 text-white/40">Submission, scoring, leagues and account access.</p>
            </div>

            <div className="space-y-2">
              {FAQS.map(({ question, answer }) => (
                <details key={question} className="group rounded-2xl border border-white/8 bg-jet-dark open:border-teal/25 open:bg-teal/[0.04]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-white marker:content-none">
                    {question}
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/5 text-lg font-light text-teal-muted transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="px-5 pb-5 pr-14 text-xs leading-6 text-white/45">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <Reveal className="pb-6 pt-8">
        <section className="relative overflow-hidden rounded-3xl bg-teal px-6 py-10 text-center sm:px-10 sm:py-14">
          <div className="guide-cta-ball absolute -right-8 -top-10 h-36 w-36 rounded-full border-[18px] border-white/5" />
          <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-jet/10" />
          <div className="relative mx-auto max-w-2xl">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-mist/65">Predictions</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Submit your table before the deadline.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-mist/75">
              The same saved prediction is used for the global ranking and every private league throughout the season.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link to={primaryCta.to} className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-jet transition-colors hover:bg-bone">
                {primaryCta.label}
              </Link>
              {!isLoggedIn && (
                <Link to="/login" className="rounded-xl border border-white/25 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                  Log in
                </Link>
              )}
            </div>
          </div>
        </section>
      </Reveal>
    </main>
  )
}

export default HowItWorks
