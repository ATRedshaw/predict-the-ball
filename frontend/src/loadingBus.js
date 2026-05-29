/**
 * Minimal event bus for tracking in-flight API requests.
 *
 * `api.js` increments/decrements the counter around every fetch. Any component
 * can subscribe to know whether at least one request is pending.
 */

let _count = 0
const _listeners = new Set()

function _notify() {
  const loading = _count > 0
  _listeners.forEach(fn => fn(loading))
}

export const loadingBus = {
  /** Increment the in-flight counter. */
  start() {
    _count++
    _notify()
  },

  /** Decrement the in-flight counter. */
  end() {
    _count = Math.max(0, _count - 1)
    _notify()
  },

  /**
   * Subscribe to loading state changes.
   *
   * @param {(loading: boolean) => void} fn
   * @returns {() => void} Unsubscribe function.
   */
  subscribe(fn) {
    _listeners.add(fn)
    return () => _listeners.delete(fn)
  },
}
