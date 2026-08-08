import { useEffect, useRef, useState } from 'react'

export function useSmoothLoading(isLoading, delay = 180, minVisible = 300, startVisible = false) {
  const [visible, setVisible] = useState(() => isLoading && startVisible)
  const shownAt = useRef(null)

  useEffect(() => {
    let timer

    if (isLoading && !visible) {
      timer = setTimeout(() => {
        shownAt.current = Date.now()
        setVisible(true)
      }, delay)
    } else if (isLoading && shownAt.current == null) {
      shownAt.current = Date.now()
    } else if (!isLoading && visible) {
      const elapsed = shownAt.current == null ? minVisible : Date.now() - shownAt.current
      timer = setTimeout(() => {
        shownAt.current = null
        setVisible(false)
      }, Math.max(0, minVisible - elapsed))
    } else if (!isLoading) {
      shownAt.current = null
    }

    return () => clearTimeout(timer)
  }, [delay, isLoading, minVisible, visible])

  return visible
}
