import { useState, useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { api } from '../api'

/**
 * Wraps routes that require admin privileges.
 * Verifies admin status against the server on every mount — localStorage is
 * used only for the initial loading state, never as the source of truth.
 */
export default function AdminRoute() {
  const token = localStorage.getItem('access_token')

  // null = still checking, true/false = resolved
  const [isAdmin, setIsAdmin] = useState(null)

  useEffect(() => {
    if (!token) {
      setIsAdmin(false)
      return
    }
    api.get('/api/auth/me')
      .then(me => setIsAdmin(me.is_admin === true))
      .catch(() => setIsAdmin(false))
  }, [token])

  if (!token)       return <Navigate to="/"          replace />
  if (isAdmin === null) return null   // waiting for server response — render nothing
  if (!isAdmin)     return <Navigate to="/dashboard" replace />

  return <Outlet />
}
