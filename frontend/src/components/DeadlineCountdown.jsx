import { useEffect, useState } from 'react'

export default function DeadlineCountdown({ deadline, deadlineLabel, className = '' }) {
  const [remainingMs, setRemainingMs] = useState(() => (
    Math.max(0, new Date(deadline).getTime() - Date.now())
  ))

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRemainingMs(Math.max(0, new Date(deadline).getTime() - Date.now()))
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [deadline])

  if (remainingMs <= 0) return null

  const totalSeconds = Math.ceil(remainingMs / 1000)
  const units = [
    { label: 'Days', value: Math.floor(totalSeconds / 86400) },
    { label: 'Hours', value: Math.floor((totalSeconds % 86400) / 3600) },
    { label: 'Minutes', value: Math.floor((totalSeconds % 3600) / 60) },
    { label: 'Seconds', value: totalSeconds % 60 },
  ]

  return (
    <aside
      className={`rounded-2xl border border-teal/30 bg-teal/10 p-4 sm:p-5 ${className}`}
      aria-label="Prediction deadline countdown"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal/20 text-teal-muted">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Deadline countdown</p>
            <p className="mt-0.5 text-xs text-teal-muted">Locks at {deadlineLabel}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2" role="timer" aria-live="off">
          {units.map(({ label, value }) => (
            <div key={label} className="min-w-14 rounded-xl bg-jet-dark/70 px-2 py-2 text-center">
              <span className="block font-mono text-lg font-semibold leading-none text-white tabular-nums">
                {String(value).padStart(2, '0')}
              </span>
              <span className="mt-1 block text-[9px] uppercase tracking-wider text-white/40">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
