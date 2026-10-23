import { useState } from 'react'
import { AlertTriangle, Mail, Shield, Bell, Sun, Moon } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Select, Switch, Button, cn } from '@ember/ui'
import { pb, currentUserId, signOut } from '../lib/db'
import { getTheme, setTheme, type Theme } from '../lib/theme'
import type { useStore } from '../state/useStore'
import SecuritySettings from '../components/SecuritySettings'
import DataExport from '../components/DataExport'
import ReportBug from '../components/ReportBug'
import AlexaConnect from '../components/AlexaConnect'

export default function Settings({ store }: { store: ReturnType<typeof useStore> }) {
  const { preferences, savePreferences, grants, approvedSenders } = store
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [theme, setThemeState] = useState<Theme>(getTheme())

  function pickTheme(t: Theme) { setTheme(t); setThemeState(t) }

  const email = (pb.authStore.record?.email as string | undefined) ?? '—'
  const emailOn = preferences?.notify_email ?? true
  const inAppOn = preferences?.notify_in_app ?? true
  const frequency = preferences?.email_frequency ?? 'daily'

  async function deleteAccount() {
    const uid = currentUserId()
    if (!uid) return
    setDeleting(true)
    try {
      await pb.collection('users').delete(uid)
      signOut()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Manage your account and how GrantHarbor alerts you.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">Choose a light or navy dark theme.</div>
            <div className="inline-flex overflow-hidden rounded-lg border border-border">
              <button onClick={() => pickTheme('light')} className={cn('flex items-center gap-1.5 px-4 py-2 text-sm', theme === 'light' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary')}>
                <Sun size={15} /> Light
              </button>
              <button onClick={() => pickTheme('dark')} className={cn('flex items-center gap-1.5 border-l border-border px-4 py-2 text-sm', theme === 'dark' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary')}>
                <Moon size={15} /> Dark
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary text-base font-bold">
                {email.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 truncate text-sm font-medium"><Mail size={14} className="text-muted-foreground" />{email}</div>
                <div className="text-xs text-muted-foreground">Local account · data stored on this device</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-lg bg-secondary px-3 py-2">
                <div className="text-xs text-muted-foreground">Grants tracked</div>
                <div className="text-lg font-bold">{grants.length}</div>
              </div>
              <div className="rounded-lg bg-secondary px-3 py-2">
                <div className="text-xs text-muted-foreground">Trusted senders</div>
                <div className="text-lg font-bold">{approvedSenders.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <Row
              icon={Bell}
              label="Deadline &amp; match alerts"
              hint="Warn me as grant deadlines approach, and when the agent finds a match."
            >
              <Switch checked={inAppOn} onCheckedChange={(v: boolean) => savePreferences({ notify_in_app: v })} />
            </Row>

            {/* 🛑 EMAIL ALERTS AND THE FREQUENCY PICKER ARE GONE, NOT DISABLED.
                They were switches wired to nothing: the shipped PocketBase has SMTP off
                (`smtp.example.com` placeholder, verified 2026-08-25), so no email could
                ever be sent, at any frequency. A toggle that is ON and does nothing is
                worse than an absent feature — the user believes they are covered, stops
                watching their own dates, and misses a deadline the app promised to catch.
                The `notify_email` / `email_frequency` columns stay in the schema so nothing
                is lost; the moment real email exists, this comes back. */}
            <div className="border-b border-border py-3 last:border-0">
              <div className="flex items-start gap-2.5">
                <Mail size={16} className="mt-0.5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Email alerts</div>
                  <div className="text-xs text-muted-foreground">
                    Not available yet — GrantHarbor cannot send email. Alerts appear in the
                    app and as desktop notifications while it is running.
                  </div>
                </div>
              </div>
            </div>

            {/* 🛑 Says the limit out loud. A desktop app that is closed cannot warn anyone,
                and letting someone assume otherwise is how a deadline gets missed. */}
            <p className="pt-2 text-xs text-muted-foreground">
              Deadlines are checked when GrantHarbor opens and every 30 minutes while it is
              running. You are warned 14, 7, 3 and 1 days out, and on the day itself.
            </p>
          </CardContent>
        </Card>
      </div>

      <AlexaConnect />

      <Card className="border-destructive/40">
        <CardHeader><CardTitle className="text-destructive">Danger zone</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-destructive" />
            <div className="flex-1">
              <div className="text-sm font-medium">Delete account</div>
              <p className="mt-1 text-sm text-muted-foreground">Permanently deletes your account and all grants, investors, senders, and profiles. This cannot be undone.</p>
              {confirming ? (
                <div className="mt-3 flex items-center gap-2">
                  <Button variant="destructive" size="sm" loading={deleting} onClick={deleteAccount}>Yes, delete everything</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="mt-3 border-destructive/40 text-destructive" onClick={() => setConfirming(true)}>Delete account</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <SecuritySettings email={email} />

      <DataExport store={store} email={email} />

      <ReportBug />
    </div>
  )
}

function Row({ icon: Icon, label, hint, children }: { icon: typeof Mail; label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <div className="flex items-start gap-2.5">
        <Icon size={16} className="mt-0.5 text-muted-foreground" />
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
      </div>
      {children}
    </div>
  )
}
