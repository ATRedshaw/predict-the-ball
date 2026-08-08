import { useEffect } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import { InstallPromptProvider } from './InstallPromptProvider'
import InstallBanner from './InstallBanner'
import { api } from '../api'
import { clearAuthState, useAuth } from '../authState'

const PATH_TO_PAGE = {
  '/':                   'landing',
  '/how-it-works':       'how-it-works',
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
  const { accessToken, user } = useAuth()
  const isLoggedIn   = !!accessToken
  const isAdmin      = user?.is_admin === true
  const activePage   = PATH_TO_PAGE[pathname] ?? ''
  const firstName    = user?.first_name ?? ''

  useEffect(() => {
    api.refreshAuth().catch(() => {
      clearAuthState()
    })
  }, [])

  return (
    <InstallPromptProvider>
      <div className="min-h-screen bg-jet p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 font-sans flex flex-col">
        <Navbar isLoggedIn={isLoggedIn} activePage={activePage} username={firstName} isAdmin={isAdmin} />
        <div className="flex-1 flex flex-col">
          <Outlet />
        </div>
        <Footer />
      </div>
      <InstallBanner isLoggedIn={isLoggedIn} />
      <ScrollRestoration />
    </InstallPromptProvider>
  )
}
