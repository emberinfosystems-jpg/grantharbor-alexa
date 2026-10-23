import { DollarSign, Award, Hourglass, CalendarClock, ArrowUpRight } from 'lucide-react'
import { Metric } from '@ember/ui'
import { fundingOverview } from '../lib/fundingOverview'
import { upcomingDeadlines } from '../lib/deadlineCalc'
import type { GrantStatus } from '../lib/grantStatus'
import GrantBoard from '../components/GrantBoard'
import FundingRings from '../components/FundingRings'
import { usd, today } from '../format'
import type { useStore } from '../state/useStore'

type Tone = 'brand' | 'success' | 'warning' | 'danger'
const CHIP: Record<Tone, string> = {
  brand: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-destructive/10 text-destructive'
}

export default function Dashboard({ store }: { store: ReturnType<typeof useStore> }) {
  const { grants, investors, updateGrant } = store
  const o = fundingOverview(grants)
  const upcoming = upcomingDeadlines(grants, today(), 45)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Your funding pipeline at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={DollarSign} label="Total tracked" value={usd(o.totalTracked)} sub={`across ${grants.length} grants`} tone="brand" />
        <Metric icon={Award} label="Awarded" value={usd(o.awarded)} sub={`${o.countByStatus['Awarded'] ?? 0} won`} tone="success" />
        <Metric icon={Hourglass} label="In pipeline" value={usd(o.pending)} sub="not yet decided" tone="warning" />
        <Metric icon={CalendarClock} label="Due < 45 days" value={String(upcoming.length)} sub={upcoming[0] ? `next in ${upcoming[0].daysUntil} days` : 'nothing urgent'} tone="danger" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FundingRings grants={grants} investors={investors} />

        <section>
          <h2 className="mb-2 text-sm font-semibold">Upcoming deadlines</h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {upcoming.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing due in the next 45 days.</div>
            ) : (
              upcoming.map((u, i) => {
                const tone: Tone = u.daysUntil <= 7 ? 'danger' : u.daysUntil <= 21 ? 'warning' : 'brand'
                return (
                  <div key={`${u.title}-${i}`} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-0">
                    <span className="truncate text-sm font-medium">{u.title}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${CHIP[tone]}`}>{u.daysUntil}d</span>
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Pipeline</h2>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowUpRight size={13} /> drag a grant between stages to update it
          </span>
        </div>
        <GrantBoard grants={grants} onMove={(id, s: GrantStatus) => updateGrant(id, { status: s })} />
      </section>

      <footer className="rounded-xl border border-border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <p>
          <strong className="font-semibold text-foreground">Not a government service.</strong>{' '}
          GrantHarbor is an independent app and is not affiliated with, endorsed by, or representing the U.S. government
          or any government agency. It does not submit applications and does not guarantee funding — awards are decided
          solely by the respective agencies.
        </p>
        <p className="mt-1.5">
          Government grant information comes from official public sources:{' '}
          <a href="https://www.grants.gov" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">Grants.gov</a>{' '}
          (https://www.grants.gov) and{' '}
          <a href="https://www.usaspending.gov" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">USASpending.gov</a>{' '}
          (https://www.usaspending.gov). Every opportunity links back to its official Grants.gov listing.
        </p>
      </footer>
    </div>
  )
}
