import { Link } from 'react-router-dom'

function HomeIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 10.5 9-7.5 9 7.5" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </svg>
  )
}

function PredictionsIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3.5 6h.01" />
      <path d="M3.5 12h.01" />
      <path d="M3.5 18h.01" />
    </svg>
  )
}

function LeaguesIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0" />
      <path d="M17 11a4 4 0 0 0-1-7.75" />
      <path d="M22 21a6 6 0 0 0-5-5.75" />
    </svg>
  )
}

function ModelIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m7 15 4-4 3 3 5-7" />
    </svg>
  )
}

function AccountIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  )
}

function AdminIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 20 6v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6l8-3Z" />
      <path d="m9 12 2 2 4-5" />
    </svg>
  )
}

function LoginIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="m10 17 5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  )
}

function SignUpIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0" />
      <path d="M19 8v6" />
      <path d="M16 11h6" />
    </svg>
  )
}

export default function Navbar({ isLoggedIn = false, username = '', activePage = '', isAdmin = false }) {
  const loggedInLinks = [
    { key: 'dashboard',         label: 'Dashboard',         mobileLabel: 'Home',    to: '/dashboard',         icon: HomeIcon        },
    { key: 'predictions',       label: 'Predictions',       mobileLabel: 'Picks',   to: '/predictions',       icon: PredictionsIcon },
    { key: 'leagues',           label: 'Leagues',           mobileLabel: 'Leagues', to: '/leagues',           icon: LeaguesIcon     },
    { key: 'model-predictions', label: 'Model Predictions', mobileLabel: 'Model',   to: '/model-predictions', icon: ModelIcon       },
  ]
  const publicLinks = [
    { key: 'landing', label: 'Home', to: '/',       icon: HomeIcon   },
    { key: 'login',   label: 'Log in', to: '/login', icon: LoginIcon  },
    { key: 'signup',  label: 'Sign up', to: '/signup', icon: SignUpIcon },
  ]
  const mobileLinks = isLoggedIn
    ? [
        ...loggedInLinks,
        { key: 'settings', label: 'Account', mobileLabel: 'Account', to: '/settings', icon: AccountIcon },
        ...(isAdmin ? [{ key: 'admin', label: 'Admin', mobileLabel: 'Admin', to: '/admin', icon: AdminIcon }] : []),
      ]
    : publicLinks

  return (
    <>
      <nav className="flex items-center justify-between mb-6 relative" aria-label="Primary">
        <Link to={isLoggedIn ? '/dashboard' : '/'} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src="/icon-192-maskable.png" alt="" className="w-7 h-7 rounded-md" />
          <span className="text-white font-semibold tracking-tight text-lg">PredictTheBall</span>
        </Link>

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
              <Link
                to="/settings"
                className={`ml-2 flex items-center gap-2 border border-white/10 rounded-xl px-3 py-1.5 transition-colors ${
                  activePage === 'settings'
                    ? 'bg-white/10 text-white'
                    : 'text-white hover:bg-white/5'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-teal flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold">
                    {username ? username[0].toUpperCase() : '?'}
                  </span>
                </div>
                <span className="text-sm">{username || 'Account'}</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-mist text-sm hover:text-white transition-colors"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="bg-teal hover:bg-teal-muted text-white text-sm px-4 py-2 rounded-lg transition-colors"
              >
                Sign up free
              </Link>
            </>
          )}
        </div>

        <div className="md:hidden w-9" aria-hidden="true" />
      </nav>

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-jet-dark/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-12px_30px_rgba(0,0,0,0.25)] backdrop-blur"
        aria-label="Mobile primary"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around gap-1">
          {mobileLinks.map(({ key, label, mobileLabel, to, icon: Icon }) => {
            const isActive = activePage === key

            return (
              <Link
                key={key}
                to={to}
                aria-current={isActive ? 'page' : undefined}
                className={`min-w-0 flex-1 rounded-xl px-1.5 py-2 text-[11px] font-medium leading-tight transition-colors ${
                  isActive
                    ? 'bg-teal text-white'
                    : 'text-teal-muted hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="flex flex-col items-center gap-1">
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="w-full truncate text-center">{mobileLabel ?? label}</span>
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
