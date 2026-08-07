import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../authState'
import { getReturnTo } from '../authRedirect'

export default function GuestRoute() {
  const { accessToken, ready } = useAuth()
  const location = useLocation()
  const isLoggedIn = !!accessToken

  if (!ready) return null

  return isLoggedIn ? <Navigate to={getReturnTo(location.search)} replace /> : <Outlet />
}
