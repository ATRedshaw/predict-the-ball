const DEFAULT_RETURN_TO = '/dashboard'
const AUTH_PATHS = new Set(['/login', '/signup', '/forgot-password'])

export function normaliseReturnTo(value, fallback = DEFAULT_RETURN_TO) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return fallback
  }

  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin) return fallback
    if (AUTH_PATHS.has(url.pathname)) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

export function getReturnTo(search, fallback = DEFAULT_RETURN_TO) {
  const value = new URLSearchParams(search).get('returnTo')
  return normaliseReturnTo(value, fallback)
}

export function buildAuthPath(path, returnTo) {
  const params = new URLSearchParams({ returnTo: normaliseReturnTo(returnTo) })
  return `${path}?${params.toString()}`
}
