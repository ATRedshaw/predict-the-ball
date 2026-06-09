export const AUTH_INSTALL_PROMPT_KEY = 'ptb_show_install_after_auth'
export const INSTALL_DISMISSED_AT_KEY = 'ptb_install_prompt_dismissed_at'

const DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000

function hasWindow() {
  return typeof window !== 'undefined'
}

export function getIsIos() {
  if (!hasWindow()) return false

  const { maxTouchPoints, platform, userAgent } = window.navigator
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)
}

export function getIsMobile() {
  if (!hasWindow()) return false

  const mobileQuery = window.matchMedia('(max-width: 767px), (hover: none) and (pointer: coarse)')
  return mobileQuery.matches || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(window.navigator.userAgent)
}

export function getIsStandalone() {
  if (!hasWindow()) return false

  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export function addMediaListener(query, handler) {
  if (query.addEventListener) {
    query.addEventListener('change', handler)
    return () => query.removeEventListener('change', handler)
  }

  query.addListener(handler)
  return () => query.removeListener(handler)
}

export function markInstallPromptAfterAuth() {
  if (!hasWindow()) return
  window.sessionStorage.setItem(AUTH_INSTALL_PROMPT_KEY, '1')
}

export function clearInstallPromptAfterAuth() {
  if (!hasWindow()) return
  window.sessionStorage.removeItem(AUTH_INSTALL_PROMPT_KEY)
}

export function hasAuthInstallPromptFlag() {
  if (!hasWindow()) return false
  return window.sessionStorage.getItem(AUTH_INSTALL_PROMPT_KEY) === '1'
}

export function wasInstallPromptRecentlyDismissed() {
  if (!hasWindow()) return false

  const dismissedAt = Number(window.localStorage.getItem(INSTALL_DISMISSED_AT_KEY))
  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS
}
