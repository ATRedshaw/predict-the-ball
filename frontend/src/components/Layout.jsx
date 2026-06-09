import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import { PageLoadingProvider } from './PageLoadingContext'
import { InstallPromptProvider } from './InstallPromptProvider'
import InstallBanner from './InstallBanner'

const PATH_TO_PAGE = {
  '/':                   'landing',
  '/login':              'login',
  '/signup':             'signup',
  '/dashboard':          'dashboard',
  '/predictions':        'predictions',
  '/standings':          'standings',
  '/leagues':            'leagues',
  '/model-predictions':  'model-predictions',
  '/settings':           'settings',
  '/admin':              'admin',
}

export default function Layout() {
  const { pathname } = useLocation()
  const isLoggedIn   = !!localStorage.getItem('access_token')
  const isAdmin      = localStorage.getItem('is_admin') === 'true'
  const activePage   = PATH_TO_PAGE[pathname] ?? ''
  const firstName    = localStorage.getItem('first_name') ?? ''

  return (
    <InstallPromptProvider>
      <PageLoadingProvider>
        <div className="min-h-screen bg-jet p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 font-sans flex flex-col">
          <Navbar isLoggedIn={isLoggedIn} activePage={activePage} username={firstName} isAdmin={isAdmin} />
          <div className="flex-1 flex flex-col">
            <Outlet />
          </div>
          <Footer />
        </div>
        <InstallBanner isLoggedIn={isLoggedIn} />
      </PageLoadingProvider>
    </InstallPromptProvider>
  )
}
