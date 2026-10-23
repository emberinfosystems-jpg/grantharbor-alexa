import { RingStat } from '@ember/ui'
import type { Grant, Investor } from '../lib/grantTypes'

// GrantGuard-specific config over the shared @ember/ui RingStat.
function compact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

export default function FundingRings({ grants, investors }: { grants: Grant[]; investors: Investor[] }) {
  const rings = [
    { label: 'Grants', color: 'hsl(var(--success))', value: grants.reduce((a, g) => a + (g.funding_amount || 0), 0) },
    { label: 'Venture Capital', color: 'hsl(var(--primary))', value: investors.filter((i) => i.investor_type === 'venture_capital').reduce((a, i) => a + (i.typical_check_max || 0), 0) },
    { label: 'Angel', color: 'hsl(var(--destructive))', value: investors.filter((i) => i.investor_type === 'angel').reduce((a, i) => a + (i.typical_check_max || 0), 0) }
  ]
  return <RingStat rings={rings} format={compact} centerLabel="Total available" title="Funding sources" subtitle="Available capital across grants, VCs, and angels" />
}
