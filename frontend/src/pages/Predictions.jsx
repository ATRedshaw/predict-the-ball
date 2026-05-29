import { useState, useEffect, useLayoutEffect, useCallback } from 'react'
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

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

/**
 * Page states:
 *  loading   — fetching season/deadline/prediction data
 *  pre-season — deadline not yet reached; user can submit/edit a prediction
 *  in-season  — season has kicked off; show existing prediction or placeholder
 *  error      — something went wrong
 */
export default function Predictions() {
  const { setPageLoading } = usePageLoading()
  const [pageState, setPageState]   = useState('loading')
  const [season,    setSeason]      = useState(null)
  const [deadline,  setDeadline]    = useState(null)
  const [teams,     setTeams]       = useState([])   // ordered list of team name strings
  const [saved,     setSaved]       = useState(null) // saved prediction from server, or null
  const [dirty,     setDirty]       = useState(false)
  const [saving,    setSaving]      = useState(false)
  const [saveError, setSaveError]   = useState('')
  const [saveOk,    setSaveOk]      = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

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
          if (existingPrediction) setTeams(existingPrediction)
        } else {
          setPageState('pre-season')
          // Pre-populate with saved prediction, otherwise use alphabetical order
          setTeams(existingPrediction ?? teamsData.teams)
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
    setDirty(true)
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
      setDirty(false)
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
            <span className="bg-red-400/15 border border-red-400/30 text-red-400 text-xs px-3 py-1 rounded-full">
              Deadline passed
            </span>
          )}
        </div>

        {isEditable && deadlineLabel && (
          <p className="text-white/30 text-xs mt-2">
            Locks at {deadlineLabel}
          </p>
        )}

        {isEditable && (
          <p className="text-white/40 text-xs mt-1">
            Drag teams to set your predicted final order. Lowest total error wins.
          </p>
        )}
      </div>

      {/* ── in-season, no prediction ── */}
      {pageState === 'in-season' && !saved && (
        <div className="bg-jet-dark rounded-2xl p-8 text-center">
          <p className="text-white/40 text-sm">No prediction was made before the deadline.</p>
          <p className="text-white/20 text-xs mt-2">
            Predictions could only be submitted before the first match kicked off.
          </p>
        </div>
      )}

      {/* ── list ── */}
      {teams.length > 0 && (
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
    </div>
  )
}
