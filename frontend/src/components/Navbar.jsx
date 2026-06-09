import { useState } from 'react'
import { Link } from 'react-router-dom'

/**
 * Top navigation bar.
 *
 * @param {object}  props
 * @param {boolean} props.isLoggedIn   - Switches between auth and app nav variants.
 * @param {string}  [props.username]   - Display name shown when logged in.
 * @param {string}  [props.activePage] - Key of the currently active nav item (logged-in variant).
 */
export default function Navbar({ isLoggedIn = false, username = '', activePage = '', isAdmin = false }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const loggedInLinks = [
    { key: 'dashboard',          label: 'Dashboard'         },
    { key: 'predictions',        label: 'Predictions'       },
    { key: 'leagues',            label: 'Leagues'           },
    { key: 'model-predictions',  label: 'Model Predictions' },
  ]

  return (
    <nav className="flex items-center justify-between mb-6 relative">

      {/* Logo */}
      <Link to={isLoggedIn ? '/dashboard' : '/'} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <img src="/icon-192-maskable.png" alt="" className="w-7 h-7 rounded-md" />
        <span className="text-white font-semibold tracking-tight text-lg">PredictTheBall</span>
      </Link>

      {/* Desktop nav */}
      <div className="hidden md:flex items-center gap-3">
        {isLoggedIn ? (
          <>
            {loggedInLinks.map(({ key, label }) => (
              <Link
                key={key}
                to={`/${key}`}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                  activePage === key
                    ? 'bg-teal text-white'
                    : 'text-teal-muted hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                  activePage === 'admin'
                    ? 'bg-teal text-white'
                    : 'text-teal-muted hover:text-white'
                }`}
              >
                Admin
              </Link>
            )}
            <Link to="/settings" className="ml-2 flex items-center gap-2 border border-white/10 rounded-xl px-3 py-1.5 hover:bg-white/5 transition-colors">
              <div className="w-5 h-5 rounded-full bg-teal flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">
                  {username ? username[0].toUpperCase() : '?'}
                </span>
              </div>
              <span className="text-white text-sm">{username || 'Account'}</span>
            </Link>
          </>
        ) : (
          <>
            <Link to="/login" className="text-mist text-sm hover:text-white transition-colors">
              Log in
            </Link>
            <Link to="/signup" className="bg-teal hover:bg-teal-muted text-white text-sm px-4 py-2 rounded-lg transition-colors">
              Sign up free
            </Link>
          </>
        )}
      </div>

      {/* Mobile hamburger */}
      <button
        className="md:hidden flex flex-col gap-1.5 p-2 rounded-lg hover:bg-white/5 transition-colors"
        onClick={() => setMenuOpen(prev => !prev)}
        aria-label="Toggle menu"
      >
        <span className={`block w-5 h-0.5 bg-white transition-transform duration-200 ${menuOpen ? 'translate-y-2 rotate-45' : ''}`} />
        <span className={`block w-5 h-0.5 bg-white transition-opacity duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
        <span className={`block w-5 h-0.5 bg-white transition-transform duration-200 ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`} />
      </button>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-jet-dark border border-white/10 rounded-2xl p-3 z-50 flex flex-col gap-1 md:hidden">
          {isLoggedIn ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2 mb-1 border-b border-white/10">
                <div className="w-6 h-6 rounded-full bg-teal flex items-center justify-center">
                  <span className="text-white text-xs font-bold">
                    {username ? username[0].toUpperCase() : '?'}
                  </span>
                </div>
                <span className="text-white text-sm">{username || 'Account'}</span>
              </div>
              {loggedInLinks.map(({ key, label }) => (
                <Link
                  key={key}
                  to={`/${key}`}
                  className={`text-sm px-3 py-2 rounded-xl transition-colors ${
                    activePage === key
                      ? 'bg-teal text-white'
                      : 'text-teal-muted hover:text-white hover:bg-white/5'
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </Link>
              ))}
              <Link
                to="/settings"
                className="text-sm px-3 py-2 rounded-xl transition-colors text-teal-muted hover:text-white hover:bg-white/5"
                onClick={() => setMenuOpen(false)}
              >
                Settings
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className={`text-sm px-3 py-2 rounded-xl transition-colors ${
                    activePage === 'admin'
                      ? 'bg-teal text-white'
                      : 'text-teal-muted hover:text-white hover:bg-white/5'
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  Admin
                </Link>
              )}
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-mist text-sm px-3 py-2 rounded-xl hover:text-white hover:bg-white/5 transition-colors block"
                onClick={() => setMenuOpen(false)}
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="bg-teal text-white text-sm px-3 py-2 rounded-xl hover:bg-teal-muted transition-colors block"
                onClick={() => setMenuOpen(false)}
              >
                Sign up free
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
