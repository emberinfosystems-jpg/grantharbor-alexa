import { Board } from '@ember/ui'
import { BOARD_COLUMNS, statusStyle } from '../lib/grantStatus'
import type { GrantStatus } from '../lib/grantStatus'
import type { Grant } from '../lib/grantTypes'
import { usd } from '../format'

// GrantGuard-specific config over the shared @ember/ui Board (kanban).
export default function GrantBoard({ grants, onMove }: { grants: Grant[]; onMove: (id: string, status: GrantStatus) => void }) {
  const columns = BOARD_COLUMNS.map((s) => ({ key: s, label: statusStyle(s).label, color: statusStyle(s).color }))
  return (
    // The 6-column kanban is wider than a phone; scroll it inside its own box so it never
    // widens the page (which would break the fixed bottom nav — see index.css overflow guard).
    <div className="overflow-x-auto">
    <Board
      columns={columns}
      items={grants}
      getId={(g: Grant) => g.id}
      getColumn={(g: Grant) => g.status}
      onMove={(id: string, key: string) => onMove(id, key as GrantStatus)}
      renderCard={(g: Grant) => (
        <>
          <div className="text-sm font-medium leading-snug">{g.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{g.source_agency}</div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="font-mono">{usd(g.funding_amount)}</span>
            <span className="text-muted-foreground">{g.deadline}</span>
          </div>
        </>
      )}
    />
    </div>
  )
}
