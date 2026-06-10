import { createContext, useContext } from 'react'

export const InstallPromptContext = createContext(null)

export function useInstallPrompt() {
  const context = useContext(InstallPromptContext)
  if (!context) {
    throw new Error('useInstallPrompt must be used within InstallPromptProvider')
  }

  return context
}
