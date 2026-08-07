import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../authState'
import { buildAuthPath } from '../authRedirect'

export default function ProtectedRoute() {
  const { accessToken, ready } = useAuth()
  const location = useLocation()
  const isLoggedIn = !!accessToken

  if (!ready) return null

  const returnTo = `${location.pathname}${location.search}${location.hash}`
  return isLoggedIn ? <Outlet /> : <Navigate to={buildAuthPath('/login', returnTo)} replace />
}
