/**
 * GrantHarbor data source — the ingestion agent's actual fetch logic, in the RENDERER so the
 * MOBILE build can run it too (Capacitor has no Electron main process).
 *
 * 🛑🛑 KEEP IN SYNC WITH `src/main/ingest.ts` + `src/main/usaspending.ts`.
 * This is a faithful port of those two modules. They stay the desktop source of truth (imported
 * by the Electron main process); this file is the identical logic for the mobile bridge. Both use
 * ONLY web-standard `fetch` — on the desktop that's Node's fetch (no CORS in main); on Android the
 * global fetch is patched by CapacitorHttp to go native (also no CORS). If you change a normalize
 * rule or an endpoint in one place, change it in BOTH, or the two builds silently diverge.
 *
 * 🛑 THE PRIVACY INVARIANT (why the whole module is shaped this way): fetch the ENTIRE public
 * corpus with NO keyword and match ON-DEVICE. Never send the user's saved categories/profile to
 * any API. `Legal.tsx localFirst:true` and the subprocessor oracle depend on nothing about the
 * user leaving the device. Award precedent queries the PUBLIC opportunity's own title, never the
 * user's keywords, and only on an explicit click.
 */

// ── Grants.gov (open opportunities) ────────────────────────────────────────────
const GRANTS_API = 'https://api.grants.gov/v1/api'
const PAGE = 200
const MAX_PAGES = 25
const REQUEST_TIMEOUT_MS = 30_000

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

export interface IngestResult {
  ok: boolean
  fetched: number
  opportunities: Opportunity[]
  error?: string
  warning?: string
}

async function post(path: string, body: unknown): Promise<any> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(`${GRANTS_API}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    // 🛑 Grants.gov returns HTTP 200 with errorcode != 0 on failure. Trusting the status code
    // alone would report "0 new opportunities" instead of "the fetch broke".
    if (json?.errorcode !== 0) throw new Error(json?.msg || 'API reported an error')
    return json.data
  } finally {
    clearTimeout(timer)
  }
}

/** Strip the HTML Grants.gov embeds in descriptions, without pulling in a parser. */
function plain(html: string): string {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&rsquo;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 'Aug 30, 2026 12:00:00 AM EDT' and '08/30/2026' both appear. Returns '' if neither parses. */
function isoDate(raw: unknown): string {
  if (!raw) return ''
  const s = String(raw).trim()
  const us = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (us) return `${us[3]}-${us[1]}-${us[2]}`
  const t = Date.parse(s)
  if (Number.isNaN(t)) return ''
  const d = new Date(t)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function money(raw: unknown): number {
  const n = Number(String(raw ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Page through every POSTED opportunity. No keyword — see the privacy note above. */
export async function fetchPosted(sinceDays?: number): Promise<IngestResult> {
  const out: Opportunity[] = []
  const seen = new Set<string>()
  let failedPages = 0

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const body: Record<string, unknown> = { rows: PAGE, startRecordNum: page * PAGE, oppStatuses: 'posted' }
      if (sinceDays && sinceDays > 0) body.dateRange = String(sinceDays)

      let data: any
      try {
        data = await post('search2', body)
      } catch (e) {
        failedPages++
        if (failedPages > 2) throw e
        continue
      }

      const hits: any[] = data?.oppHits ?? []
      for (const h of hits) {
        const id = String(h.id ?? '')
        if (!id || seen.has(id)) continue
        seen.add(id)
        out.push({
          source_id: id,
          source_number: String(h.number ?? ''),
          title: String(h.title ?? '').trim(),
          description: '',
          funding_amount: 0,
          deadline: isoDate(h.closeDate),
          source_agency: String(h.agency ?? '').trim(),
          link_url: `https://www.grants.gov/search-results-detail/${id}`,
          categories: [],
          posted_date: isoDate(h.openDate)
        })
      }

      const total = Number(data?.hitCount ?? 0)
      if (hits.length < PAGE || out.length >= total) break
    }
  } catch (e) {
    return { ok: false, fetched: out.length, opportunities: out, error: e instanceof Error ? e.message : String(e) }
  }

  return {
    ok: true,
    fetched: out.length,
    opportunities: out,
    warning: failedPages ? `${failedPages} page(s) failed; results may be incomplete.` : undefined
  }
}

/** Full detail for specific opportunities — call ONLY for on-device matches (see main/ingest.ts). */
export async function enrich(ids: string[]): Promise<Map<string, Partial<Opportunity>>> {
  const found = new Map<string, Partial<Opportunity>>()
  for (const id of ids) {
    try {
      const d = await post('fetchOpportunity', { opportunityId: id })
      const syn = d?.synopsis ?? {}
      found.set(id, {
        description: plain(syn.synopsisDesc),
        funding_amount: money(syn.awardCeiling) || money(syn.estimatedFunding),
        deadline: isoDate(syn.responseDate) || isoDate(d?.originalDueDate),
        // 🛑 NOT synopsis.agencyName — that field holds the grantor CONTACT's personal name.
        source_agency: String(d?.topAgencyDetails?.agencyName || d?.agencyDetails?.agencyName || '').trim(),
        categories: (syn.fundingActivityCategories ?? []).map((c: any) => String(c?.description ?? '').trim()).filter(Boolean)
      })
    } catch {
      // A detail failure is not fatal: the summary record is still worth importing.
    }
  }
  return found
}

// ── USAspending (award precedent) ──────────────────────────────────────────────
const USASPENDING_API = 'https://api.usaspending.gov/api/v2/search/spending_by_award/'
// Assistance (grant) award-type codes: 02 block · 03 formula · 04 project · 05 cooperative agreement.
const GRANT_TYPES = ['02', '03', '04', '05']

export interface PrecedentAward {
  id: string
  recipient: string
  amount: number
  agency: string
  date: string
  url: string
}

export interface PrecedentResult {
  ok: boolean
  awards: PrecedentAward[]
  error?: string
}

/** Recent federal grant awards matching `keyword` (drawn from a PUBLIC opportunity title). */
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
      time_period: [{ start_date: '2021-10-01', end_date: today }]
    },
    fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'Start Date'],
    sort: 'Award Amount',
    order: 'desc',
    limit: Math.min(Math.max(Math.trunc(limit) || 8, 1), 20),
    page: 1
  }

  try {
    const res = await fetch(USASPENDING_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const rows: any[] = Array.isArray(json?.results) ? json.results : []
    const awards: PrecedentAward[] = rows.map((r) => {
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
