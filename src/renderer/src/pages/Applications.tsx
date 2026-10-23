import { ClipboardCheck, Hourglass, Award, CalendarClock } from 'lucide-react'
import { Card, CardContent, StatusBadge, EmptyState, Metric } from '@ember/ui'
import { statusStyle } from '../lib/grantStatus'
import type { GrantStatus } from '../lib/grantStatus'
import { usd, today } from '../format'
import type { useStore } from '../state/useStore'

const SUBMITTED: GrantStatus[] = ['Applied', 'Awarded', 'Rejected']
const TONE: Record<string, 'warning' | 'success' | 'danger'> = { Applied: 'warning', Awarded: 'success', Rejected: 'danger' }

export default function Applications({ store }: { store: ReturnType<typeof useStore> }) {
  const rows = store.grants.filter((g) => SUBMITTED.includes(g.status))
  const pending = rows.filter((g) => g.status === 'Applied').length
  const awarded = rows.filter((g) => g.status === 'Awarded').length
  const t = today()
  const dueSoon = rows.filter((g) => {
    if (g.status !== 'Applied' || !g.expected_response_date) return false
    const days = Math.ceil((new Date(g.expected_response_date).getTime() - new Date(t).getTime()) / 86400000)
    return days >= 0 && days <= 30
  }).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every grant you've submitted, with its status and confirmation details. Mark a grant as Applied on the Grants
          page and it shows up here.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric icon={Hourglass} label="Pending" value={pending} tone="warning" />
        <Metric icon={Award} label="Awarded" value={awarded} tone="success" />
        <Metric icon={CalendarClock} label="Responses due ≤30d" value={dueSoon} tone="brand" />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardCheck}
            title="No submitted applications yet"
            message="When you set a grant's status to Applied, Awarded, or Rejected, it appears here so you can track it end to end."
          />
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Wide table scrolls inside its own box on mobile — never widens the page (matches Grants). */}
            <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Grant</th>
                  <th className="px-4 py-3 font-semibold">Agency</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Confirmation</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{g.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{g.source_agency}</td>
                    <td className="px-4 py-3 font-mono">{usd(g.funding_amount)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{g.confirmation_number || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={TONE[g.status]}>{statusStyle(g.status).label}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
