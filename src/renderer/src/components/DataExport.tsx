/**
 * "Export my data" — delivering a promise the privacy policy already made.
 *
 * 🛑 This sits in Settings next to Delete Account on purpose. Portability and erasure are the
 * two rights a person exercises when they are leaving, and a product that makes leaving easy
 * is the only kind that has earned staying. Burying the export would contradict the policy
 * that advertises it.
 */
import { useState } from 'react'
import { Download, Check, AlertTriangle, FolderOpen } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@ember/ui'
import { buildExport, exportSummary } from '../lib/exportData'
import { bridge } from '../lib/bridge'
import type { useStore } from '../state/useStore'

export default function DataExport({
  store,
  email
}: {
  store: ReturnType<typeof useStore>
  email?: string | null
}) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ dir: string; summary: string } | null>(null)
  const [error, setError] = useState('')

  const available = !!bridge()

  const run = async (): Promise<void> => {
    const api = bridge()
    if (!api) { setError('Export runs in the desktop app.'); return }
    setBusy(true); setError(''); setDone(null)
    try {
      const files = buildExport({
        email,
        grants: store.grants,
        investors: store.investors,
        approvedSenders: store.approvedSenders,
        profiles: store.profiles,
        preferences: store.preferences
      })
      const res = await api.exportData(files)
      // 🛑 Cancelling the folder picker is not an error. Reporting "export failed" when
      // someone simply changed their mind teaches them the feature is broken.
      if (!res.saved) { if (res.reason) setError(res.reason); return }
      setDone({ dir: res.dir ?? '', summary: exportSummary(files) })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Export your data</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-3 max-w-prose text-sm text-muted-foreground">
          Everything GrantHarbor holds for your account — grants, investors, applications,
          profiles and settings — written to a folder you choose. You get one JSON file with
          the complete structured record, plus a CSV per table for spreadsheets.
        </p>
        {/* 🛑 Say plainly that this is the whole record. The policy promises portability;
            a user has no way to know whether an export is complete unless told. */}
        <p className="mb-4 max-w-prose text-xs text-muted-foreground">
          This is the entire record. Your data lives on this computer only — we hold no copy,
          so there is nothing further to request from us.
        </p>

        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><span>{error}</span>
          </div>
        )}
        {done && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-primary/40 bg-primary/5 p-2.5 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Exported {done.summary}.
              <span className="mt-0.5 block break-all font-mono text-xs text-muted-foreground">{done.dir}</span>
            </span>
          </div>
        )}

        {available ? (
          <Button icon={busy ? FolderOpen : Download} loading={busy} disabled={busy} onClick={() => void run()}>
            {busy ? 'Exporting…' : 'Export my data'}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Export runs in the desktop app.</p>
        )}
      </CardContent>
    </Card>
  )
}
