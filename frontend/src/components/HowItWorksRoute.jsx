import { lazy, Suspense } from 'react'

const HowItWorks = lazy(() => import('../pages/HowItWorks.jsx'))

export default function HowItWorksRoute() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center text-sm text-white/30">Loading guide…</div>}>
      <HowItWorks />
    </Suspense>
  )
}
