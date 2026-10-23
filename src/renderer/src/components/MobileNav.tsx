// Mobile bottom-tab navigation for GrantHarbor. AppShell's sidebar is desktop-only
// (`hidden md:flex`) and expects the app to supply its own mobile pattern via `mobileNav` —
// without it, the phone app is stuck on one screen. This is a bottom tab bar (md:hidden,
// safe-area aware, 44px+ targets): the 4 primary destinations + a "More" sheet for the rest.
//
// 🔜 HARVEST: this is the reusable mobile-nav every mobile-first EIS app needs — promote to
// @ember/ui as `MobileTabBar` once a 2nd app uses it. Built app-local first per fleet doctrine.
import { useState } from 'react'
import { MoreHorizontal, X, type LucideIcon } from 'lucide-react'
import { cn } from '@ember/ui'

type NavItem = { key: string; label: string; icon: LucideIcon }

// The 4 destinations that get their own tab; everything else lives under "More".
const PRIMARY = ['dashboard', 'grants', 'applications', 'investors']

export default function MobileNav({
  items,
  page,
  onNavigate
}: {
  items: NavItem[]
  page: string
  onNavigate: (key: string) => void
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const primaryItems = PRIMARY.map((k) => items.find((i) => i.key === k)).filter(Boolean) as NavItem[]
  const moreItems = items.filter((i) => !PRIMARY.includes(i.key))
  const moreActive = moreItems.some((i) => i.key === page)
  const go = (k: string) => { onNavigate(k); setMoreOpen(false) }

  return (
    <>
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="More navigation">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 bg-card border-t border-border rounded-t-2xl pb-[env(safe-area-inset-bottom)] shadow-2xl">
            <div className="flex items-center justify-between px-4 h-12 border-b border-border">
              <span className="font-heading font-bold">More</span>
              <button type="button" aria-label="Close" onClick={() => setMoreOpen(false)} className="p-2 -mr-2 text-muted-foreground">
                <X size={20} />
              </button>
            </div>
            <div className="p-2">
              {moreItems.map((item) => {
                const Icon = item.icon
                const active = item.key === page
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => go(item.key)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left text-sm min-h-[48px]',
                      active ? 'bg-primary/12 text-primary' : 'text-foreground hover:bg-muted/60'
                    )}
                  >
                    <Icon size={20} className="shrink-0" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-card border-t border-border pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        <div className="flex items-stretch">
          {primaryItems.map((item) => {
            const Icon = item.icon
            const active = item.key === page && !moreOpen
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => go(item.key)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon size={22} className="shrink-0" />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-current={moreActive ? 'page' : undefined}
            aria-expanded={moreOpen}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors',
              moreActive || moreOpen ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <MoreHorizontal size={22} className="shrink-0" />
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>
        </div>
      </nav>
    </>
  )
}
