import { Navigate, Outlet } from 'react-router-dom'

/**
 * Wraps routes that require admin privileges.
 * Redirects to / if not logged in, or to /dashboard if logged in but not admin.
 */
export default function AdminRoute() {
  const token   = localStorage.getItem('access_token')
  const isAdmin = localStorage.getItem('is_admin') === 'true'

  if (!token)   return <Navigate to="/"          replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />

  return <Outlet />
}
