import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

interface PwaInstallContextValue {
  canPromptInstall: boolean
  isInstalled: boolean
  isIos: boolean
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null)

function isIosDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function isRunningInstalled() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && navigator.standalone === true)
  )
}

export function PwaInstallProvider({ children }: { children: React.ReactNode }) {
  const promptEvent = useRef<InstallPromptEvent | null>(null)
  const [canPromptInstall, setCanPromptInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(isRunningInstalled)
  const isIos = useMemo(isIosDevice, [])

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault()
      promptEvent.current = event as InstallPromptEvent
      setCanPromptInstall(true)
    }

    const handleInstalled = () => {
      promptEvent.current = null
      setCanPromptInstall(false)
      setIsInstalled(true)
    }

    const standaloneQuery = window.matchMedia('(display-mode: standalone)')
    const handleDisplayModeChange = () => setIsInstalled(isRunningInstalled())

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleInstalled)
    standaloneQuery.addEventListener('change', handleDisplayModeChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
      standaloneQuery.removeEventListener('change', handleDisplayModeChange)
    }
  }, [])

  const install = useCallback(async () => {
    const event = promptEvent.current
    if (!event) return 'unavailable' as const

    await event.prompt()
    const { outcome } = await event.userChoice
    promptEvent.current = null
    setCanPromptInstall(false)
    return outcome
  }, [])

  const value = useMemo(
    () => ({ canPromptInstall, isInstalled, isIos, install }),
    [canPromptInstall, isInstalled, isIos, install],
  )

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>
}

export function usePwaInstall() {
  const context = useContext(PwaInstallContext)
  if (!context) throw new Error('usePwaInstall must be used within PwaInstallProvider')
  return context
}
