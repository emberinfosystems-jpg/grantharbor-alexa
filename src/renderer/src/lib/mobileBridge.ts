/**
 * MOBILE bridge — provides `window.grantharbor` on the Capacitor build.
 *
 * On desktop, the Electron preload exposes `window.grantharbor` (IPC → main process). Mobile has
 * no main process, so nothing provided it and the Pro surfaces (Discover) went dark — that, plus
 * Amazon's since-defunct Android policy, is why they were stripped. This restores them: the
 * ingestion agent's fetch logic is portable (public, keyless Grants.gov / USAspending APIs, match
 * on-device), so it runs IN the app. CapacitorHttp (enabled in capacitor.config.ts) makes the
 * requests native + CORS-free, exactly like the Electron main did.
 *
 * Install is idempotent and NON-destructive: if `window.grantharbor` already exists (desktop
 * preload ran first), this does nothing.
 */
import type { GrantHarborBridge, LicenseStatus } from './bridge'
import { fetchPosted, enrich, precedent } from './grantSource'
import { activateLicense, readLicenseStatus, deactivateLicense } from './licenseVerify'

// 🛑 ENTITLEMENT — web-sold, offline-verified Ed25519 license (Scott, 2026-09-08).
// DECIDED: Pro (Discover) is gated behind the $19/mo subscription, sold on the WEBSITE via Stripe
// (0% store cut, post-Epic anti-steering is dead) and unlocked by the SAME Ed25519 signed license
// the desktop uses — verified 100% offline here (lib/licenseVerify.ts). One license unlocks desktop
// AND mobile; no Play Billing, no new subprocessor, stays local-first. Fails CLOSED to 'basic'.

export function installMobileBridge(): void {
  if (typeof window === 'undefined') return
  if (window.grantharbor) return // desktop preload already provided the real bridge

  const notAvailable = (feature: string) =>
    Promise.reject(new Error(`${feature} runs in the GrantHarbor desktop app.`))

  const bridge: GrantHarborBridge = {
    // ── The three data methods — the whole point. Same public APIs, match on-device. ──
    fetchOpportunities: (sinceDays?: number) => fetchPosted(sinceDays),

    enrichOpportunities: async (ids: string[]) => {
      const map = await enrich(ids)
      const out: Record<string, ReturnType<typeof Object>> = {}
      for (const [id, partial] of map) out[id] = partial as never
      return out as never
    },

    awardPrecedent: (keyword: string) => precedent(keyword),

    // ── Entitlement — the offline Ed25519 license (lib/licenseVerify). Fails closed to basic. ──
    licenseStatus: (): Promise<LicenseStatus> => readLicenseStatus(),

    // Activate a web-purchased license on this device. Verifies the signature offline + the email
    // binding, then stores it. The `email` here is the address the license was issued to (the one
    // the customer subscribed with) — collected by the mobile activation form.
    licenseActivate: (key: string, email: string): Promise<LicenseStatus> => activateLicense(key, email),
    licenseDeactivate: (): Promise<LicenseStatus> => { deactivateLicense(); return Promise.resolve({ plan: 'basic' }) },
    openPurchase: (): Promise<{ opened: boolean }> => {
      // Post-Epic, linking out is allowed: open the web checkout in the system browser. On a real
      // device Capacitor routes window.open to the external browser; harmless no-op in preview.
      try { window.open('https://emberinformation.shop/', '_blank') } catch { /* ignore */ }
      return Promise.resolve({ opened: true })
    },
    autoRenew: (): Promise<boolean> => Promise.resolve(false), // renewal handled by the web subscription

    // ── Desktop-only conveniences — honest, graceful stubs (never throw uncaught). ──
    recoveryAvailable: () => Promise.resolve(false),
    issueRecoveryCode: () => notAvailable('Offline password recovery'),
    resetWithRecoveryCode: () => notAvailable('Offline password recovery') as Promise<{ ok: true }>,
    exportData: () => Promise.resolve({ saved: false, reason: 'Data export runs in the desktop app.' }),
    notify: () => Promise.resolve({ shown: false, reason: 'Notifications are not enabled on mobile yet.' }),
    diagnostics: () => Promise.resolve({ platform: 'capacitor', build: 'mobile', bridge: 'mobileBridge' }),
    saveReport: () => Promise.resolve({ saved: false })
  }

  window.grantharbor = bridge
}
