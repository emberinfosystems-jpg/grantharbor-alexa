import { useState } from 'react'
import { Building2, TrendingUp, MapPin, Coins, ExternalLink, Trash2, Plus, X } from 'lucide-react'
import { Card, CardContent, Input, Select, Label, Button, StatusBadge, cn } from '@ember/ui'
import { CURATED_INVESTORS } from '../lib/curatedInvestors'
import type { Investor, InvestorType } from '../lib/grantTypes'
import type { useStore } from '../state/useStore'

const EMPTY_FORM = { name: '', investor_type: 'venture_capital' as InvestorType, stage: '', location: '', min: '', max: '', focus: '', website: '', description: '' }

function money(n?: number): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

function Field({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground"><Icon size={13} />{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  )
}

function InvestorCard({ inv, curated, onDelete }: { inv: Investor; curated: boolean; onDelete?: () => void }) {
  const isVC = inv.investor_type === 'venture_capital'
  return (
    <Card className="flex flex-col p-4">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="min-w-0 font-semibold leading-tight">{inv.name}</div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusBadge tone={isVC ? 'info' : 'success'}>{isVC ? 'VC' : 'Angel'}</StatusBadge>
          {inv.website_url && (
            <a href={inv.website_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary" aria-label="Website">
              <ExternalLink size={14} />
            </a>
          )}
          {!curated && onDelete && (
            <Button variant="ghost" size="icon" icon={Trash2} onClick={onDelete} aria-label="Remove from watchlist" />
          )}
        </div>
      </div>
      {inv.description && <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{inv.description}</p>}
      {inv.focus_areas?.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {inv.focus_areas.slice(0, 5).map((f) => (
            <span key={f} className="rounded-md bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">{f}</span>
          ))}
        </div>
      )}
      <div className="mt-auto space-y-1.5 border-t border-border pt-3">
        {inv.stage && <Field icon={TrendingUp} label="Stage" value={inv.stage} />}
        {inv.location && <Field icon={MapPin} label="Location" value={inv.location} />}
        <Field icon={Coins} label="Check size" value={`${money(inv.typical_check_min)} – ${money(inv.typical_check_max)}`} />
      </div>
    </Card>
  )
}

export default function Investors({ store }: { store: ReturnType<typeof useStore> }) {
  const { investors, addInvestor, deleteInvestor } = store
  const [search, setSearch] = useState('')
  const [type, setType] = useState<'all' | 'venture_capital' | 'angel'>('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const set = (k: keyof typeof EMPTY_FORM, v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function add() {
    if (!form.name.trim()) return
    await addInvestor({
      name: form.name.trim(),
      investor_type: form.investor_type,
      focus_areas: form.focus.split(',').map((s) => s.trim()).filter(Boolean),
      stage: form.stage.trim() || undefined,
      location: form.location.trim() || undefined,
      typical_check_min: form.min ? Number(form.min) : undefined,
      typical_check_max: form.max ? Number(form.max) : undefined,
      website_url: form.website.trim() || undefined,
      description: form.description.trim() || undefined,
      is_active: true
    })
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  const match = (inv: Investor) => {
    if (type !== 'all' && inv.investor_type !== type) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return inv.name.toLowerCase().includes(q) || (inv.focus_areas || []).some((f) => f.toLowerCase().includes(q))
  }

  const curated = CURATED_INVESTORS.filter(match)
  const watchlist = investors.filter(match)
  const potential = [...curated, ...watchlist].reduce((a, i) => a + (i.typical_check_max || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investors</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">A curated library of VC firms and angel networks, plus your own watchlist.</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total potential funding</div>
          <div className="text-lg font-bold text-primary">{money(potential)}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input className="min-w-64 max-w-sm" placeholder="Search name or focus area" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="inline-flex overflow-hidden rounded-md border border-border">
          {([['all', 'All'], ['venture_capital', 'Venture Capital'], ['angel', 'Angels']] as const).map(([v, label], i) => (
            <button key={v} onClick={() => setType(v)}
              className={cn('px-3 py-2 text-sm', i > 0 && 'border-l border-border', type === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <Building2 size={15} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold">Curated library</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{curated.length}</span>
        </div>
        {curated.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches in the curated library.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {curated.map((inv) => <InvestorCard key={inv.id} inv={inv} curated />)}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold">Your watchlist</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{watchlist.length}</span>
          <Button variant="outline" size="sm" icon={showForm ? X : Plus} className="ml-auto" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancel' : 'Add investor'}
          </Button>
        </div>

        {showForm && (
          <Card className="mb-3">
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><Label>Name *</Label><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Redpoint Ventures" /></div>
                <div>
                  <Label>Type</Label>
                  <Select options={[{ value: 'venture_capital', label: 'Venture Capital' }, { value: 'angel', label: 'Angel' }]} value={form.investor_type} onChange={(e) => set('investor_type', e.target.value)} />
                </div>
                <div><Label>Stage</Label><Input value={form.stage} onChange={(e) => set('stage', e.target.value)} placeholder="Seed to Series B" /></div>
                <div><Label>Location</Label><Input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="San Francisco, CA" /></div>
                <div><Label>Check min ($)</Label><Input type="number" value={form.min} onChange={(e) => set('min', e.target.value)} placeholder="250000" /></div>
                <div><Label>Check max ($)</Label><Input type="number" value={form.max} onChange={(e) => set('max', e.target.value)} placeholder="5000000" /></div>
                <div><Label>Focus areas (comma-separated)</Label><Input value={form.focus} onChange={(e) => set('focus', e.target.value)} placeholder="Fintech, SaaS, AI" /></div>
                <div><Label>Website</Label><Input value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://…" /></div>
              </div>
              <div><Label>Notes</Label><Input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Why they're a fit…" /></div>
              <div className="flex gap-2">
                <Button onClick={add}>Add to watchlist</Button>
                <Button variant="ghost" onClick={() => { setForm(EMPTY_FORM); setShowForm(false) }}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {watchlist.length === 0 ? (
          <p className="text-sm text-muted-foreground">No investors saved yet. Add one above to build your watchlist.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {watchlist.map((inv) => <InvestorCard key={inv.id} inv={inv} curated={false} onDelete={() => deleteInvestor(inv.id)} />)}
          </div>
        )}
      </section>
    </div>
  )
}
