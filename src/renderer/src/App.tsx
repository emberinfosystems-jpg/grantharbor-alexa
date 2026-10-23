import { useState } from 'react'
import {
  LogOut, LayoutDashboard, FileText, ClipboardCheck, ClipboardList,
  Users, ShieldCheck, Settings as SettingsIcon, Scale, Sparkles, Radar
} from 'lucide-react'
import { Button, AppShell } from '@ember/ui'
import { AuthProvider } from '@ember/auth'
import AuthScreen from './components/AuthScreen'
import { useStore } from './state/useStore'
import { useAlerts } from './lib/useAlerts'
import AlertBell from './components/AlertBell'
import MobileNav from './components/MobileNav'
import { currentUserId, LOCAL_MODE } from './lib/db'
import { useAuth, grantGuardAuth } from './lib/useAuth'
import { signOut } from './lib/db'
import Dashboard from './pages/Dashboard'
import Grants from './pages/Grants'
import Discover from './pages/Discover'
import Applications from './pages/Applications'
import Apply from './pages/Apply'
import Investors from './pages/Investors'
import ApprovedSenders from './pages/ApprovedSenders'
import Settings from './pages/Settings'
import Legal from './pages/Legal'
import Upgrade from './pages/Upgrade'

export type PageKey =
  | 'dashboard' | 'grants' | 'discover' | 'applications' | 'apply'
  | 'investors' | 'senders' | 'settings' | 'legal' | 'upgrade'

// 2026-08-03 (T2.6): was a hand-rolled 42-line `components/Sidebar.tsx`. The
// nav data was always the reusable part; `AppShell` supplies the frame, the
// collapse control, aria-current, focus rings and the mobile offset.
const NAV: { key: PageKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'grants', label: 'Grants', icon: FileText },
  { key: 'discover', label: 'Discover', icon: Radar },
  { key: 'applications', label: 'Applications', icon: ClipboardCheck },
  { key: 'apply', label: 'Apply', icon: ClipboardList },
  { key: 'investors', label: 'Investors', icon: Users },
  { key: 'senders', label: 'Approved Senders', icon: ShieldCheck },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
  { key: 'legal', label: 'Legal', icon: Scale },
  { key: 'upgrade', label: 'Upgrade', icon: Sparkles }
]

export default function App() {
  // Local (free mobile) mode: no account, the device is the boundary — skip the auth gate and
  // open straight into the workspace on the on-device store. Cloud/Pro + desktop keep the gate.
  if (LOCAL_MODE) return <Workspace email={null} local />
  // The rail replaces the bare hook that read pb.authStore directly.
  return (
    <AuthProvider adapter={grantGuardAuth}>
      <Gate />
    </AuthProvider>
  )
}

function Gate() {
  const { isAuthed, email } = useAuth()
  if (!isAuthed) return <AuthScreen />
  return <Workspace email={email} />
}

// Split out so useStore() (which queries the backend) only mounts once authenticated.
function Workspace({ email, local }: { email?: string | null; local?: boolean }) {
  const [page, setPage] = useState<PageKey>('dashboard')
  const store = useStore()

  // 🛑 Mobile Pro (2026-09-08): Discover AND Upgrade are both live on mobile now. Discover's agent
  // runs in-app via the Capacitor bridge (lib/mobileBridge.ts). Upgrade is the license-activation +
  // web-subscribe surface: Pro is sold on the website via Stripe (0% store cut) and unlocked by the
  // same offline Ed25519 license the desktop uses (lib/licenseVerify.ts). Post-Epic (2026) Google
  // dropped anti-steering, so linking out to the web checkout is allowed. Nothing is stripped now.
  const nav = NAV

  // Alerts live at the workspace level: the bell must be visible from every page, and the
  // fired-set has to survive navigation or every page change would re-announce everything.
  const alerts = useAlerts(store.grants, currentUserId(), {
    desktopEnabled: store.preferences?.notify_in_app ?? true,
    inAppEnabled: store.preferences?.notify_in_app ?? true
  })

  return (
    <AppShell
      brand={{ name: 'GrantHarbor' }}
      // No `linkAs` — GrantGuard switches views with local state, not a router,
      // so AppShell falls back to <button onClick> (documented behaviour).
      nav={nav.map((n) => ({ ...n, active: page === n.key, onClick: () => setPage(n.key) }))}
      // AppShell's sidebar is desktop-only; supply the phone's nav (bottom tabs + More sheet).
      mobileNav={<MobileNav items={nav} page={page} onNavigate={(k) => setPage(k as PageKey)} />}
      // Reserve bottom space on mobile so the fixed tab bar never covers the last content.
      contentClassName="pb-24 md:pb-8"
      header={
        // 🛑 The bell sits LAST, to the right of Sign out. It was first in the row, so its
        // panel — right-aligned to the bell — hung out over the header and clipped at the
        // window edge. Anchoring the panel to the rightmost control means it can only ever
        // open INWARD, which is the one direction guaranteed to have room.
        <div className="flex items-center justify-end gap-3 pr-1">
          <span className="text-sm text-muted-foreground">{local ? 'On this device' : email}</span>
          {!local && (
            <Button variant="outline" size="sm" icon={LogOut} onClick={signOut}>Sign out</Button>
          )}
          <AlertBell
            alerts={alerts.alerts}
            badge={alerts.badge}
            onDismiss={alerts.dismiss}
            onDismissAll={alerts.dismissAll}
            onOpen={() => setPage('grants')}
          />
        </div>
      }
    >
      {page === 'dashboard' && <Dashboard store={store} />}
      {page === 'grants' && <Grants store={store} />}
      {page === 'discover' && <Discover store={store} email={email} onUpgrade={() => setPage('upgrade')} onMatches={alerts.notifyMatches} />}
      {page === 'applications' && <Applications store={store} />}
      {page === 'apply' && <Apply store={store} />}
      {page === 'investors' && <Investors store={store} />}
      {page === 'senders' && <ApprovedSenders store={store} />}
      {page === 'settings' && <Settings store={store} />}
      {page === 'legal' && <Legal />}
      {page === 'upgrade' && <Upgrade email={email} />}
    </AppShell>
  )
}
