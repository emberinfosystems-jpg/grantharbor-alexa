/**
 * Report a problem.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🛑 THIS DOES NOT SEND ANYTHING. Three reasons, and all three are load-bearing:
 *
 * 1. The app has no server. A "submit" button would need one, and standing one up to
 *    receive bug reports would put a live endpoint behind an app whose entire promise is
 *    that it works with the network unplugged.
 * 2. It would change the published data-flow map. Legal.tsx declares exactly one outbound
 *    connection (Grants.gov, no user data). Silently POSTing a user's typed description —
 *    which can contain anything, including details of their business — to an EIS endpoint
 *    would make that page false.
 * 3. A bug report is a message sent under the user's name. They should see every word of
 *    it, including the diagnostics, before any of it leaves their machine.
 *
 * So the report is BUILT here and handed to the user: copy it, save it, or open it in their
 * own mail client. They press send, from their own account, having read it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState } from 'react'
import { Bug, Copy, Check, Save, Mail, AlertTriangle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Textarea, Label, Button } from '@ember/ui'
import { bridge } from '../lib/bridge'

// 🛑 A support address on a domain EIS does not own bounces silently — the customer
// believes they asked for help and simply never hears back. This is the address the live
// storefront uses.
const SUPPORT_EMAIL = 'support@emberinformation.com'

export default function ReportBug() {
  const [what, setWhat] = useState('')
  const [steps, setSteps] = useState('')
  const [diag, setDiag] = useState<Record<string, unknown> | null>(null)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const api = bridge()
    if (!api) return
    void api.diagnostics().then(setDiag).catch(() => setDiag(null))
  }, [])

  const diagLines = diag
    ? Object.entries(diag).map(([k, v]) => `  ${k}: ${String(v)}`).join('\n')
    : '  (unavailable)'

  const report =
    `GrantHarbor bug report\n` +
    `Date: ${new Date().toISOString()}\n\n` +
    `WHAT HAPPENED\n${what.trim() || '(not described)'}\n\n` +
    `STEPS TO REPRODUCE\n${steps.trim() || '(not described)'}\n\n` +
    `ENVIRONMENT\n${diagLines}\n`

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy — select the text below and copy it manually.')
    }
  }

  const save = async (): Promise<void> => {
    const api = bridge()
    if (!api) return
    setError(''); setSaved('')
    try {
      const res = await api.saveReport(report)
      if (res.saved && res.filePath) setSaved(res.filePath)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  // mailto opens the user's own mail client with the report prefilled. Nothing is sent
  // until they press send there, in an app they control, having read the whole thing.
  const mailto =
    `mailto:${SUPPORT_EMAIL}` +
    `?subject=${encodeURIComponent('GrantHarbor bug report')}` +
    `&body=${encodeURIComponent(report)}`

  return (
    <Card>
      <CardHeader><CardTitle>Report a problem</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="max-w-prose text-sm text-muted-foreground">
          Tell us what went wrong. GrantHarbor will assemble a report — including the version
          and system details below — for you to send. <strong>Nothing is transmitted by the
          app.</strong> You review it and send it yourself.
        </p>

        <div className="max-w-xl space-y-3">
          <div>
            <Label>What happened?</Label>
            <Textarea
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              placeholder="The Discover page showed an error when I clicked Find opportunities…"
              rows={3}
            />
          </div>
          <div>
            <Label>What were you doing? (optional)</Label>
            <Textarea
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder="1. Opened Settings  2. Changed my password  3. …"
              rows={3}
            />
          </div>
        </div>

        {/* 🛑 The diagnostics are SHOWN, not hidden behind a checkbox. A report that quietly
            attaches information about someone's machine is the thing people are right to be
            suspicious of; showing it costs nothing and removes the question entirely. */}
        <details className="max-w-xl rounded-md border border-border bg-secondary/50 p-3">
          <summary className="cursor-pointer text-sm font-medium">
            What gets included ({diag ? Object.keys(diag).length : 0} system details — no personal data)
          </summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">{diagLines}</pre>
          <p className="mt-2 text-xs text-muted-foreground">
            Your grants, applications, investors, business details and email address are never
            included.
          </p>
        </details>

        {error && (
          <div className="flex max-w-xl items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><span>{error}</span>
          </div>
        )}
        {saved && (
          <div className="flex max-w-xl items-start gap-2 rounded-md border border-primary/40 bg-primary/5 p-2.5 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>Saved to <code className="text-xs">{saved}</code></span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button icon={copied ? Check : Copy} onClick={() => void copy()} disabled={!what.trim()}>
            {copied ? 'Copied' : 'Copy report'}
          </Button>
          <Button variant="outline" icon={Save} onClick={() => void save()} disabled={!what.trim() || !bridge()}>
            Save to file
          </Button>
          <Button variant="outline" icon={Mail} onClick={() => { window.location.href = mailto }} disabled={!what.trim()}>
            Open in email
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          <Bug className="mr-1 inline h-3 w-3" />
          Send to <span className="font-medium">{SUPPORT_EMAIL}</span>
        </p>
      </CardContent>
    </Card>
  )
}
