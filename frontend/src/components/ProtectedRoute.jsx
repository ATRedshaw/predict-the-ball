import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../authState'

export default function ProtectedRoute() {
  const { accessToken, ready } = useAuth()
  const isLoggedIn = !!accessToken

  if (!ready) return null

  return isLoggedIn ? <Outlet /> : <Navigate to="/" replace />
}
