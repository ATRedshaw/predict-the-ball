import { loadingBus } from './loadingBus'

const DEFAULT_BASE_URL = 'http://127.0.0.1:5000'

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

/**
 * Thin fetch wrapper that prepends the base API URL and handles JSON
 * serialisation/deserialisation. Throws an Error with the server's
 * error message on non-2xx responses.
 *
 * @param {string} path              - Path relative to the API root, e.g. '/api/auth/login'.
 * @param {RequestInit} [options]    - Standard fetch options.
 * @param {boolean} [skipAutoLogout] - When true, a 401 is thrown as a regular error
 *                                     instead of redirecting to /login. Useful for
 *                                     endpoints where 401 means "wrong credentials"
 *                                     rather than "session expired".
 * @returns {Promise<any>}  Parsed JSON response body.
 */
async function request(path, options = {}, skipAutoLogout = false) {
  const token = localStorage.getItem('access_token')

  loadingBus.start()
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      ...options,
    })

    const { data, responseError } = await readJson(res)

    if (res.status === 401 && !skipAutoLogout) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('first_name')
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
}
