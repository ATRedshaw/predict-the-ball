import { createContext, useContext, useState, useCallback } from 'react'

const PageLoadingContext = createContext({ setPageLoading: () => {} })

/**
 * Provides `setPageLoading` to any descendant.
 * Renders a full-screen overlay while loading is true.
 */
export function PageLoadingProvider({ children }) {
  const [loading, setLoading] = useState(false)

  const setPageLoading = useCallback(val => setLoading(val), [])

return (
    <PageLoadingContext.Provider value={{ setPageLoading }}>
        {children}
        {loading && (
            <div
                className="fixed inset-0 z-50 bg-jet/80 flex items-center justify-center"
                role="status"
                aria-live="polite"
            >
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 flex items-center justify-center">
                        <svg
                            className="w-10 h-10 text-teal animate-spin"
                            viewBox="0 0 50 50"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden="true"
                        >
                            <circle
                                className="opacity-20"
                                cx="25"
                                cy="25"
                                r="20"
                                stroke="currentColor"
                                strokeWidth="6"
                            />
                            <path
                                className="opacity-100"
                                fill="currentColor"
                                d="M47 25a22 22 0 00-22-22v6a16 16 0 0116 16h6z"
                            />
                        </svg>
                    </div>
                    <span className="text-teal-muted text-sm animate-pulse tracking-wide">Loading…</span>
                </div>
            </div>
        )}
    </PageLoadingContext.Provider>
)
}

/**
 * Returns `setPageLoading(bool)` for use in page components.
 * Call with `true` on mount and `false` once initial data is ready.
 *
 * @returns {{ setPageLoading: (loading: boolean) => void }}
 */
export function usePageLoading() {
  return useContext(PageLoadingContext)
}
