/**
 * USAspending precedent lookup — "who has already won funding like this".
 *
 * The differentiator the ingestion agent earns by being USED: for a given OPEN opportunity,
 * show recent federal GRANT awards in the same space — recipient and amount — so an applicant
 * can see precedent (who wins these, and for how much) and size a realistic ask. Turns
 * GrantHarbor from "here are open grants" into "…and here's who won ones like it."
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🛑 PRIVACY — the same rule ingest.ts is built around.
 * This queries by the PUBLIC opportunity's own attributes (a keyword drawn from its title, the
 * federal grant award types), NEVER the user's saved keywords/profile, and ONLY on an explicit
 * click — never on a timer. USAspending learns "someone looked at awards under this public
 * program", which is exactly what a public federal-spending database is for. No API key, no
 * identifiers, and the request is identical for any user viewing the same opportunity.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const API = 'https://api.usaspending.gov/api/v2/search/spending_by_award/'
const REQUEST_TIMEOUT_MS = 30_000
// Assistance (grant) award-type codes: 02 block · 03 formula · 04 project · 05 cooperative agreement.
// Deliberately excludes loans (07/08) and direct payments (06/10) — those are not "grants like this".
const GRANT_TYPES = ['02', '03', '04', '05']

export interface PrecedentAward {
  id: string
  recipient: string
  amount: number
  agency: string
  date: string        // ISO day, '' when absent
  url: string         // the award's page on usaspending.gov
}

export interface PrecedentResult {
  ok: boolean
  awards: PrecedentAward[]
  error?: string
}

/**
 * Recent federal grant awards matching `keyword`, largest first.
 * `keyword` is a term drawn from the PUBLIC opportunity (its title) — never user data.
 */
export async function precedent(keyword: string, limit = 8): Promise<PrecedentResult> {
  const kw = String(keyword ?? '').trim().slice(0, 120)
  if (!kw) return { ok: false, awards: [], error: 'No keyword to search.' }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  const today = new Date().toISOString().slice(0, 10)
  const body = {
    filters: {
      award_type_codes: GRANT_TYPES,
      keywords: [kw],
      // Roughly the last ~5 federal fiscal years — enough precedent without dragging in stale awards.
      time_period: [{ start_date: '2021-10-01', end_date: today }]
    },
    fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'Start Date'],
    sort: 'Award Amount',
    order: 'desc',
    limit: Math.min(Math.max(Math.trunc(limit) || 8, 1), 20),
    page: 1
  }

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const rows: any[] = Array.isArray(json?.results) ? json.results : []
    const awards: PrecedentAward[] = rows.map((r) => {
      // USAspending returns generated_internal_id for building the award link.
      const gid = String(r['generated_internal_id'] ?? r['internal_id'] ?? '')
      return {
        id: String(r['Award ID'] ?? gid ?? ''),
        recipient: String(r['Recipient Name'] ?? '').trim(),
        amount: Number(r['Award Amount'] ?? 0) || 0,
        agency: String(r['Awarding Agency'] ?? '').trim(),
        date: String(r['Start Date'] ?? '').slice(0, 10),
        url: gid ? `https://www.usaspending.gov/award/${encodeURIComponent(gid)}` : 'https://www.usaspending.gov'
      }
    }).filter((a) => a.recipient)
    return { ok: true, awards }
  } catch (e) {
    return { ok: false, awards: [], error: e instanceof Error ? e.message : String(e) }
  } finally {
    clearTimeout(timer)
  }
}
