import { useSyncExternalStore } from 'react'

let snapshot = {
  accessToken: null,
  user: null,
  ready: false,
  suppressReturnTo: false,
}

const listeners = new Set()

function emit(next) {
  snapshot = next
  listeners.forEach(listener => listener())
}

export function getAccessToken() {
  return snapshot.accessToken
}

export function getAuthSnapshot() {
  return snapshot
}

export function subscribeAuth(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAuth() {
  return useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthSnapshot)
}

export function setAuthenticated(accessToken, user) {
  emit({ accessToken, user, ready: true, suppressReturnTo: false })
}

export function setAccessToken(accessToken) {
  emit({ ...snapshot, accessToken, ready: true, suppressReturnTo: false })
}

export function setAuthUser(user) {
  emit({ ...snapshot, user, ready: true })
}

export function clearAuthState({ suppressReturnTo = false } = {}) {
  emit({ accessToken: null, user: null, ready: true, suppressReturnTo })
}
