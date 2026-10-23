/**
 * On-device matching and de-duplication for the ingestion agent.
 *
 * This runs in the RENDERER on purpose, and the split is not arbitrary:
 *   main    — network only. Fetches the public corpus, knows nothing about the user.
 *   renderer — matching, de-duplication and the database write.
 *
 * PocketBase enforces owner-scoped RLS, so every write must carry the signed-in user's auth
 * token. The main process has no session; if it wrote directly it would need either a service
 * credential or RLS turned off — and the owner-scoping is the thing that makes one local
 * database safe for a real business's data. Keeping writes in the renderer keeps that intact.
 *
 * The privacy consequence matters too: the user's keywords are compared against the corpus
 * HERE, on the machine. Nothing about what this business is looking for is ever transmitted.
 */
import type { Grant } from './grantTypes'

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

export interface Candidate {
  opp: Opportunity
  score: number
  /** Which of the user's keywords hit — shown in the UI so a match is never a black box. */
  matched: string[]
  duplicateOf?: string
}

/** Words too common to carry signal; matching on them returns the whole corpus. */
const STOP = new Set([
  'grant', 'grants', 'program', 'programs', 'funding', 'fund', 'funds', 'federal', 'national',
  'the', 'and', 'for', 'of', 'to', 'in', 'a', 'an', 'fy', 'year', 'new', 'us', 'usa'
])

export function normalizeKeyword(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * 🛑 Matching runs on TITLE + AGENCY (+ categories when present) — never description.
 *
 * Not a shortcut: the list endpoint carries no description, so scoring on it would force a
 * detail request for all ~1,078 opportunities on every run just to decide what to keep.
 * Titles in this corpus are unusually descriptive ("National Dam Safety Program State
 * Assistance"), which is what makes the cheap signal a good one.
 *
 * Note that `categories` is empty during the first pass — it only arrives with enrichment,
 * which by design happens AFTER matching. It is included here so the same function can
 * re-score already-enriched opportunities without a second code path.
 *
 * Measured against a live 226-opportunity window (2026-08-25): health 21, research 29,
 * education 15. `art` scores 0 while 26 titles contain the letters — "Department",
 * "quarterly", "partnership". That is the whole-word guard doing its job, not a miss.
 */
export function scoreOpportunity(opp: Opportunity, keywords: string[]): Candidate | null {
  if (!keywords.length) return null
  const hay = normalizeKeyword(
    [opp.title, opp.source_agency, opp.categories.join(' ')].join(' ')
  )
  const matched: string[] = []
  let score = 0

  for (const kw of keywords) {
    const k = normalizeKeyword(kw)
    if (!k || STOP.has(k)) continue
    // Whole-word-ish match so "art" does not fire on "start" or "particle".
    const re = new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`)
    if (re.test(hay)) {
      matched.push(kw)
      // A multi-word phrase matching is far stronger evidence than a single word.
      score += k.includes(' ') ? 3 : 1
    }
  }
  return matched.length ? { opp, score, matched } : null
}

/**
 * De-duplication.
 *
 * Matches on the Grants.gov opportunity NUMBER carried in the stored link/notes, and falls
 * back to a normalized title+agency comparison for grants the user typed in by hand — which
 * is the case that actually matters. Someone on the free tier has been entering these
 * manually for weeks; the first Pro run must not hand them 40 duplicates of their own work.
 */
export function findDuplicate(opp: Opportunity, existing: Grant[]): string | undefined {
  const num = opp.source_number.toLowerCase().trim()
  const title = normalizeKeyword(opp.title)
  const agency = normalizeKeyword(opp.source_agency)

  for (const g of existing) {
    const blob = `${g.link_url ?? ''} ${g.notes ?? ''} ${g.confirmation_number ?? ''}`.toLowerCase()
    if (num && blob.includes(num)) return g.id
    if (opp.source_id && (g.link_url ?? '').includes(`/${opp.source_id}`)) return g.id

    const gTitle = normalizeKeyword(g.title ?? '')
    if (!gTitle || !title) continue
    if (gTitle === title) return g.id
    // Hand-entered titles get truncated or lightly reworded. Require a strong prefix match
    // AND the same agency before calling it a duplicate — a false positive here silently
    // HIDES a real opportunity, which is worse than showing one the user must dismiss.
    const shorter = gTitle.length < title.length ? gTitle : title
    const longer = gTitle.length < title.length ? title : gTitle
    if (shorter.length >= 25 && longer.startsWith(shorter) && normalizeKeyword(g.source_agency ?? '') === agency) {
      return g.id
    }
  }
  return undefined
}

export function buildCandidates(
  opportunities: Opportunity[],
  keywords: string[],
  existing: Grant[]
): Candidate[] {
  const out: Candidate[] = []
  for (const opp of opportunities) {
    const c = scoreOpportunity(opp, keywords)
    if (!c) continue
    c.duplicateOf = findDuplicate(opp, existing)
    out.push(c)
  }
  // Strongest match first, then soonest deadline — a close deadline is the urgent one.
  return out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const ad = a.opp.deadline || '9999-99-99'
    const bd = b.opp.deadline || '9999-99-99'
    return ad.localeCompare(bd)
  })
}

/** Map a matched opportunity onto the app's Grant shape, ready to insert. */
export function toGrant(opp: Opportunity): Omit<Grant, 'id'> {
  return {
    title: opp.title,
    description: opp.description,
    funding_amount: opp.funding_amount,
    deadline: opp.deadline,
    source_agency: opp.source_agency,
    link_url: opp.link_url,
    categories: opp.categories,
    status: 'New',
    // The opportunity number is the durable identity for de-duplication on later runs.
    notes: `Imported from Grants.gov — opportunity ${opp.source_number}`
  }
}
