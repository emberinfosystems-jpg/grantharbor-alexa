/**
 * Alerts — deadlines you are about to miss, and matches the agent found.
 *
 * This is the claim that was REMOVED from the Pro feature list on 2026-08-25 ("Deadline &
 * match alerts") because nothing in the app sent an alert of any kind and there was no
 * scheduler. This file is what puts it back honestly.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🛑 TIERS, NOT A WINDOW. The naive version alerts on everything due "within 30 days",
 * which re-fires the same grant every single day for a month. People do not read the
 * thirtieth copy of a warning — they turn warnings off, and then miss the one that mattered.
 *
 * So each grant crosses a fixed set of thresholds and fires ONCE per threshold. A grant due
 * in 20 days is silent until it hits 14, then silent again until 7, then 3, then 1, then the
 * day itself. Five alerts over three weeks instead of thirty.
 *
 * 🛑 URGENCY IS THE TIER, NOT THE COUNT. One "due tomorrow" outranks ten "due in a month",
 * so the list sorts by days remaining and the badge counts what is actually urgent.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { Grant } from './grantTypes'

/** Days-remaining thresholds. Descending so the first match is the widest not-yet-fired. */
export const DEADLINE_TIERS = [14, 7, 3, 1, 0] as const

export type AlertKind = 'deadline' | 'match'

export interface Alert {
  /** Stable identity: same grant + same tier = same alert, forever. */
  id: string
  kind: AlertKind
  title: string
  body: string
  /** Days until the deadline; negative is past due. Absent for match alerts. */
  daysUntil?: number
  /** How loud this should be. */
  severity: 'info' | 'warning' | 'urgent'
  /** The record this points at, so a click can open it. */
  grantId?: string
  createdAt: string
}

/** Terminal statuses: the work is done or abandoned, so a deadline is no longer news. */
const DONE = new Set(['Applied', 'Awarded', 'Rejected', 'Expired'])

/** UTC day number — avoids a timezone shifting a date-only value across midnight. */
function utcDay(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '').trim())
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  if (d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null
  return Math.floor(d.getTime() / 86400000)
}

export function todayISO(now: Date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

export function daysUntil(deadline: string, today: string): number | null {
  const a = utcDay(deadline)
  const b = utcDay(today)
  if (a === null || b === null) return null
  return a - b
}

/**
 * The tier a grant currently sits in, or null if it is further out than the widest tier.
 *
 * 🛑 Past-due returns tier 0, not null. A missed deadline is the single most important thing
 * the app can tell someone, and dropping out of the tier list the day after would make it
 * silently disappear at exactly the wrong moment.
 */
export function tierFor(days: number): number | null {
  if (days < 0) return 0
  // 🛑 The NARROWEST threshold already crossed — ascending, first `days <= t`.
  // The obvious version walks the tiers descending looking for `days >= t`, which puts
  // everything 14 days or further into "tier 14" and fires it IMMEDIATELY. A grant due in
  // 300 days would alert today with "Due in 300 days", and the first thing anyone would do
  // with an inbox full of those is switch alerts off — losing the ones that mattered.
  // Silence until a threshold is actually reached is the whole point of tiers.
  for (const t of [...DEADLINE_TIERS].reverse()) {
    if (days <= t) return t
  }
  return null
}

function severityFor(days: number): Alert['severity'] {
  if (days <= 1) return 'urgent'
  if (days <= 7) return 'warning'
  return 'info'
}

function deadlineBody(days: number, agency?: string): string {
  const who = agency ? ` · ${agency}` : ''
  if (days < 0) return `Deadline passed ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago${who}`
  if (days === 0) return `Due TODAY${who}`
  if (days === 1) return `Due tomorrow${who}`
  return `Due in ${days} days${who}`
}

/**
 * Build the deadline alerts a set of grants currently warrants.
 *
 * `fired` is the set of alert ids already delivered — pass it in and it is respected, so
 * the same grant/tier never fires twice. Returns only what is NEW.
 */
export function deadlineAlerts(
  grants: Grant[],
  fired: Set<string>,
  today: string = todayISO()
): Alert[] {
  const out: Alert[] = []
  for (const g of grants) {
    if (!g.deadline || DONE.has(g.status)) continue
    const days = daysUntil(g.deadline, today)
    if (days === null) continue
    const tier = tierFor(days)
    if (tier === null) continue
    // 🛑 Stop nagging about something abandoned long ago. Two weeks past due, the user
    // knows; continuing to shout buries the deadlines they can still act on.
    if (days < -14) continue

    const id = `deadline:${g.id}:${tier}`
    if (fired.has(id)) continue
    out.push({
      id,
      kind: 'deadline',
      title: g.title,
      body: deadlineBody(days, g.source_agency),
      daysUntil: days,
      severity: severityFor(days),
      grantId: g.id,
      createdAt: new Date().toISOString()
    })
  }
  // Most urgent first — a "due tomorrow" must never sit below a "due in 14 days".
  return out.sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0))
}

/**
 * One alert summarising what the ingestion agent found.
 *
 * 🛑 ONE alert for the batch, not one per opportunity. A run that matches 40 grants would
 * otherwise produce 40 notifications and bury every deadline alert underneath them.
 */
export function matchAlert(count: number, fired: Set<string>, stamp = todayISO()): Alert | null {
  if (count <= 0) return null
  const id = `match:${stamp}:${count}`
  if (fired.has(id)) return null
  return {
    id,
    kind: 'match',
    title: `${count} new opportunit${count === 1 ? 'y' : 'ies'} matched`,
    body: 'The agent found funding that matches your keywords. Open Discover to review.',
    severity: 'info',
    createdAt: new Date().toISOString()
  }
}

/** The count worth showing on a badge: urgent + warning only. */
export function urgentCount(alerts: Alert[]): number {
  return alerts.filter((a) => a.severity !== 'info').length
}
