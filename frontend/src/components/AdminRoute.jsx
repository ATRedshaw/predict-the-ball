import { useState, useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { api } from '../api'
import { setAuthUser, useAuth } from '../authState'

export default function AdminRoute() {
  const { accessToken, ready } = useAuth()
  const [adminCheck, setAdminCheck] = useState({ accessToken: null, isAdmin: null })

  useEffect(() => {
    if (!ready) return
    if (!accessToken) return

    let cancelled = false
    api.get('/api/auth/me')
      .then(me => {
        if (cancelled) return
        setAuthUser(me)
        setAdminCheck({ accessToken, isAdmin: me.is_admin === true })
      })
      .catch(() => {
        if (!cancelled) {
          setAdminCheck({ accessToken, isAdmin: false })
        }
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, ready])

  if (!ready) return null

  const isAdmin = adminCheck.accessToken === accessToken ? adminCheck.isAdmin : null

  if (!accessToken) return <Navigate to="/" replace />
  if (isAdmin === null) return null
  if (!isAdmin)     return <Navigate to="/dashboard" replace />

  return <Outlet />
}
