import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../authState'

export default function GuestRoute() {
  const { accessToken, ready } = useAuth()
  const isLoggedIn = !!accessToken

  if (!ready) return null

  return isLoggedIn ? <Navigate to="/dashboard" replace /> : <Outlet />
}
