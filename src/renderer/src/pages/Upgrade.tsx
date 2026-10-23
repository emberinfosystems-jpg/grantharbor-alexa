import { useState } from 'react'
import { Check, Sparkles, Zap, KeyRound, AlertTriangle, ExternalLink } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Label, Switch } from '@ember/ui'
import { bridge } from '../lib/bridge'
import { usePlan } from '../lib/usePlan'
import { LOCAL_MODE } from '../lib/db'

// GrantHarbor Pro paywall. The revenue lever: Basic = manual email import;
// Pro = the automated ingestion agent that pulls grant opportunities for you.
//
// 🛑 RECONCILED 2026-08-24 against Pricing_Matrix (the canon):
//     | GrantGuard | Financial | $39 one-time | +$19/mo ingestion |
// This page had shipped "Basic Free / Pro $29/mo" — BOTH numbers wrong, and the $29
// was not even this app's price: it is the Phoenix Pro BUNDLE SKU, copied here by
// mistake. A paywall quoting another product's price is the kind of thing that is
// only ever caught by reading the canon, never by the build.
//
// The shape matters as much as the number: one-time for the app, recurring ONLY for
// the ingestion agent, which is the one part with a genuine recurring cost. Same rule
// as BUSINESS_IN_A_BOX §4 — that doc cites this app as its precedent.
const BASIC_PRICE = { amount: '$16.99', qualifier: 'one-time fee' }
const PRO_PRICE = { amount: '+$19', qualifier: 'per month' }

const BASIC = [
  'Track grants, applications & deadlines',
  // 🛑 Deadline alerts are BASIC, not Pro. They operate on grants the user entered
  // themselves — charging to be warned about your own data is the kind of thing that
  // makes people distrust every other line on this page.
  'Deadline reminders at 14, 7, 3 and 1 days',
  'Manual email import of opportunities',
  'Investor & approved-sender lists',
  'Funding overview & calendar',
]
// 🛑 THIS LIST IS A SALES CLAIM. Every line must name something that exists in the build.
// "Deadline & match alerts" was REMOVED on 2026-08-24 because nothing in the app sent an
// alert of any kind. Alerts shipped 2026-08-25, so the claim returns — but split honestly:
// deadline reminders went to BASIC (they are about the user's own data), and only the
// match alert, which requires the agent, belongs here.
const PRO = [
  'Everything in Basic',
  'Ingestion agent — scans open federal opportunities for you',
  'On-device keyword matching (your keywords never leave your computer)',
  'Alerts when the agent finds a match',
  'Bulk import & automatic de-duplication',
  'Priority support',
]

type Price = { amount: string; qualifier?: string }

function Plan({
  name, price, blurb, features, highlight, cta, onCta, disabled
}: {
  name: string; price: Price; blurb: string; features: string[]
  highlight?: boolean; cta: string; onCta?: () => void; disabled?: boolean
}) {
  return (
    <div
      className={
        'rounded-xl border p-6 flex flex-col ' +
        (highlight
          ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/30'
          : 'border-border bg-card')
      }
    >
      <div className="flex items-center gap-2">
        {highlight && <Sparkles className="h-4 w-4 text-primary" />}
        <h3 className="text-lg font-semibold">{name}</h3>
      </div>
      {/* The amount stays the big number; the qualifier ("one-time fee", "per month")
          rides beside it at body size so spelling the terms out does not wrap the
          headline price onto two lines. */}
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold">{price.amount}</span>
        {price.qualifier && (
          <span className="text-sm font-medium text-muted-foreground">{price.qualifier}</span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>
      <ul className="mt-4 space-y-2 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {/* variant was 'default' — not a variant ember-ui defines. VARIANTS['default'] is
          undefined, so the highlighted Upgrade CTA rendered with NO background at all.
          Caught the moment the rails got real types; invisible to the build, and to any
          render check that only asked "did the page draw?" */}
      <Button
        className="mt-6 w-full"
        variant={highlight ? 'primary' : 'outline'}
        icon={highlight ? Zap : undefined}
        onClick={onCta}
        disabled={disabled}
      >
        {cta}
      </Button>
    </div>
  )
}

export default function Upgrade({ email }: { email?: string | null }) {
  const plan = usePlan(email)
  const [key, setKey] = useState('')
  // Mobile (local) has no signed-in account, but a license is bound to the email it was issued to.
  // So on mobile the activation form collects that email; on desktop the account email is used.
  const [actEmail, setActEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // 🛑 Purchase opens the user's REAL browser, it does not happen in an app window. People
  // need the address bar and the padlock on a page that takes their money, and an Electron
  // window can show neither. Replaces a `startCheckout()` that dispatched a CustomEvent
  // nothing listened for — a Buy button wired to nothing.
  const startCheckout = () => { void bridge()?.openPurchase() }

  const activate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const api = bridge()
    // Desktop passes the signed-in account email; mobile collects it in the form (actEmail).
    const useEmail = (email || actEmail).trim().toLowerCase()
    if (!api) { setError('Activation runs in the app.'); return }
    if (!useEmail) { setError('Enter the email your license was issued to.'); return }
    setBusy(true); setError('')
    try {
      await api.licenseActivate(key, useEmail)
      await plan.refresh()
      setKey('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" /> GrantHarbor Pro
        </div>
        <h1 className="mt-3 text-2xl font-bold">Stop hunting. Let the agent bring the grants to you.</h1>
        {/* Once said "so nothing slips past a deadline" while the app had no alerts at all.
            Deadline watching now exists (lib/alerts.ts, shipped 2026-08-25) — but it lives
            in BASIC, so this Pro headline still stays about the finding, not the watching. */}
        <p className="mt-2 text-sm text-muted-foreground">
          Basic keeps you organized. Pro adds the ingestion agent — it scans open federal
          opportunities and brings back the ones that match what you do.
        </p>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <Plan
          name="Basic"
          price={BASIC_PRICE}
          blurb="Yours once. Everything you need to stay organized."
          features={BASIC}
          cta={plan.isPro ? 'Included in Pro' : 'Your current plan'}
        />
        <Plan
          name="Pro"
          price={PRO_PRICE}
          blurb="The agent does the finding."
          features={PRO}
          highlight
          cta={plan.isPro ? 'Active' : 'Subscribe to Pro'}
          onCta={plan.isPro ? undefined : startCheckout}
        />
      </div>

      {/* 🛑 The old copy ended "Pricing to be confirmed against the billing catalog" — an
          INTERNAL note rendered to the customer on the payment page. Replaced with the
          actual terms. "Cancel anytime" applies to the ingestion subscription only; the
          $39 is a one-time purchase and cancelling does not claw it back. */}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        GrantHarbor is a one-time purchase. The ingestion agent is a separate monthly
        add-on you can cancel anytime — cancelling keeps the app, it just stops the agent.
      </p>

      {(
      <div className="mt-8">
        {plan.isPro ? (
          <Card>
            <CardHeader><CardTitle>Pro is active</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <div>Licensed to <span className="font-medium text-foreground">{plan.licensedTo}</span></div>
              {plan.issued && <div>Activated {plan.issued}</div>}
              {plan.order && <div>Order {plan.order}</div>}
              {/* 🛑 BOTH DATES, TOGETHER, EQUALLY PROMINENT.
                  Showing only "access through" would hide the one that costs money: the
                  15-day buffer sits between them, so a customer reading a single date is
                  reading the wrong one and gets charged two weeks before they expect.
                  "Renews" is listed FIRST because it is the date they need to act on. */}
              {plan.accessThrough && (
                <div className="!mt-3 grid gap-3 sm:grid-cols-2">
                  {/* 🛑 When auto-renew is OFF the heading and the value have to change
                      together. Showing "Card is next charged — 25 Sep" and then "you will
                      not be charged again" underneath puts a date and its own contradiction
                      in the same box, and the date is the part people remember. */}
                  <div className="rounded-md border border-border bg-secondary/40 p-3">
                    {plan.autoRenew === false ? (
                      <>
                        <div className="text-xs uppercase tracking-wide">Billing</div>
                        <div className="mt-0.5 text-base font-semibold text-foreground">Cancelled</div>
                        <div className="mt-0.5 text-xs">
                          No further charges. Turn the switch back on to resume.
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs uppercase tracking-wide">Card is next charged</div>
                        <div className="mt-0.5 text-base font-semibold text-foreground">
                          {plan.renewsOn ?? '—'}
                        </div>
                        <div className="mt-0.5 text-xs">$19, then again each month.</div>
                      </>
                    )}
                  </div>
                  <div className="rounded-md border border-border bg-secondary/40 p-3">
                    <div className="text-xs uppercase tracking-wide">Pro access runs until</div>
                    <div className="mt-0.5 text-base font-semibold text-foreground">
                      {plan.accessThrough}
                      {plan.inGrace && <span className="text-destructive"> ⚠</span>}
                    </div>
                    <div className="mt-0.5 text-xs">
                      {plan.inGrace
                        ? 'Renewal is overdue — Pro stops soon.'
                        : 'Deliberately later than the billing date, so a failed payment never cuts you off mid-week.'}
                    </div>
                  </div>
                </div>
              )}
              {plan.accessThrough && (
                <div className="!mt-3 flex flex-wrap items-center gap-3 rounded-md border border-border bg-secondary/40 p-3">
                  <Switch
                    checked={plan.autoRenew !== false}
                    onCheckedChange={(on: boolean) => { void bridge()?.autoRenew(on).then(() => plan.refresh()) }}
                  />
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="font-medium text-foreground">Keep my subscription running</div>
                    {/* 🛑 Says exactly what the switch does, both halves. Turning it off has
                        to stop the network call AND the billing, or one of the two becomes a
                        thing done to the customer behind a friendly label. */}
                    <div>
                      On: GrantHarbor collects your renewal about once a month, and your
                      subscription continues. Off: it stops contacting us and stops renewing —
                      you keep Pro until {plan.accessThrough}, then return to Basic.
                    </div>
                  </div>
                </div>
              )}
              {/* 🛑 This line used to read "…and does not check in with us" for EVERY
                  licence — directly contradicting the auto-renew toggle a few pixels above
                  it, which says GrantHarbor collects a renewal monthly. Both cannot be true.
                  A perpetual licence really never contacts anything; a subscription contacts
                  us about once a cycle. Saying the offline-friendly version to everyone is
                  the comfortable lie, and it is the exact class of error this codebase keeps
                  catching in its own comments. */}
              <p className="pt-2">
                {plan.accessThrough ? (
                  <>
                    Your license is checked on this computer, never online — so the agent keeps
                    working with no internet connection. The only time GrantHarbor contacts us
                    is to collect your monthly renewal, and the switch above turns that off.
                  </>
                ) : (
                  <>
                    Your license is verified on this computer. GrantHarbor never contacts us
                    about it — the app keeps working with no internet connection, and for as
                    long as you own the computer.
                  </>
                )}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle>Already bought Pro?</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={(e) => void activate(e)} className="flex max-w-xl flex-col gap-3">
                {LOCAL_MODE && (
                  <div>
                    <Label>Account email</Label>
                    <Input
                      value={actEmail}
                      onChange={(e) => setActEmail(e.target.value)}
                      placeholder="the email you subscribed with"
                      type="email"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                )}
                <div>
                  <Label>License key</Label>
                  <Input
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-…"
                    className="font-mono text-xs"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                {error && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><span>{error}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" icon={KeyRound} loading={busy} disabled={busy || !key.trim()}>
                    Activate
                  </Button>
                  <Button type="button" variant="outline" icon={ExternalLink} onClick={startCheckout}>
                    Buy Pro
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your key is checked on this computer, not sent to us. Activation works
                  offline, and the agent keeps working whether or not we are around.
                </p>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
      )}
    </div>
  )
}
