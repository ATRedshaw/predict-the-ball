import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../authState'
import { buildAuthPath } from '../authRedirect'

export default function ProtectedRoute() {
  const { accessToken, ready, suppressReturnTo } = useAuth()
  const location = useLocation()
  const isLoggedIn = !!accessToken

  if (!ready) return null

  const returnTo = `${location.pathname}${location.search}${location.hash}`
  const loginPath = suppressReturnTo ? '/login' : buildAuthPath('/login', returnTo)
  return isLoggedIn ? <Outlet /> : <Navigate to={loginPath} replace />
}
