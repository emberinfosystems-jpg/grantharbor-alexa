import { MonthCalendar } from '@ember/ui'
import { statusStyle } from '../lib/grantStatus'
import type { Grant } from '../lib/grantTypes'
import { usd } from '../format'

// GrantGuard-specific config over the shared @ember/ui MonthCalendar.
export default function GrantCalendar({ grants }: { grants: Grant[] }) {
  const events = grants
    .filter((g) => g.deadline)
    .map((g) => ({
      date: g.deadline.slice(0, 10),
      label: g.title,
      color: statusStyle(g.status).color,
      title: `${g.title} · ${usd(g.funding_amount)} · ${g.status}`
    }))
  return <MonthCalendar events={events} />
}
