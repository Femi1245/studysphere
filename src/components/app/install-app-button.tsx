import { useState } from 'react'
import { Download, Share } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { usePwaInstall } from '@/contexts/pwa-install-context'

export function InstallAppButton({ compact = false }: { compact?: boolean }) {
  const { canPromptInstall, isInstalled, isIos, install } = usePwaInstall()
  const [instructionsOpen, setInstructionsOpen] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)

  if (isInstalled) return null

  const handleInstall = async () => {
    setInstallError(null)
    if (!canPromptInstall) {
      setInstructionsOpen(true)
      return
    }

    try {
      const outcome = await install()
      if (outcome === 'unavailable' || outcome === 'dismissed') {
        setInstructionsOpen(true)
      }
    } catch (error) {
      setInstallError(error instanceof Error ? error.message : 'The install prompt could not be opened.')
      setInstructionsOpen(true)
    }
  }

  return (
    <>
      <Button
        type="button"
        size={compact ? 'icon' : 'sm'}
        variant="outline"
        aria-label="Install StudySphere app"
        onClick={() => void handleInstall()}
      >
        <Download className="h-4 w-4" aria-hidden />
        {compact ? <span className="sr-only">Install app</span> : 'Install app'}
      </Button>

      <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install StudySphere</DialogTitle>
            <DialogDescription>
              Add StudySphere to your home screen for an app-like experience. An internet connection is needed for your account and saved study data.
            </DialogDescription>
          </DialogHeader>

          {installError ? (
            <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
              {installError}
            </p>
          ) : null}

          {isIos ? (
            <ol className="list-decimal space-y-3 pl-5 text-sm text-ink-muted">
              <li>Open this page in Safari.</li>
              <li className="flex items-center gap-2">
                Tap <Share className="h-4 w-4 text-primary-600" aria-label="Share" /> Share in the browser toolbar.
              </li>
              <li>Scroll the share menu and choose <strong className="text-ink">Add to Home Screen</strong>.</li>
              <li>Tap <strong className="text-ink">Add</strong> to finish.</li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-3 pl-5 text-sm text-ink-muted">
              <li>Open the browser menu (usually the three-dot menu).</li>
              <li>Choose <strong className="text-ink">Install app</strong> or <strong className="text-ink">Add to Home screen</strong>.</li>
              <li>Confirm the prompt. StudySphere will appear with your other apps.</li>
            </ol>
          )}

          <p className="text-xs text-ink-muted">
            Use the latest Chrome or Edge on Android/desktop, or Safari on iPhone/iPad. The install option requires the site to be served over HTTPS.
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
