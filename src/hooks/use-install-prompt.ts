import { useState, useEffect, useRef } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false)
  const promptEventRef = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      promptEventRef.current = e as BeforeInstallPromptEvent
      setCanInstall(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const showInstallPrompt = async () => {
    if (!promptEventRef.current) return

    await promptEventRef.current.prompt()
    const { outcome } = await promptEventRef.current.userChoice

    if (outcome === 'accepted') {
      setCanInstall(false)
      promptEventRef.current = null
    }
  }

  return { canInstall, showInstallPrompt, setCanInstall }
}
