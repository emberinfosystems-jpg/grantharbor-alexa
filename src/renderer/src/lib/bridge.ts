/**
 * The typed view of `window.grantharbor` — the narrow preload bridge.
 *
 * Declared once here rather than inline per page: three surfaces now use it (Discover,
 * AuthScreen, Settings), and three copies of a `declare global` block drift the moment one
 * of them gains a method.
 */
import type { Opportunity } from './ingestMatch'

export type Plan = 'basic' | 'pro'

export interface LicenseStatus {
  plan: Plan
  licensedTo?: string
  issued?: string
  order?: string
  accessThrough?: string
  renewsOn?: string
  autoRenew?: boolean
  inGrace?: boolean
  graceDaysLeft?: number
  lapsed?: boolean
}

export interface GrantHarborBridge {
  fetchOpportunities: (sinceDays?: number) => Promise<{
    ok: boolean
    fetched: number
    opportunities: Opportunity[]
    error?: string
    warning?: string
  }>
  enrichOpportunities: (ids: string[]) => Promise<Record<string, Partial<Opportunity>>>
  awardPrecedent: (keyword: string) => Promise<{
    ok: boolean
    awards: { id: string; recipient: string; amount: number; agency: string; date: string; url: string }[]
    error?: string
  }>
  recoveryAvailable: () => Promise<boolean>
  issueRecoveryCode: (userId: string) => Promise<string>
  resetWithRecoveryCode: (email: string, code: string, password: string) => Promise<{ ok: true }>
  exportData: (files: { name: string; contents: string }[]) => Promise<{ saved: boolean; dir?: string; written?: number; reason?: string }>
  notify: (title: string, body: string, urgent?: boolean) => Promise<{ shown: boolean; reason?: string }>
  diagnostics: () => Promise<Record<string, unknown>>
  saveReport: (text: string) => Promise<{ saved: boolean; filePath?: string }>
  licenseStatus: (email: string) => Promise<LicenseStatus>
  licenseActivate: (key: string, email: string) => Promise<LicenseStatus>
  licenseDeactivate: () => Promise<LicenseStatus>
  openPurchase: () => Promise<{ opened: boolean }>
  autoRenew: (on?: boolean) => Promise<boolean>
}

declare global {
  interface Window {
    grantharbor?: GrantHarborBridge
  }
}

/**
 * 🛑 Undefined in a browser preview — the bridge only exists inside Electron. Callers must
 * branch on this rather than assume, so the UI can say "this runs in the desktop app"
 * instead of presenting a control that throws when clicked.
 */
export const bridge = (): GrantHarborBridge | undefined =>
  typeof window === 'undefined' ? undefined : window.grantharbor
