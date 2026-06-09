import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  INSTALL_DISMISSED_AT_KEY,
  addMediaListener,
  clearInstallPromptAfterAuth,
  getIsIos,
  getIsMobile,
  getIsStandalone,
} from '../pwa/installPrompt'
import { InstallPromptContext } from '../pwa/installPromptContext'

function hasWindow() {
  return typeof window !== 'undefined'
}

export function InstallPromptProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(getIsStandalone)
  const [isMobile, setIsMobile] = useState(getIsMobile)
  const isIos = useMemo(() => getIsIos(), [])

  useEffect(() => {
    if (!hasWindow()) return undefined

    const handleBeforeInstallPrompt = event => {
      event.preventDefault()
      setDeferredPrompt(event)
    }
    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setIsInstalled(true)
      clearInstallPromptAfterAuth()
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  useEffect(() => {
    if (!hasWindow()) return undefined

    const mobileQuery = window.matchMedia('(max-width: 767px), (hover: none) and (pointer: coarse)')
    const standaloneQuery = window.matchMedia('(display-mode: standalone)')
    const syncState = () => {
      setIsMobile(getIsMobile())
      setIsInstalled(getIsStandalone())
    }

    syncState()
    const removeMobileListener = addMediaListener(mobileQuery, syncState)
    const removeStandaloneListener = addMediaListener(standaloneQuery, syncState)

    return () => {
      removeMobileListener()
      removeStandaloneListener()
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return { outcome: 'unavailable' }

    const promptEvent = deferredPrompt
    setDeferredPrompt(null)
    clearInstallPromptAfterAuth()
    await promptEvent.prompt()

    const choice = promptEvent.userChoice
      ? await promptEvent.userChoice.catch(() => ({ outcome: 'dismissed' }))
      : { outcome: 'accepted' }

    if (choice?.outcome === 'accepted') {
      setIsInstalled(true)
    }

    return choice
  }, [deferredPrompt])

  const dismissInstallPrompt = useCallback(() => {
    clearInstallPromptAfterAuth()
    window.localStorage.setItem(INSTALL_DISMISSED_AT_KEY, Date.now().toString())
  }, [])

  const value = useMemo(() => ({
    canPrompt: !!deferredPrompt,
    dismissInstallPrompt,
    isInstalled,
    isIos,
    isMobile,
    promptInstall,
  }), [deferredPrompt, dismissInstallPrompt, isInstalled, isIos, isMobile, promptInstall])

  return (
    <InstallPromptContext.Provider value={value}>
      {children}
    </InstallPromptContext.Provider>
  )
}
