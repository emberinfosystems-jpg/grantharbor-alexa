/**
 * GrantHarbor ingestion agent — the Pro tier's actual product.
 *
 * Pulls open funding opportunities from the Grants.gov public API and normalizes them into
 * the shape the app already stores. Runs in the MAIN process: no CORS, and network I/O
 * belongs out of the renderer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🛑 THE PRIVACY DECISION, AND WHY IT SHAPED THE WHOLE MODULE
 *
 * The obvious build is to send the user's saved categories to the API as search keywords.
 * It is less code and less bandwidth — and it would quietly break the app's central claim.
 * Legal.tsx publishes `localFirst: true`, and the subprocessor oracle passes because NOTHING
 * about the user leaves the device. Keyword search would send a profile of what this
 * business is looking for — its industry, its needs — to a third party on a timer.
 *
 * So: fetch the ENTIRE posted corpus with no keyword, and match on-device.
 *
 * That is only affordable because the corpus is small — 1,078 posted opportunities total,
 * ~43 new per week (measured 2026-08-25). If it were a million rows this trade would not be
 * available and the honest move would be to change the legal page, not to hide the leak.
 * Re-check that number before assuming this still holds.
 *
 * The requests we DO make are identical for every user: same URL, same body, no identifiers.
 * Grants.gov learns "somebody asked for the public list", which is what the list is for.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const API = 'https://api.grants.gov/v1/api'
const PAGE = 200          // API accepts larger, but 200 keeps each response small and retryable
const MAX_PAGES = 25      // hard ceiling — 5,000 records. Corpus is ~1,078; this is a runaway guard.
const REQUEST_TIMEOUT_MS = 30_000

/** One opportunity, normalized to the app's Grant shape (minus the fields the user owns). */
export interface Opportunity {
  source_id: string          // Grants.gov internal id — stable, used for de-duplication
  source_number: string      // human-facing opportunity number, e.g. OST-OSDBU-2026-…
  title: string
  description: string
  funding_amount: number
  deadline: string           // ISO date, '' when the notice has no close date
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
  /** Populated when SOME pages failed — a partial result is still useful, but must be visible. */
  warning?: string
}

async function post(path: string, body: unknown): Promise<any> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(`${API}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    // 🛑 Grants.gov returns HTTP 200 with errorcode != 0 on failure. Trusting the status
    // code alone would treat an error envelope as an empty-but-successful result — which
    // silently reports "0 new opportunities" instead of "the fetch broke".
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
  // Local parts, not toISOString: a date-only value must not shift a day across timezones.
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function money(raw: unknown): number {
  const n = Number(String(raw ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * Page through every POSTED opportunity. No keyword — see the privacy note above.
 * `sinceDays` narrows by posting date on later runs so a routine refresh is cheap.
 */
export async function fetchPosted(sinceDays?: number): Promise<IngestResult> {
  const out: Opportunity[] = []
  const seen = new Set<string>()
  let failedPages = 0

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const body: Record<string, unknown> = {
        rows: PAGE,
        startRecordNum: page * PAGE,
        oppStatuses: 'posted'
      }
      // The API exposes posted-date windows as a fixed set of day counts.
      if (sinceDays && sinceDays > 0) body.dateRange = String(sinceDays)

      let data: any
      try {
        data = await post('search2', body)
      } catch (e) {
        failedPages++
        // One bad page should not discard the pages that worked.
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
          description: '',                       // filled by enrich() only for real matches
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
    return {
      ok: false,
      fetched: out.length,
      opportunities: out,
      error: e instanceof Error ? e.message : String(e)
    }
  }

  return {
    ok: true,
    fetched: out.length,
    opportunities: out,
    warning: failedPages ? `${failedPages} page(s) failed; results may be incomplete.` : undefined
  }
}

/**
 * Fetch full detail for specific opportunities.
 *
 * 🛑 Called ONLY for opportunities that already matched on-device. The list endpoint carries
 * no description or funding amount, so enriching everything would mean ~1,078 extra requests
 * per run to populate records the user will never see. Matching first turns that into a
 * handful — and the match itself runs on title/agency, which the list DOES provide.
 */
export async function enrich(ids: string[]): Promise<Map<string, Partial<Opportunity>>> {
  const found = new Map<string, Partial<Opportunity>>()
  for (const id of ids) {
    try {
      const d = await post('fetchOpportunity', { opportunityId: id })
      const syn = d?.synopsis ?? {}
      found.set(id, {
        description: plain(syn.synopsisDesc),
        // awardCeiling is the per-award maximum — the number an applicant actually cares
        // about. estimatedFunding is the whole program pot and reads as wildly inflated.
        funding_amount: money(syn.awardCeiling) || money(syn.estimatedFunding),
        deadline: isoDate(syn.responseDate) || isoDate(d?.originalDueDate),
        // 🛑 NOT synopsis.agencyName — that field holds the grantor CONTACT's personal name
        // ("Steronica Mattocks\nGrantor" on the record this was written against). Importing
        // it would put a stranger's name in the source_agency column of the user's tracker.
        source_agency:
          String(d?.topAgencyDetails?.agencyName || d?.agencyDetails?.agencyName || '').trim(),
        categories: (syn.fundingActivityCategories ?? [])
          .map((c: any) => String(c?.description ?? '').trim())
          .filter(Boolean)
      })
    } catch {
      // A detail failure is not fatal: the summary record is still worth importing.
    }
  }
  return found
}
