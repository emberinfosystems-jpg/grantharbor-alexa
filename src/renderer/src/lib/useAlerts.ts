/**
 * The alert engine: computes what is due, remembers what it already said, and delivers.
 *
 * 🛑 THERE IS NO BACKGROUND SERVICE, AND THE UI SAYS SO. Alerts are evaluated when the app
 * opens and on a timer while it is running. A desktop app that is closed cannot warn anyone,
 * and pretending otherwise ("we'll email you") is precisely the claim that was pulled off
 * the Pro list on 2026-08-25 for not existing. What is promised here is what runs.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { deadlineAlerts, matchAlert, urgentCount, todayISO, type Alert } from './alerts'
import { bridge } from './bridge'
import type { Grant } from './grantTypes'

/** Re-evaluate every 30 minutes. Deadlines move once a day; this only has to catch midnight. */
const CHECK_MS = 30 * 60 * 1000

/**
 * 🛑 The fired-set is keyed PER ACCOUNT. Two people on one machine must not inherit each
 * other's "already told you" state — the second user would silently never hear about their
 * own deadlines.
 */
function firedKey(accountId: string): string {
  return `grantharbor:alerts:fired:${accountId}`
}

function loadFired(accountId: string): Set<string> {
  try {
    const raw = localStorage.getItem(firedKey(accountId))
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveFired(accountId: string, fired: Set<string>): void {
  try {
    // 🛑 Bounded. A grant that lives for years accumulates ids forever, and localStorage
    // has a hard quota — silently exceeding it throws and the app stops remembering what
    // it already said, which turns into duplicate alerts for everything.
    const arr = [...fired].slice(-500)
    localStorage.setItem(firedKey(accountId), JSON.stringify(arr))
  } catch {
    /* quota or private mode — worst case we repeat an alert, never a crash */
  }
}

export function useAlerts(
  grants: Grant[],
  accountId: string | null,
  opts: { desktopEnabled: boolean; inAppEnabled: boolean }
) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const firedRef = useRef<Set<string>>(new Set())
  const [tick, setTick] = useState(0)

  useEffect(() => {
    firedRef.current = accountId ? loadFired(accountId) : new Set()
    setAlerts([])
    setDismissed(new Set())
  }, [accountId])

  // Re-check on a timer AND when the grant list changes.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), CHECK_MS)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!accountId) return
    const fresh = deadlineAlerts(grants, firedRef.current, todayISO())
    if (!fresh.length) return

    for (const a of fresh) firedRef.current.add(a.id)
    saveFired(accountId, firedRef.current)
    setAlerts((prev) => [...fresh, ...prev].slice(0, 100))

    // 🛑 Desktop notifications are OPT-OUT-ABLE and rate-limited to the urgent ones. Firing
    // a toast for every "due in 14 days" trains people to dismiss them without reading,
    // which is how the genuinely urgent one gets dismissed too.
    if (opts.desktopEnabled) {
      const loud = fresh.filter((a) => a.severity === 'urgent').slice(0, 3)
      for (const a of loud) void bridge()?.notify(a.title, a.body, true)
    }
  }, [grants, accountId, tick, opts.desktopEnabled])

  /** Called by Discover after an ingestion run. */
  const notifyMatches = useCallback(
    (count: number) => {
      if (!accountId) return
      const a = matchAlert(count, firedRef.current)
      if (!a) return
      firedRef.current.add(a.id)
      saveFired(accountId, firedRef.current)
      setAlerts((prev) => [a, ...prev].slice(0, 100))
      if (opts.desktopEnabled) void bridge()?.notify(a.title, a.body, false)
    },
    [accountId, opts.desktopEnabled]
  )

  const visible = useMemo(
    () => (opts.inAppEnabled ? alerts.filter((a) => !dismissed.has(a.id)) : []),
    [alerts, dismissed, opts.inAppEnabled]
  )

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set(prev).add(id))
  }, [])

  const dismissAll = useCallback(() => {
    setDismissed(new Set(alerts.map((a) => a.id)))
  }, [alerts])

  return { alerts: visible, badge: urgentCount(visible), dismiss, dismissAll, notifyMatches }
}
