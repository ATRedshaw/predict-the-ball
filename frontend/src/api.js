import { loadingBus } from './loadingBus'
import {
  clearAuthState,
  getAccessToken,
  setAccessToken,
  setAuthenticated,
} from './authState'

const DEFAULT_BASE_URL = `${window.location.protocol}//${window.location.hostname}:5000`
let refreshPromise = null

function resolveBaseUrl() {
  const value = import.meta.env.VITE_API_URL?.trim() || DEFAULT_BASE_URL

  if (!/^https?:\/\//i.test(value)) {
    throw new Error('VITE_API_URL must include http:// or https://')
  }

  return value.replace(/\/+$/, '')
}

const BASE_URL = resolveBaseUrl()

async function readJson(res) {
  if (res.status === 204) {
    return { data: {}, responseError: null }
  }

  const contentType = res.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    const body = await res.text().catch(() => '')
    const preview = body.trim().slice(0, 120)
    const detail = preview ? `: ${preview}` : ''

    return {
      data: {},
      responseError: `Expected JSON response from API, got ${contentType || 'unknown content type'}${detail}`,
    }
  }

  return {
    data: await res.json().catch(() => ({})),
    responseError: null,
  }
}

async function refreshAuth() {
  if (!refreshPromise) {
    refreshPromise = request('/api/auth/refresh', { method: 'POST' }, true, false)
      .then(data => {
        setAuthenticated(data.access_token, data.user ?? null)
        return data
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

async function request(path, options = {}, skipAutoLogout = false, allowRefresh = true) {
  const token = getAccessToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  loadingBus.start()
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers,
    })

    const { data, responseError } = await readJson(res)

    if (res.status === 401 && allowRefresh && token) {
      try {
        const refreshed = await refreshAuth()
        setAccessToken(refreshed.access_token)
        return request(path, options, skipAutoLogout, false)
      } catch {
        clearAuthState()
        if (!skipAutoLogout) {
          window.location.href = '/login'
        }
        throw new Error('Session expired. Please log in again.')
      }
    }

    if (res.status === 401 && !skipAutoLogout) {
      clearAuthState()
      window.location.href = '/login'
      throw new Error('Session expired. Please log in again.')
    }

    if (!res.ok) {
      const err = new Error(data.error || `Request failed (${res.status})`)
      err.code = data.error ?? null
      throw err
    }

    if (responseError) {
      throw new Error(responseError)
    }

    return data
  } finally {
    loadingBus.end()
  }
}

export const api = {
  post:   (path, body, skipAutoLogout) => request(path, { method: 'POST',   body: JSON.stringify(body) }, skipAutoLogout),
  put:    (path, body, skipAutoLogout) => request(path, { method: 'PUT',    body: JSON.stringify(body) }, skipAutoLogout),
  get:    (path)                       => request(path, { method: 'GET' }),
  delete: (path, body) => request(path, { method: 'DELETE', ...(body ? { body: JSON.stringify(body) } : {}) }),
  refreshAuth,
}
