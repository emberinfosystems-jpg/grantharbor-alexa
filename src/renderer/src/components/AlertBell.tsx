/**
 * The alert bell + panel in the app header.
 *
 * 🛑 The badge counts URGENT AND WARNING ONLY, never the informational ones. A badge that
 * shows "23" when 22 of them are "due in 14 days" is a badge people learn to ignore, and
 * the day it means something they will ignore it too.
 */
import { useEffect, useRef, useState } from 'react'
import { Bell, X, AlertTriangle, Clock, Sparkles } from 'lucide-react'
import type { Alert } from '../lib/alerts'

/**
 * 🛑 `border-l-*` LONGHAND, deliberately — not the `border-*` shorthand.
 *
 * The list used `divide-y divide-border` for separators plus `border-destructive/50` for
 * the severity stripe. Tailwind's `divide-*` emits `border-color` on every child AFTER the
 * first, so it overwrote the severity colour on all of them: item 1 showed a red stripe and
 * items 2, 3 and 4 showed the default grey — verified in the DOM, three of four wrong.
 *
 * A tinted background made it look deliberate, which is why nothing about the screen said
 * "broken". Separator and stripe now use different longhand properties and cannot collide.
 */
const TONE: Record<Alert['severity'], string> = {
  urgent: 'border-l-destructive bg-destructive/10',
  warning: 'border-l-primary bg-primary/5',
  info: 'border-l-transparent bg-secondary/40'
}

/**
 * 🛑 The panel is CLAMPED TO THE VIEWPORT, not just right-aligned to the bell.
 *
 * `absolute right-0` aligns the panel's right edge with the bell's, so it opens leftward —
 * which is correct only if the bell has 26rem of room to its left. Measured in the real
 * header at a 620px window: bell right edge at 320, panel 416 wide, **panel left = -96**.
 * Ninety-six pixels of alerts off the side of the screen, including the dismiss buttons.
 *
 * Scott caught it on sight. A width clamp does not help — the width was already fine; it is
 * the ANCHOR that is wrong, and no static CSS knows where the bell will end up once the
 * sidebar, the email address and a Sign out button have had their say. So: measure after
 * open, nudge back on screen, re-measure on resize.
 */
export default function AlertBell({
  alerts,
  badge,
  onDismiss,
  onDismissAll,
  onOpen
}: {
  alerts: Alert[]
  badge: number
  onDismiss: (id: string) => void
  onDismissAll: () => void
  onOpen?: (grantId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [nudge, setNudge] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Keep the panel inside the window, both edges, at any size.
  useEffect(() => {
    if (!open) { setNudge(0); return }
    const fit = (): void => {
      const el = panelRef.current
      if (!el) return
      // Measure with any previous correction removed, or corrections compound on resize.
      el.style.transform = 'none'
      const r = el.getBoundingClientRect()
      const M = 12 // breathing room, so it never sits flush against the frame
      let dx = 0
      if (r.left < M) dx = M - r.left
      else if (r.right > window.innerWidth - M) dx = window.innerWidth - M - r.right
      el.style.transform = ''
      setNudge(dx)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [open, alerts.length])

  // Click-away and Escape. A panel you can only close with the same small button is a
  // panel that feels stuck.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={badge > 0 ? `Alerts, ${badge} needing attention` : 'Alerts'}
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-4 w-4" />
        {badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-[18px] text-destructive-foreground">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{ transform: nudge ? `translateX(${nudge}px)` : undefined }}
          className="absolute right-0 z-50 mt-2 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold">Alerts</span>
            {alerts.length > 0 && (
              <button type="button" onClick={onDismissAll} className="text-xs text-muted-foreground hover:text-foreground">
                Clear all
              </button>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 h-5 w-5 opacity-40" />
              Nothing needs your attention.
              {/* 🛑 Say when it looks, so "no alerts" is not mistaken for "not working".
                  The app cannot warn anyone while it is closed and should not imply it can. */}
              <div className="mt-1 text-xs">
                Deadlines are checked when GrantHarbor opens and every 30 minutes while it runs.
              </div>
            </div>
          ) : (
            <ul className="max-h-[22rem] overflow-y-auto">
              {alerts.map((a) => (
                <li key={a.id} className={`flex items-start gap-2.5 border-b border-b-border border-l-2 px-4 py-3 last:border-b-0 ${TONE[a.severity]}`}>
                  {a.kind === 'match'
                    ? <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    : a.severity === 'urgent'
                      ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      : <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      disabled={!a.grantId || !onOpen}
                      onClick={() => a.grantId && onOpen?.(a.grantId)}
                      className="block w-full truncate text-left text-sm font-medium disabled:cursor-default"
                      title={a.title}
                    >
                      {a.title}
                    </button>
                    <div className="mt-0.5 text-xs text-muted-foreground">{a.body}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDismiss(a.id)}
                    aria-label={`Dismiss ${a.title}`}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
