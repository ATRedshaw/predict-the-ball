import { Navigate, Outlet } from 'react-router-dom'

/**
 * Wraps routes that should only be accessible to unauthenticated users.
 * Redirects to /home if a token is present.
 */
export default function GuestRoute() {
  const isLoggedIn = !!localStorage.getItem('access_token')
  return isLoggedIn ? <Navigate to="/home" replace /> : <Outlet />
}
