import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { Link, useBeforeUnload, useBlocker } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '../api'
import DeadlineCountdown from '../components/DeadlineCountdown'
import { usePageLoading } from '../components/PageLoadingContext'

// ---------------------------------------------------------------------------
// Sortable row
// ---------------------------------------------------------------------------

/**
 * A single draggable team row in the predictions list.
 *
 * @param {{ id: string, position: number, name: string, disabled: boolean }} props
 */
function SortableTeamRow({ id, position, name, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const positionColour =
    position === 1  ? 'text-yellow-400' :
    position >= 18  ? 'text-red-400'    :
    'text-white/50'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'flex items-center gap-3 rounded-xl px-3 py-2.5 select-none',
        isDragging
          ? 'bg-teal/20 border border-teal/40 shadow-lg z-50'
          : 'bg-jet hover:bg-jet-dark',
        disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
      ].join(' ')}
    >
      {/* drag handle */}
      {!disabled && (
        <span
          {...attributes}
          {...listeners}
          className="text-white/20 hover:text-white/50 transition-colors pr-1 touch-none"
          aria-label="Drag to reorder"
        >
          ⠿
        </span>
      )}

      <span className={`font-mono text-xs w-5 text-right shrink-0 ${positionColour}`}>
        {position}
      </span>

      {/* position badge for top 4 / relegation zone */}
      <span className={`text-white text-sm flex-1 ${disabled ? 'opacity-60' : ''}`}>
        {name}
      </span>

      {position === 1 && (
        <span className="text-[10px] text-yellow-400/50 uppercase tracking-wider">
          Champion
        </span>
      )}
      {position >= 18 && (
        <span className="text-[10px] text-red-400/60 uppercase tracking-wider">
          Relegated
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Zone dividers
// ---------------------------------------------------------------------------

function ZoneDivider({ label, lineColour }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <div className={`h-px flex-1 ${lineColour}`} />
      <span className="text-[10px] uppercase tracking-widest text-white/50">
        {label}
      </span>
      <div className={`h-px flex-1 ${lineColour}`} />
    </div>
  )
}

function UnsavedChangesModal({ onStay, onLeave }) {
  const modalRef = useRef(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onStay()
        return
      }

      if (event.key !== 'Tab') return

      const buttons = modalRef.current?.querySelectorAll('button') ?? []
      const firstButton = buttons[0]
      const lastButton = buttons[buttons.length - 1]

      if (event.shiftKey && document.activeElement === firstButton) {
        event.preventDefault()
        lastButton?.focus()
      } else if (!event.shiftKey && document.activeElement === lastButton) {
        event.preventDefault()
        firstButton?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [onStay])

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        aria-describedby="unsaved-changes-description"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-jet-dark p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-400/10 text-red-400">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.3 3.7 2.2 18a2 2 0 0 0 1.8 3h16a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
            </svg>
          </div>

          <div>
            <h2 id="unsaved-changes-title" className="text-lg font-semibold text-white sm:text-xl">
              Leave without saving?
            </h2>
            <p id="unsaved-changes-description" className="mt-2 text-sm leading-6 text-white/60">
              Your prediction changes haven’t been saved. If you leave now, those changes will be lost.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onStay}
            autoFocus
            className="min-h-11 flex-1 rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-muted focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2 focus:ring-offset-jet-dark"
          >
            Stay on page
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="min-h-11 flex-1 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-400/20 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-jet-dark"
          >
            Leave without saving
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

/**
 * Page states:
 *  loading   — fetching season/deadline/prediction data
 *  pre-season — deadline not yet reached; user can submit/edit a prediction
 *  in-season  — deadline has passed; show existing prediction or placeholder
 *  error      — something went wrong
 */
export default function Predictions() {
  const { setPageLoading } = usePageLoading()
  const [pageState, setPageState]   = useState('loading')
  const [season,    setSeason]      = useState(null)
  const [deadline,  setDeadline]    = useState(null)
  const [teams,     setTeams]       = useState([])   // ordered list of team name strings
  const [baselineTeams, setBaselineTeams] = useState([])
  const [saved,     setSaved]       = useState(null) // saved prediction from server, or null
  const [saving,    setSaving]      = useState(false)
  const [saveError, setSaveError]   = useState('')
  const [saveOk,    setSaveOk]      = useState(false)
  const [actualStandings, setActualStandings] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  const dirty = pageState === 'pre-season' && (
    teams.length !== baselineTeams.length ||
    teams.some((team, index) => team !== baselineTeams[index])
  )
  const blocker = useBlocker(dirty)

  useBeforeUnload(useCallback(event => {
    if (!dirty) return
    event.preventDefault()
    event.returnValue = ''
  }, [dirty]))

  useLayoutEffect(() => {
    setPageLoading(true)
  }, [])

  // ── fetch all data on mount ──────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const { season: s } = await api.get('/api/standings/current-season')
        setSeason(s)

        const [deadlineData, predictionResult, teamsData] = await Promise.all([
          api.get(`/api/standings/${s}/deadline`),
          api.get(`/api/predictions/${s}`).catch(err => ({ _err: err.message })),
          api.get(`/api/standings/${s}/teams`),
        ])

        const kickedOff = deadlineData.kicked_off
        setDeadline(deadlineData.deadline)

        const existingPrediction = predictionResult._err ? null : predictionResult.standings
        setSaved(existingPrediction)

        if (kickedOff) {
          setPageState('in-season')
          if (existingPrediction) {
            setTeams(existingPrediction)
            const actualData = await api.get(`/api/standings/${s}/actual/latest`).catch(() => null)
            if (actualData?.standings) {
              const lookup = {}
              actualData.standings.forEach(({ position, team }) => { lookup[team] = position })
              setActualStandings(lookup)
            }
          }
        } else {
          setPageState('pre-season')
          // Pre-populate with saved prediction, otherwise use alphabetical order
          const loadedTeams = existingPrediction ?? teamsData.teams
          setTeams(loadedTeams)
          setBaselineTeams(loadedTeams)
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

  // ── drag end ─────────────────────────────────────────────────────────────
  const handleDragEnd = useCallback(({ active, over }) => {
    if (!over || active.id === over.id) return
    setTeams(prev => {
      const oldIndex = prev.indexOf(active.id)
      const newIndex = prev.indexOf(over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
    setSaveOk(false)
  }, [])

  // ── save ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    setSaveError('')
    setSaveOk(false)

    try {
      const method  = saved ? 'put' : 'post'
      const result  = await api[method](`/api/predictions/${season}`, { standings: teams })
      setSaved(result.standings)
      setTeams(result.standings)
      setBaselineTeams(result.standings)
      setSaveOk(true)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── render states ────────────────────────────────────────────────────────

  if (pageState === 'error') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-red-400 text-sm">
          Something went wrong loading predictions. Try refreshing.
        </p>
      </div>
    )
  }

  const deadlineLabel = deadline
    ? new Date(deadline).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      })
    : null

  const isEditable = pageState === 'pre-season'

  // Insert zone dividers between positions 4/5 and 17/18
  function renderList() {
    return teams.map((name, idx) => {
      const pos = idx + 1
      return (
        <div key={name}>
          {pos === 18 && <ZoneDivider label="Relegation zone" lineColour="bg-red-400/30" />}
          <SortableTeamRow
            id={name}
            position={pos}
            name={name}
            disabled={!isEditable}
          />
        </div>
      )
    })
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6">

      {/* ── header ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-white text-2xl font-bold leading-tight">
              {isEditable ? 'Make your prediction' : 'Your prediction'}
            </h1>
            <p className="text-teal-muted text-xs mt-1">
              {season ? `${season} Premier League` : ''}
            </p>
          </div>

          {/* status badge */}
          {isEditable ? (
            <span className="bg-teal/15 border border-teal/30 text-teal text-xs px-3 py-1 rounded-full">
              Deadline open
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="bg-red-400/15 border border-red-400/30 text-red-400 text-xs px-3 py-1 rounded-full">
                Deadline passed
              </span>
              <Link
                to="/standings"
                className="bg-teal/10 border border-teal/25 text-teal text-xs px-3 py-1 rounded-full hover:bg-teal/20 transition-colors"
              >
                Live PL Table →
              </Link>
            </div>
          )}
        </div>

        {isEditable && (
          <p className="text-white/40 text-xs mt-1">
            Drag teams to set your predicted final order. Lowest total error wins.
          </p>
        )}
      </div>

      {isEditable && deadlineLabel && (
        <DeadlineCountdown
          key={deadline}
          deadline={deadline}
          deadlineLabel={deadlineLabel}
          className="mb-6"
        />
      )}

      {/* ── in-season, no prediction ── */}
      {pageState === 'in-season' && !saved && (
        <div className="bg-jet-dark rounded-2xl p-8 text-center">
          <p className="text-white/40 text-sm">No prediction was made before the deadline.</p>
          <p className="text-white/20 text-xs mt-2">
            Predictions could only be submitted before the deadline, 90 minutes before the opening fixture.
          </p>
        </div>
      )}

      {/* ── in-season static table with actuals + delta ── */}
      {pageState === 'in-season' && teams.length > 0 && (
        <div className="bg-jet-dark rounded-2xl p-4">
          <div className={`grid ${actualStandings ? 'grid-cols-[2rem_1fr_3rem_3rem]' : 'grid-cols-[2rem_1fr]'} gap-x-3 px-3 pb-2 mb-1`}>
            <span className="text-white/30 text-[10px] uppercase tracking-widest text-center">#</span>
            <span className="text-white/30 text-[10px] uppercase tracking-widest">Team</span>
            {actualStandings && <span className="text-white/30 text-[10px] uppercase tracking-widest text-center">Act.</span>}
            {actualStandings && <span className="text-white/30 text-[10px] uppercase tracking-widest text-center">Δ</span>}
          </div>
          <div className="space-y-1">
            {teams.map((name, idx) => {
              const pos = idx + 1
              const actualPos = actualStandings?.[name]
              const delta = actualPos != null ? actualPos - pos : null
              const posColour = pos === 1 ? 'text-yellow-400' : pos >= 18 ? 'text-red-400' : 'text-white/50'
              const deltaColour = delta == null ? 'text-white/20' : delta < 0 ? 'text-green-400' : delta > 0 ? 'text-red-400' : 'text-white/30'
              return (
                <div key={name}>
                  {pos === 18 && <ZoneDivider label="Relegation zone" lineColour="bg-red-400/30" />}
                  <div className={`grid ${actualStandings ? 'grid-cols-[2rem_1fr_3rem_3rem]' : 'grid-cols-[2rem_1fr]'} gap-x-3 rounded-xl px-3 py-2.5 bg-jet items-center`}>
                    <span className={`font-mono text-xs text-right shrink-0 ${posColour}`}>{pos}</span>
                    <span className="text-white text-sm">{name}</span>
                    {actualStandings && <span className="text-white/40 text-xs text-center font-mono">{actualPos ?? '—'}</span>}
                    {actualStandings && (
                      <span className={`text-xs text-center font-mono ${deltaColour}`}>
                        {delta == null ? '—' : delta === 0 ? '0' : delta > 0 ? `+${delta}` : delta}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── pre-season draggable list ── */}
      {pageState === 'pre-season' && teams.length > 0 && (
        <div className="bg-jet-dark rounded-2xl p-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={teams} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {renderList()}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* ── save controls ── */}
      {isEditable && teams.length > 0 && (
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button
            onClick={handleSave}
            disabled={saving || (!dirty && !!saved)}
            className="bg-teal text-white font-semibold text-sm px-6 py-2.5 rounded-xl hover:bg-jet transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving
              ? 'Saving…'
              : saved
                ? dirty ? 'Update prediction' : 'Prediction saved'
                : 'Submit prediction'}
          </button>

          {saveOk && !dirty && (
            <span className="text-teal text-xs">Saved ✓</span>
          )}

          {saveError && (
            <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2">
              {saveError}
            </p>
          )}
        </div>
      )}

      {/* ── existing prediction meta ── */}
      {saved && (
        <p className="text-white/20 text-xs mt-3">
          {pageState === 'pre-season'
            ? 'You already have a prediction — reorder and update it before the deadline.'
            : 'This was your final prediction for the season.'}
        </p>
      )}

      {pageState === 'in-season' && actualStandings && (
        <p className="text-white/20 text-xs mt-2 text-center">
          Δ = actual − predicted position. Negative means the team finished higher than predicted.
        </p>
      )}

      {blocker.state === 'blocked' && (
        <UnsavedChangesModal
          onStay={blocker.reset}
          onLeave={blocker.proceed}
        />
      )}
    </div>
  )
}
