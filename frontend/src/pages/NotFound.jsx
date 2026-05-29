import { Link, useLocation } from 'react-router-dom'

/**
 * Catch-all 404 page. Shown when no route matches the current path.
 */
export default function NotFound() {
  const { pathname } = useLocation()

  return (
    <div className="max-w-7xl mx-auto w-full flex-1 flex items-center justify-center py-24">
      <div className="bg-jet-dark rounded-2xl p-10 flex flex-col items-center text-center max-w-md w-full">
        <div className="w-14 h-14 rounded-xl bg-teal flex items-center justify-center mb-6">
          <span className="text-2xl">⚽</span>
        </div>
        <p className="text-teal text-xs font-medium uppercase tracking-widest mb-2">Page not found</p>
        <h1 className="text-white text-6xl font-bold tracking-tight">404</h1>
        <p className="text-teal-muted text-sm font-mono mt-2 mb-1">{pathname}</p>
        <p className="text-mist text-sm opacity-70 mt-3">
          That page doesn't exist. It may have moved, or you might have followed a bad link.
        </p>
        <Link
          to="/"
          className="mt-8 bg-teal text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-teal-muted transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}
