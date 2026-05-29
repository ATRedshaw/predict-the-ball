import { Navigate, Outlet } from 'react-router-dom'

/**
 * Wraps routes that require authentication.
 * Redirects to / if no token is present.
 */
export default function ProtectedRoute() {
  const isLoggedIn = !!localStorage.getItem('access_token')
  return isLoggedIn ? <Outlet /> : <Navigate to="/" replace />
}
