/**
 * Discover — the ingestion agent's surface.
 *
 * The Pro tier sells "the agent does the finding", so this page has to actually do it:
 * pull the open federal corpus, match it against the user's own keywords ON DEVICE, hide
 * what they already track, and let them take what is useful in one action.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Radar, Loader2, Plus, ExternalLink, AlertTriangle, Check, X, TrendingUp } from 'lucide-react'
import { Card, CardContent, Input, Button, StatusBadge, EmptyState } from '@ember/ui'
import { buildCandidates, toGrant, type Candidate, type Opportunity } from '../lib/ingestMatch'
import { bridge } from '../lib/bridge'
import { usePlan } from '../lib/usePlan'
import ProGate from '../components/ProGate'
import { usd } from '../format'
import type { useStore } from '../state/useStore'

/** Days of postings to pull. 30 keeps a routine run fast; the corpus only adds ~43/week. */
const WINDOW_DAYS = 30

export default function Discover({ store, email, onUpgrade, onMatches }: { store: ReturnType<typeof useStore>; email?: string | null; onUpgrade: () => void; onMatches?: (n: number) => void }) {
  const { grants, preferences, savePreferences, addGrant } = store
  const { isPro, loading: planLoading } = usePlan(email)

  const keywords = useMemo(
    () => (preferences?.preferred_categories ?? []).filter(Boolean),
    [preferences]
  )
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [problem, setProblem] = useState('')
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [imported, setImported] = useState(0)

  // "Who's won funding like this" — precedent from USAspending, per opportunity, on demand.
  // Keyed by source_id: fetched once on first open, then just toggled. 🛑 The keyword is the
  // opportunity's own (public) title — never the user's saved keywords. See usaspending.ts.
  type Award = { id: string; recipient: string; amount: number; agency: string; date: string; url: string }
  type Precedent = { open: boolean; loading: boolean; awards?: Award[]; error?: string }
  const [precedent, setPrecedent] = useState<Record<string, Precedent>>({})

  const togglePrecedent = useCallback(async (opp: Opportunity) => {
    const id = opp.source_id
    const cur = precedent[id]
    if (cur?.open) { setPrecedent((p) => ({ ...p, [id]: { ...cur, open: false } })); return }
    if (cur && (cur.awards || cur.error)) { setPrecedent((p) => ({ ...p, [id]: { ...cur, open: true } })); return }
    const api = bridge()
    if (!api) return
    setPrecedent((p) => ({ ...p, [id]: { open: true, loading: true } }))
    try {
      const res = await api.awardPrecedent(opp.title.trim())
      setPrecedent((p) => ({ ...p, [id]: { open: true, loading: false, awards: res.awards, error: res.ok ? undefined : (res.error || 'Lookup failed') } }))
    } catch (e) {
      setPrecedent((p) => ({ ...p, [id]: { open: true, loading: false, error: e instanceof Error ? e.message : String(e) } }))
    }
  }, [precedent])

  // The agent is only available inside the desktop app — the bridge lives in the main
  // process. In a browser preview this is undefined, and saying so plainly beats a button
  // that silently does nothing.
  const available = !!bridge()

  const addKeyword = useCallback(async () => {
    const kw = draft.trim()
    if (!kw || keywords.some((k) => k.toLowerCase() === kw.toLowerCase())) { setDraft(''); return }
    await savePreferences({ preferred_categories: [...keywords, kw] })
    setDraft('')
  }, [draft, keywords, savePreferences])

  const removeKeyword = useCallback(async (kw: string) => {
    await savePreferences({ preferred_categories: keywords.filter((k) => k !== kw) })
  }, [keywords, savePreferences])

  const run = useCallback(async () => {
    const api = bridge()
    // 🛑 Belt as well as braces: the page is gated below, but the handler re-checks so a
    // stale render or a devtools poke cannot start a Pro run.
    if (!api || !isPro) return
    setBusy(true); setProblem(''); setCandidates(null); setImported(0)
    try {
      setStatus('Fetching open opportunities…')
      const res = await api.fetchOpportunities(WINDOW_DAYS)
      if (!res.ok) {
        // 🛑 Say what actually failed. "No opportunities found" after a network error is a
        // lie that reads as a real answer — the user concludes nothing matches them.
        setProblem(res.error ? `Could not reach Grants.gov: ${res.error}` : 'The fetch failed.')
        return
      }
      if (res.warning) setProblem(res.warning)

      setStatus(`Matching ${res.fetched} opportunities against your keywords…`)
      const matches = buildCandidates(res.opportunities, keywords, grants)

      // Detail is fetched only for what matched — see the note in ingest.ts.
      const fresh = matches.filter((c) => !c.duplicateOf).slice(0, 100)
      if (fresh.length) {
        setStatus(`Loading details for ${fresh.length} match${fresh.length === 1 ? '' : 'es'}…`)
        const detail = await api.enrichOpportunities(fresh.map((c) => c.opp.source_id))
        for (const c of fresh) {
          const d = detail[c.opp.source_id]
          if (d) c.opp = { ...c.opp, ...d }
        }
      }

      setCandidates(matches)
      setChosen(new Set(fresh.map((c) => c.opp.source_id)))
      // 🛑 Announce only what is NEW. Counting duplicates the user already tracks would
      // make every run look like a fresh haul and the alert meaningless.
      onMatches?.(fresh.length)
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false); setStatus('')
    }
  }, [keywords, grants, isPro, onMatches])

  const importSelected = useCallback(async () => {
    if (!candidates) return
    const picks = candidates.filter((c) => chosen.has(c.opp.source_id) && !c.duplicateOf)
    setBusy(true); setStatus(`Importing ${picks.length}…`)
    let n = 0
    try {
      for (const c of picks) { await addGrant(toGrant(c.opp)); n++ }
      setImported(n)
      setCandidates((prev) => (prev ? prev.filter((c) => !chosen.has(c.opp.source_id)) : prev))
      setChosen(new Set())
    } catch (e) {
      // Report the partial truth: some may already be in the tracker.
      setProblem(`Imported ${n} of ${picks.length}. ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false); setStatus('')
    }
  }, [candidates, chosen, addGrant])

  useEffect(() => { setCandidates(null) }, [keywords.length])

  const dupes = candidates?.filter((c) => c.duplicateOf).length ?? 0
  const fresh = candidates?.filter((c) => !c.duplicateOf) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Discover</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The agent pulls open federal funding opportunities and matches them against your keywords.
          Matching happens on this computer — your keywords are never sent anywhere.
        </p>
      </div>

      {!planLoading && !isPro && <ProGate onUpgrade={onUpgrade} />}

      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold">Your keywords</h2>
          <p className="text-xs text-muted-foreground">
            Words and phrases that describe what you fund or do — “rural health”, “broadband”,
            “workforce training”. Phrases score higher than single words.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              className="w-64"
              placeholder="e.g. rural health"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addKeyword() } }}
            />
            <Button variant="secondary" icon={Plus} onClick={() => void addKeyword()}>Add</Button>
          </div>
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {keywords.map((kw) => (
                <span key={kw} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs">
                  {kw}
                  <button
                    type="button"
                    onClick={() => void removeKeyword(kw)}
                    aria-label={`Remove ${kw}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          icon={busy ? Loader2 : Radar}
          loading={busy}
          disabled={busy || !keywords.length || !available || !isPro}
          onClick={() => void run()}
        >
          {busy ? 'Working…' : 'Find opportunities'}
        </Button>
        {status && <span className="text-sm text-muted-foreground">{status}</span>}
        {!available && (
          <span className="text-sm text-muted-foreground">
            The agent runs in the desktop app.
          </span>
        )}
        {!keywords.length && available && (
          <span className="text-sm text-muted-foreground">Add at least one keyword to search.</span>
        )}
      </div>

      {problem && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>{problem}</span>
        </div>
      )}

      {imported > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
          <Check className="h-4 w-4 text-primary" />
          Imported {imported} opportunit{imported === 1 ? 'y' : 'ies'} into your grants list.
        </div>
      )}

      {candidates && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <span className="font-semibold">{fresh.length}</span> new match{fresh.length === 1 ? '' : 'es'}
                {dupes > 0 && (
                  <span className="text-muted-foreground"> · {dupes} already in your list, hidden</span>
                )}
              </div>
              {fresh.length > 0 && (
                <Button
                  variant="primary"
                  disabled={busy || chosen.size === 0}
                  onClick={() => void importSelected()}
                >
                  Import {chosen.size} selected
                </Button>
              )}
            </div>

            {fresh.length === 0 ? (
              <EmptyState
                title="Nothing new"
                message={
                  dupes > 0
                    ? 'Every match is already in your grants list.'
                    : 'No open opportunities matched your keywords. Try a broader term.'
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {fresh.map((c) => {
                  const id = c.opp.source_id
                  const on = chosen.has(id)
                  return (
                    <li key={id} className="flex items-start gap-3 py-3">
                      <input
                        type="checkbox"
                        checked={on}
                        aria-label={`Select ${c.opp.title}`}
                        className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                        onChange={() => setChosen((prev) => {
                          const next = new Set(prev)
                          if (next.has(id)) next.delete(id); else next.add(id)
                          return next
                        })}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{c.opp.title}</span>
                          <a
                            href={c.opp.link_url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" /> Grants.gov
                          </a>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{c.opp.source_agency || 'Unknown agency'}</span>
                          {c.opp.deadline && <span>Closes {c.opp.deadline}</span>}
                          {c.opp.funding_amount > 0 && <span>Up to {usd(c.opp.funding_amount)}</span>}
                        </div>
                        {/* Why this matched — a recommendation the user cannot inspect is
                            one they cannot trust or correct. */}
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {c.matched.map((m) => (
                            <StatusBadge key={m} tone="info">{m}</StatusBadge>
                          ))}
                        </div>

                        {/* Precedent — who has already won grants like this (USAspending). A reason
                            to trust the ask size, and the kind of intel a plain grants list never shows. */}
                        {available && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => void togglePrecedent(c.opp)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              <TrendingUp className="h-3 w-3" />
                              {precedent[id]?.open ? 'Hide who’s won funding like this' : 'Who’s won funding like this?'}
                            </button>
                            {precedent[id]?.open && (
                              <div className="mt-2 rounded-md border border-border bg-secondary/30 p-3">
                                {precedent[id]?.loading && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Searching federal awards…
                                  </div>
                                )}
                                {precedent[id]?.error && (
                                  <div className="text-xs text-muted-foreground">
                                    Couldn’t load precedent: {precedent[id]?.error}
                                  </div>
                                )}
                                {precedent[id]?.awards && precedent[id]!.awards!.length === 0 && (
                                  <div className="text-xs text-muted-foreground">
                                    No recent federal grant awards matched this opportunity’s title.
                                  </div>
                                )}
                                {precedent[id]?.awards && precedent[id]!.awards!.length > 0 && (
                                  <>
                                    <div className="mb-2 text-xs text-muted-foreground">
                                      Recent federal grant awards matching this opportunity — largest first
                                      (source: USAspending.gov).
                                    </div>
                                    <ul className="space-y-1.5">
                                      {precedent[id]!.awards!.map((a) => (
                                        <li key={a.id + a.recipient} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs">
                                          <a
                                            href={a.url}
                                            target="_blank"
                                            rel="noreferrer noopener"
                                            className="min-w-0 font-medium text-foreground hover:underline"
                                          >
                                            {a.recipient}
                                          </a>
                                          <span className="text-muted-foreground">
                                            {a.agency}{a.date ? ` · ${a.date.slice(0, 4)}` : ''}
                                          </span>
                                          <span className="font-semibold">{usd(a.amount)}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
