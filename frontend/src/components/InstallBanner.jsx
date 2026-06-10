import { useState } from 'react'
import {
  hasAuthInstallPromptFlag,
  wasInstallPromptRecentlyDismissed,
} from '../pwa/installPrompt'
import { useInstallPrompt } from '../pwa/installPromptContext'

export default function InstallBanner({ isLoggedIn }) {
  const {
    canPrompt,
    dismissInstallPrompt,
    isInstalled,
    isIos,
    isMobile,
    promptInstall,
  } = useInstallPrompt()
  const [closed, setClosed] = useState(false)

  const shouldShow = isLoggedIn &&
    !closed &&
    hasAuthInstallPromptFlag() &&
    !wasInstallPromptRecentlyDismissed()

  if (!shouldShow || !isMobile || isInstalled) {
    return null
  }

  const instruction = canPrompt
    ? 'Install it from this browser for a quicker mobile experience.'
    : isIos
      ? 'Open Safari Share, then choose Add to Home Screen.'
      : 'Open your browser menu, then choose Install app or Add to Home Screen.'

  async function handleInstall() {
    const choice = await promptInstall()

    if (choice?.outcome !== 'accepted') {
      dismissInstallPrompt()
    }

    setClosed(true)
  }

  function handleDismiss() {
    dismissInstallPrompt()
    setClosed(true)
  }

  return (
    <aside className="md:hidden fixed inset-x-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-2xl border border-white/10 bg-jet-dark/95 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur" aria-label="Install PredictTheBall">
      <div className="flex gap-3">
        <img src="/icon-192-maskable.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Install PredictTheBall</p>
          <p className="mt-1 text-xs leading-5 text-teal-muted">{instruction}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canPrompt && (
              <button
                type="button"
                onClick={handleInstall}
                className="rounded-lg bg-teal px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-muted"
              >
                Install
              </button>
            )}
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-teal-muted transition-colors hover:bg-white/5 hover:text-white"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
