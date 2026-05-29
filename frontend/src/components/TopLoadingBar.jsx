import { useState, useEffect } from 'react'
import { loadingBus } from '../loadingBus'

/**
 * Thin progress bar fixed to the top of the viewport.
 * Visible whenever at least one API request is in flight.
 * Mounts once inside Layout — no per-page wiring needed.
 */
export default function TopLoadingBar() {
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    return loadingBus.subscribe(isLoading => {
      if (isLoading) {
        setLoading(true)
        setVisible(true)
      } else {
        // Keep the bar visible briefly so it can animate to completion
        setLoading(false)
        const t = setTimeout(() => setVisible(false), 400)
        return () => clearTimeout(t)
      }
    })
  }, [])

  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-transparent pointer-events-none">
      <div
        className={[
          'h-full bg-teal transition-all',
          loading ? 'w-4/5 duration-[2000ms] ease-out' : 'w-full duration-300 ease-in',
        ].join(' ')}
        style={{ opacity: loading ? 1 : 0, transition: loading ? 'width 2s ease-out' : 'width 0.3s ease-in, opacity 0.4s ease-in 0.1s' }}
      />
    </div>
  )
}
