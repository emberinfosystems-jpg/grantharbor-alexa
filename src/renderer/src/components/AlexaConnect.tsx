// "Voice — Alexa+" settings card. Surfaces the Alexa+ integration IN the app so it's visible, and
// walks the user through the real connection flow (Amazon's MCP add-on account-linking):
//   enable the GrantHarbor add-on in the Alexa app → scan QR / sign in → approve scopes → Voice-ID gated.
//
// 🛑 The link itself is established on the Alexa side (OAuth 2.1 account-linking), so the app can't
// detect it directly — the user confirms here (a common pattern for Alexa-linked apps). The connected
// flag is a per-device convenience in localStorage; it never gates anything security-relevant.
import { useState } from 'react'
import { Mic, Check, ShieldCheck, Smartphone, X, ExternalLink } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, cn } from '@ember/ui'

const FLAG = 'grantharbor.alexa.connected'
const readFlag = (): boolean => { try { return localStorage.getItem(FLAG) === '1' } catch { return false } }
const writeFlag = (v: boolean): void => { try { v ? localStorage.setItem(FLAG, '1') : localStorage.removeItem(FLAG) } catch { /* private mode */ } }

export default function AlexaConnect() {
  const [connected, setConnected] = useState(readFlag)
  const [open, setOpen] = useState(false)

  const link = () => { writeFlag(true); setConnected(true); setOpen(false) }
  const unlink = () => { writeFlag(false); setConnected(false) }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mic size={18} className="text-primary" /> Voice — Alexa+</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Apply to grants hands-free. Link GrantHarbor to Alexa+, then say{' '}
          <span className="font-medium text-foreground">&ldquo;Alexa, apply for the USDA food grant&rdquo;</span>{' '}
          — it drafts the application from your profile and waits for your approval.
        </p>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-secondary/50 px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <span className={cn('inline-block h-2 w-2 rounded-full', connected ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
            {connected ? 'Connected to Alexa+' : 'Not connected'}
          </div>
          {connected
            ? <Button variant="ghost" size="sm" onClick={unlink}>Disconnect</Button>
            : <Button size="sm" icon={Mic} onClick={() => setOpen(true)}>Connect with Alexa</Button>}
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary" />
          <span>
            Secured by <span className="font-medium text-foreground">Alexa Voice ID</span> — only your voice can
            invoke it. GrantHarbor never auto-submits; every application waits for your approval.
          </span>
        </div>
      </CardContent>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Connect Alexa">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full sm:max-w-md bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-4 h-12 border-b border-border">
              <span className="font-heading font-bold flex items-center gap-2"><Mic size={16} className="text-primary" /> Connect Alexa+</span>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="p-2 -mr-2 text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <Step n={1} icon={Smartphone}>Open the <span className="font-medium">Alexa app</span> on your phone.</Step>
              <Step n={2}>Find <span className="font-medium">GrantHarbor</span> under Alexa+ add-ons and enable it.</Step>
              <Step n={3}>Scan the QR code or tap the sign-in prompt, and <span className="font-medium">log in to GrantHarbor</span> to link your account.</Step>
              <Step n={4}>Approve the permissions (read your grants &amp; profile, draft applications).</Step>
              <p className="pt-1 text-xs text-muted-foreground">
                Linking uses your GrantHarbor account and Amazon&rsquo;s secure OAuth flow — Alexa never sees your password.
              </p>
              <a href="https://alexa.amazon.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                <ExternalLink size={14} /> Open the Alexa app
              </a>
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" icon={Check} onClick={link}>I&rsquo;ve linked GrantHarbor</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

function Step({ n, icon: Icon, children }: { n: number; icon?: typeof Mic; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary text-xs font-bold">{n}</span>
      <div className="flex items-start gap-1.5 pt-0.5">
        {Icon && <Icon size={14} className="mt-0.5 shrink-0 text-muted-foreground" />}
        <span>{children}</span>
      </div>
    </div>
  )
}
