/**
 * The renderer's only door to the main process.
 *
 * 🛑 Deliberately a NARROW, fixed surface — two named calls, no generic `invoke(channel, …)`
 * passthrough. A generic bridge would let any script running in the renderer reach every IPC
 * handler the app ever adds, which is how an XSS in a grant description turns into arbitrary
 * main-process access. The renderer can ask for public opportunities and nothing else.
 */
import { contextBridge, ipcRenderer } from 'electron'

export interface Opportunity {
  source_id: string
  source_number: string
  title: string
  description: string
  funding_amount: number
  deadline: string
  source_agency: string
  link_url: string
  categories: string[]
  posted_date: string
}

export interface LicenseStatus {
  plan: 'basic' | 'pro'
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

export interface IngestResult {
  ok: boolean
  fetched: number
  opportunities: Opportunity[]
  error?: string
  warning?: string
}

const api = {
  /** Fetch open opportunities posted within the last `sinceDays` (omit for the full corpus). */
  fetchOpportunities: (sinceDays?: number): Promise<IngestResult> =>
    ipcRenderer.invoke('ingest:fetch', sinceDays),

  /** Full detail for specific opportunities — call only for on-device matches. */
  enrichOpportunities: (ids: string[]): Promise<Record<string, Partial<Opportunity>>> =>
    ipcRenderer.invoke('ingest:enrich', ids),

  /**
   * "Who has won funding like this" — recent federal grant awards matching a keyword drawn
   * from a PUBLIC opportunity. Explicit, on-demand; never sends the user's own keywords.
   */
  awardPrecedent: (keyword: string): Promise<{
    ok: boolean
    awards: { id: string; recipient: string; amount: number; agency: string; date: string; url: string }[]
    error?: string
  }> => ipcRenderer.invoke('usaspending:precedent', keyword),

  /** True when this install can reset a password offline. */
  recoveryAvailable: (): Promise<boolean> => ipcRenderer.invoke('auth:recoveryAvailable'),

  /** Generate a new recovery code for a user. Returns the plaintext code ONCE. */
  issueRecoveryCode: (userId: string): Promise<string> =>
    ipcRenderer.invoke('auth:issueRecoveryCode', userId),

  /** Reset a forgotten password offline using email + recovery code. */
  resetWithRecoveryCode: (email: string, code: string, password: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke('auth:resetWithRecoveryCode', { email, code, password }),

  /** Write a full account export to a folder the user chooses. */
  exportData: (files: { name: string; contents: string }[]): Promise<{ saved: boolean; dir?: string; written?: number; reason?: string }> =>
    ipcRenderer.invoke('app:exportData', files),

  /** Raise a desktop notification. The RENDERER decides whether to call this. */
  notify: (title: string, body: string, urgent?: boolean): Promise<{ shown: boolean; reason?: string }> =>
    ipcRenderer.invoke('notify:show', { title, body, urgent }),

  /** Environment facts for a bug report. Contains nothing about the user's records. */
  diagnostics: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('app:diagnostics'),

  /** Write a bug report to a file the user chooses. */
  saveReport: (text: string): Promise<{ saved: boolean; filePath?: string }> =>
    ipcRenderer.invoke('app:saveReport', text),

  // ── Pro licensing ──
  licenseStatus: (email: string): Promise<LicenseStatus> =>
    ipcRenderer.invoke('license:status', email),
  licenseActivate: (key: string, email: string): Promise<LicenseStatus> =>
    ipcRenderer.invoke('license:activate', { key, email }),
  licenseDeactivate: (): Promise<LicenseStatus> => ipcRenderer.invoke('license:deactivate'),
  openPurchase: (): Promise<{ opened: boolean }> => ipcRenderer.invoke('license:openPurchase'),
  autoRenew: (on?: boolean): Promise<boolean> => ipcRenderer.invoke('license:autoRenew', on)
}

contextBridge.exposeInMainWorld('grantharbor', api)

export type GrantHarborApi = typeof api
