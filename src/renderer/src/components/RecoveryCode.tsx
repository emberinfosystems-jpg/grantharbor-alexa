/**
 * Shows a freshly-issued recovery code, once.
 *
 * 🛑 This is the ONLY time the code is ever visible. It is stored as a scrypt hash, so
 * nothing — not the app, not the database, not a support request — can show it again. The
 * copy has to carry that weight without being alarming, and the dialog must not be
 * dismissable by accident: the confirm control is deliberately a checkbox, not a lone
 * "Close" button that a reflex click makes disappear forever.
 */
import { useState } from 'react'
import { KeyRound, Copy, Check } from 'lucide-react'
import { Button } from '@ember/ui'

export default function RecoveryCode({ code, onDone }: { code: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be denied; the code is on screen to be written down either way.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Save your recovery code</h2>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          This code is the only way back into your account if you forget your password.
          Write it down or keep it somewhere safe and separate from this computer.
        </p>

        <div className="mt-4 rounded-md border border-border bg-secondary p-4 text-center">
          <code className="select-all font-mono text-lg font-semibold tracking-wider">{code}</code>
        </div>

        <div className="mt-3 flex justify-center">
          <Button variant="outline" size="sm" icon={copied ? Check : Copy} onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy code'}
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          We cannot show this code again — it is stored scrambled, so nobody can read it back
          out, including us. You can generate a new one any time from Settings.
        </p>

        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
          />
          <span>I have saved this code somewhere safe.</span>
        </label>

        <Button className="mt-4 w-full" disabled={!saved} onClick={onDone}>
          Continue
        </Button>
      </div>
    </div>
  )
}
