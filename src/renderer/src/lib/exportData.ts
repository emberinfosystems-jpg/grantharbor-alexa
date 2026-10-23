/**
 * Full account export — the thing the privacy policy already promises.
 *
 * 🛑 THIS IS A PUBLISHED LEGAL CLAIM, NOT A FEATURE REQUEST. The shipped policy says,
 * verbatim: "Portability — export your data in a machine-readable format (JSON/CSV)". Until
 * 2026-08-25 only the Grants table could be exported; Investors, Applications, Application
 * Profiles and Approved Senders had no export at all. The claim was written, complete, and
 * untrue — which is why `check-legal.mjs` missed it: that gate catches unfilled
 * `[[placeholders]]`, not sentences that are fully formed and simply not delivered.
 *
 * Both formats ship together because they answer different questions:
 *   • JSON — the complete, structured, re-importable record. This is what "machine-readable"
 *     means to a regulator and to any tool that has to take the data onward.
 *   • CSV per table — what the person actually asking for their data usually wants, because
 *     they intend to open it in a spreadsheet.
 * Promising "JSON/CSV" and shipping only one of them would be half a claim.
 */
import { toCsv } from './csvInjection'
import type { Grant, Investor, ApprovedSender, ApplicationProfile, UserPreference } from './grantTypes'

export interface ExportInput {
  email?: string | null
  grants: Grant[]
  investors: Investor[]
  approvedSenders: ApprovedSender[]
  profiles: ApplicationProfile[]
  preferences: UserPreference | null
}

export interface ExportFile {
  name: string
  contents: string
}

/** Stable column order per table, so a re-export diffs cleanly against an older one. */
const COLUMNS: Record<string, string[]> = {
  grants: ['id', 'title', 'description', 'funding_amount', 'deadline', 'source_agency', 'link_url', 'categories', 'status', 'notes', 'confirmation_number', 'submitted_date', 'expected_response_date'],
  investors: ['id', 'name', 'investor_type', 'focus_areas', 'stage', 'typical_check_min', 'typical_check_max', 'fund_size', 'location', 'website_url', 'description', 'portfolio_examples', 'is_active'],
  approved_senders: ['id', 'email_or_domain', 'sender_name', 'sender_type', 'notes'],
  application_profiles: ['id', 'profile_name', 'applicant_name', 'email', 'phone', 'business_name', 'business_type', 'ein', 'industry', 'annual_revenue', 'employees', 'mission_statement', 'funding_needed', 'funding_purpose'],
  user_preferences: ['id', 'notify_email', 'notify_in_app', 'email_frequency', 'preferred_categories']
}

/**
 * 🛑 PocketBase returns date fields as full datetimes: a deadline stored as `2026-09-02`
 * comes back as `2026-09-02 00:00:00.000Z`. Exporting that verbatim puts a meaningless
 * midnight timestamp in a column that is conceptually a DATE, and Excel is much less likely
 * to recognise it as one — so the column lands as text and will not sort.
 *
 * Only a time of EXACTLY midnight UTC is trimmed. That is precisely the date-only case; a
 * genuine timestamp keeps every digit, because silently discarding a real time would be a
 * worse bug than the one being fixed.
 *
 * Caught only by exporting data that had actually round-tripped through the database —
 * hand-built test objects had clean `YYYY-MM-DD` strings and sailed through.
 */
export function normalizeDate(v: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})[T ]00:00:00(\.000)?Z?$/.exec(v)
  return m ? m[1] : v
}

/**
 * 🛑 Arrays and objects are flattened for CSV ONLY. The JSON keeps them intact — a CSV cell
 * containing `["Health","Education"]` is fine to read and useless to re-import, so the
 * structured copy has to remain the authoritative one.
 */
function cell(v: unknown): string | number {
  if (v === null || v === undefined) return ''
  if (Array.isArray(v)) return v.join('; ')
  if (typeof v === 'object') return JSON.stringify(v)
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  return normalizeDate(String(v))
}

/** Same normalisation for the JSON copy, so the two files never disagree. */
function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) out[k] = typeof v === 'string' ? normalizeDate(v) : v
  return out
}

function tableCsv(rows: Record<string, unknown>[], cols: string[]): string {
  return toCsv([cols, ...rows.map((r) => cols.map((c) => cell(r[c])))])
}

export function buildExport(input: ExportInput): ExportFile[] {
  const stamp = new Date().toISOString()
  const prefs = input.preferences ? [input.preferences as unknown as Record<string, unknown>] : []

  const tables: Record<string, Record<string, unknown>[]> = {
    grants: (input.grants as unknown as Record<string, unknown>[]).map(normalizeRow),
    investors: (input.investors as unknown as Record<string, unknown>[]).map(normalizeRow),
    approved_senders: (input.approvedSenders as unknown as Record<string, unknown>[]).map(normalizeRow),
    application_profiles: (input.profiles as unknown as Record<string, unknown>[]).map(normalizeRow),
    user_preferences: prefs.map(normalizeRow)
  }

  const files: ExportFile[] = []

  // The complete structured record.
  files.push({
    name: 'grantharbor-export.json',
    contents: JSON.stringify({
      exported_at: stamp,
      account: input.email ?? null,
      application: 'GrantHarbor',
      // 🛑 Stated in the file itself. Someone reading this months later — a successor, an
      // auditor, the user's accountant — should not have to guess whether anything was
      // withheld or held back on a server. Nothing was: this IS the whole record.
      note: 'Complete export of everything GrantHarbor stores for this account. All data is held locally on your device; nothing is retained by Ember Information Systems.',
      counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
      data: tables
    }, null, 2)
  })

  // One CSV per table, including EMPTY ones.
  // 🛑 An empty table still gets a file with its header row. A missing file is ambiguous —
  // it reads as "this was withheld" rather than "you have none of these".
  for (const [name, rows] of Object.entries(tables)) {
    files.push({ name: `${name}.csv`, contents: tableCsv(rows, COLUMNS[name] ?? Object.keys(rows[0] ?? {})) })
  }

  files.push({
    name: 'README.txt',
    contents: [
      'GrantHarbor — your data export',
      `Exported: ${stamp}`,
      input.email ? `Account:  ${input.email}` : '',
      '',
      'grantharbor-export.json  Everything, with structure preserved. Use this to move your',
      '                         data to another tool, or to keep a complete archive.',
      '*.csv                    One file per table, for spreadsheets. Lists are joined with',
      '                         "; " and cannot be re-imported perfectly — the JSON can.',
      '',
      'This is the complete record. GrantHarbor stores your data on this computer only;',
      'Ember Information Systems holds no copy of it, so there is nothing further to request.',
      '',
      'Rows exported:',
      ...Object.entries(tables).map(([k, v]) => `  ${k.padEnd(22)} ${v.length}`)
    ].filter(Boolean).join('\r\n')
  })

  return files
}

export function exportSummary(files: ExportFile[]): string {
  const json = files.find((f) => f.name.endsWith('.json'))
  if (!json) return `${files.length} files`
  const counts = JSON.parse(json.contents).counts as Record<string, number>
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  return `${total} record${total === 1 ? '' : 's'} across ${Object.keys(counts).length} tables`
}
