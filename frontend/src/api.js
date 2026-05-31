import { loadingBus } from './loadingBus'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:5000'

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

    const data = await res.json().catch(() => ({}))

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
