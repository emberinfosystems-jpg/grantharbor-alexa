import { useState } from 'react'
import { Download, Trash2, ArrowUpDown, Table2, LayoutGrid, CalendarDays } from 'lucide-react'
import { Card, CardContent, Input, Select, Button, StatusBadge, cn } from '@ember/ui'
import { filterGrants } from '../lib/grantFilters'
import { sortByKey, SortDir } from '../lib/grantSort'
import { statusStyle, BOARD_COLUMNS } from '../lib/grantStatus'
import type { GrantStatus } from '../lib/grantStatus'
import { toCsv } from '../lib/csvInjection'
import type { Grant } from '../lib/grantTypes'
import { usd } from '../format'
import type { useStore } from '../state/useStore'
import GrantBoard from '../components/GrantBoard'
import GrantCalendar from '../components/GrantCalendar'

const TONE: Record<GrantStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  New: 'neutral', Reviewed: 'info', Applied: 'warning', Awarded: 'success', Rejected: 'danger', Expired: 'neutral'
}

export default function Grants({ store }: { store: ReturnType<typeof useStore> }) {
  const { grants, addGrant, updateGrant, deleteGrant } = store
  const [view, setView] = useState<'table' | 'board' | 'calendar'>('table')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<GrantStatus | 'All'>('All')
  const [sortKey, setSortKey] = useState<keyof Grant>('deadline')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [title, setTitle] = useState('')
  const [agency, setAgency] = useState('')
  const [amount, setAmount] = useState('')
  const [deadline, setDeadline] = useState('')

  const filtered = filterGrants(grants, search, status, [])
  const rows = sortByKey(filtered, sortKey, sortDir)
  const boardRows = filterGrants(grants, search, 'All', []) // board columns ARE the statuses

  function exportCsv() {
    const header = ['Title', 'Agency', 'Funding', 'Deadline', 'Status', 'Categories', 'Notes']
    const body = rows.map((g) => [g.title, g.source_agency, g.funding_amount, g.deadline, g.status, g.categories.join('; '), g.notes ?? ''])
    const csv = toCsv([header, ...body])
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `grants-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function toggleSort(key: keyof Grant) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const statusOptions = [{ value: 'All', label: 'All statuses' }, ...BOARD_COLUMNS.map((s) => ({ value: s, label: s }))]
  const colStatusOptions = BOARD_COLUMNS.map((s) => ({ value: s, label: s }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Grants</h1>

      <div className="flex flex-wrap items-center gap-3">
        <Input className="min-w-64 max-w-sm" placeholder="Search title / agency / description" value={search} onChange={(e) => setSearch(e.target.value)} />
        {view === 'table' && (
          <div className="w-44">
            <Select options={statusOptions} value={status} onChange={(e) => setStatus(e.target.value as GrantStatus | 'All')} />
          </div>
        )}
        {/* Table / Board segmented toggle */}
        <div className="inline-flex overflow-hidden rounded-md border border-border">
          <button
            onClick={() => setView('table')}
            className={cn('flex items-center gap-1.5 px-3 py-2 text-sm', view === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary')}
          >
            <Table2 size={15} /> Table
          </button>
          <button
            onClick={() => setView('board')}
            className={cn('flex items-center gap-1.5 border-l border-border px-3 py-2 text-sm', view === 'board' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary')}
          >
            <LayoutGrid size={15} /> Board
          </button>
          <button
            onClick={() => setView('calendar')}
            className={cn('flex items-center gap-1.5 border-l border-border px-3 py-2 text-sm', view === 'calendar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary')}
          >
            <CalendarDays size={15} /> Calendar
          </button>
        </div>
        <Button variant="outline" icon={Download} onClick={exportCsv} className="ml-auto">Export CSV</Button>
      </div>

      {view === 'board' && (
        <GrantBoard grants={boardRows} onMove={(id, s) => updateGrant(id, { status: s })} />
      )}

      {view === 'calendar' && <GrantCalendar grants={boardRows} />}

      {view === 'table' && (
      <Card>
        <CardContent className="p-0">
          {/* Wide table scrolls inside its own box on mobile — never widens the page. */}
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="cursor-pointer select-none px-4 py-3 font-semibold" onClick={() => toggleSort('title')}>
                  <span className="inline-flex items-center gap-1">Title <ArrowUpDown size={12} /></span>
                </th>
                <th className="px-4 py-3 font-semibold">Agency</th>
                <th className="cursor-pointer select-none px-4 py-3 font-semibold" onClick={() => toggleSort('funding_amount')}>
                  <span className="inline-flex items-center gap-1">Funding <ArrowUpDown size={12} /></span>
                </th>
                <th className="cursor-pointer select-none px-4 py-3 font-semibold" onClick={() => toggleSort('deadline')}>
                  <span className="inline-flex items-center gap-1">Deadline <ArrowUpDown size={12} /></span>
                </th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{g.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{g.source_agency}</td>
                  <td className="px-4 py-3 font-mono">{usd(g.funding_amount)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{g.deadline}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={TONE[g.status]}>{statusStyle(g.status).label}</StatusBadge>
                      <div className="w-28">
                        <Select className="h-9" options={colStatusOptions} value={g.status} onChange={(e) => updateGrant(g.id, { status: e.target.value as GrantStatus })} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" icon={Trash2} onClick={() => deleteGrant(g.id)} aria-label="Delete grant" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {rows.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">No grants match your filters.</div>}
        </CardContent>
      </Card>
      )}

      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold">Add a grant</h2>
          <div className="flex flex-wrap items-end gap-3">
            <Input className="min-w-48 flex-1" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input className="w-40" placeholder="Agency" value={agency} onChange={(e) => setAgency(e.target.value)} />
            <Input className="w-32" type="number" placeholder="Funding $" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input className="w-40" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            <Button
              onClick={() => {
                if (!title || !deadline) return
                addGrant({ title, source_agency: agency, description: '', funding_amount: Number(amount || 0), deadline, categories: [], status: 'New', notes: '' })
                setTitle(''); setAgency(''); setAmount(''); setDeadline('')
              }}
            >
              Add Grant
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
