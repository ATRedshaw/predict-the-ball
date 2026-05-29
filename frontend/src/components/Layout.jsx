import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'

const PATH_TO_PAGE = {
  '/':          'landing',
  '/home':      'dashboard',
  '/predictions': 'predictions',
  '/leagues':   'leagues',
  '/standings': 'standings',
}

/**
 * Root layout. Wraps every route with the shared Navbar + Footer shell.
 * Auth state is derived from localStorage — replace with a proper context
 * once auth state management is in place.
 */
export default function Layout() {
  const { pathname } = useLocation()
  const isLoggedIn   = !!localStorage.getItem('access_token')
  const activePage   = PATH_TO_PAGE[pathname] ?? ''

  return (
    <div className="min-h-screen bg-jet p-4 md:p-6 font-sans flex flex-col">
      <Navbar isLoggedIn={isLoggedIn} activePage={activePage} />
      <div className="flex-1 flex flex-col">
        <Outlet />
      </div>
      <Footer />
    </div>
  )
}
