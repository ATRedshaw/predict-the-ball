const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:5000'

/**
 * Thin fetch wrapper that prepends the base API URL and handles JSON
 * serialisation/deserialisation. Throws an Error with the server's
 * error message on non-2xx responses.
 *
 * @param {string} path     - Path relative to the API root, e.g. '/api/auth/login'.
 * @param {RequestInit} [options] - Standard fetch options.
 * @returns {Promise<any>}  Parsed JSON response body.
 */
async function request(path, options = {}) {
  const token = localStorage.getItem('access_token')

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`)
  }

  return data
}

export const api = {
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  get:  (path)       => request(path, { method: 'GET' }),
}
