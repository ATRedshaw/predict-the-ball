import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import { PageLoadingProvider } from './PageLoadingContext'

const PATH_TO_PAGE = {
  '/':                   'landing',
  '/dashboard':          'dashboard',
  '/predictions':        'predictions',
  '/leagues':            'leagues',
  '/model-predictions':  'model-predictions',
  '/settings':           'settings',
  '/admin':              'admin',
}

/**
 * Root layout. Wraps every route with the shared Navbar + Footer shell.
 * Auth state is derived from localStorage — replace with a proper context
 * once auth state management is in place.
 */
export default function Layout() {
  const { pathname } = useLocation()
  const isLoggedIn   = !!localStorage.getItem('access_token')
  const isAdmin      = localStorage.getItem('is_admin') === 'true'
  const activePage   = PATH_TO_PAGE[pathname] ?? ''
  const firstName    = localStorage.getItem('first_name') ?? ''

  return (
    <PageLoadingProvider>
      <div className="min-h-screen bg-jet p-4 md:p-6 font-sans flex flex-col">
        <Navbar isLoggedIn={isLoggedIn} activePage={activePage} username={firstName} isAdmin={isAdmin} />
        <div className="flex-1 flex flex-col">
          <Outlet />
        </div>
        <Footer />
      </div>
    </PageLoadingProvider>
  )
}
