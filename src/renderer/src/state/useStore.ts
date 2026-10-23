// GrantGuard store — backed by the live PocketBase backend via @ember/data.
// Same public API as the old localStorage store, so the pages don't change:
//   { grants, investors, addGrant, updateGrant, deleteGrant, addInvestor, deleteInvestor }
// Mutations write to the backend (owner-scoped RLS) then refresh from source of truth.
import { useCallback, useEffect, useState } from 'react'
import type { Grant, Investor, ApprovedSender, ApplicationProfile, UserPreference } from '../lib/grantTypes'
import { db, withOwner } from '../lib/db'

// Seed a brand-new account so the demo isn't a blank page (first login only).
const DEMO_GRANTS: Omit<Grant, 'id'>[] = [
  { title: 'SBIR Phase I — NSF', description: 'Small Business Innovation Research grant for early R&D.', funding_amount: 275000, deadline: '2026-08-05', source_agency: 'NSF', link_url: 'https://seedfund.nsf.gov', categories: ['R&D', 'Technology'], status: 'Applied', notes: 'Submitted 7/1, confirmation #NSF-88213.' },
  { title: 'Rural Business Development Grant', description: 'USDA funding for small rural enterprises.', funding_amount: 50000, deadline: '2026-07-20', source_agency: 'USDA', link_url: 'https://www.rd.usda.gov', categories: ['Small Business'], status: 'Reviewed', notes: '' },
  { title: 'EDA Build to Scale', description: 'Regional tech-based economic development.', funding_amount: 400000, deadline: '2026-07-15', source_agency: 'EDA', categories: ['Technology', 'Economic Development'], status: 'New', notes: '' },
  { title: 'State Clean Energy Fund', description: 'Grants for clean-energy commercialization.', funding_amount: 120000, deadline: '2026-09-30', source_agency: 'State Energy Office', categories: ['Energy'], status: 'New', notes: '' },
  { title: 'Community Development Block Grant', description: 'HUD funds for community economic development.', funding_amount: 90000, deadline: '2026-06-01', source_agency: 'HUD', categories: ['Community'], status: 'Awarded', notes: 'Awarded 6/3 — $90k.' },
]
const DEMO_INVESTORS: Omit<Investor, 'id'>[] = [
  { name: 'Prairie Ventures', investor_type: 'venture_capital', focus_areas: ['SaaS', 'Climate'], stage: 'Seed', typical_check_min: 250000, typical_check_max: 1500000, is_active: true },
  { name: 'Jane Okafor (Angel)', investor_type: 'angel', focus_areas: ['Healthtech', 'AI'], stage: 'Pre-seed', typical_check_min: 25000, typical_check_max: 100000, is_active: true },
  { name: 'North Star Capital', investor_type: 'venture_capital', focus_areas: ['Fintech'], stage: 'Series A', typical_check_min: 1000000, typical_check_max: 5000000, is_active: true },
]

// Seed exactly once per session — immune to React StrictMode's double-invoke of
// effects in dev (which would otherwise race two empty-checks into a double-seed).
let bootstrap: Promise<void> | null = null
function bootstrapOnce(): Promise<void> {
  if (!bootstrap) {
    bootstrap = (async () => {
      const existing = await db.from('grants').select('id').limit(1)
      if (!existing.error && (existing.data?.length ?? 0) === 0) {
        for (const g of DEMO_GRANTS) await db.from('grants').insert(withOwner(g))
        for (const inv of DEMO_INVESTORS) await db.from('investors').insert(withOwner(inv))
      }
    })()
  }
  return bootstrap
}

export function useStore() {
  const [grants, setGrants] = useState<Grant[]>([])
  const [investors, setInvestors] = useState<Investor[]>([])
  const [approvedSenders, setApprovedSenders] = useState<ApprovedSender[]>([])
  const [profiles, setProfiles] = useState<ApplicationProfile[]>([])
  const [preferences, setPreferences] = useState<UserPreference | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [g, i, s, p, pref] = await Promise.all([
      db.from('grants').select('*').order('deadline', { ascending: true }),
      db.from('investors').select('*').order('name', { ascending: true }),
      db.from('approved_senders').select('*').order('email_or_domain', { ascending: true }),
      db.from('application_profiles').select('*').order('profile_name', { ascending: true }),
      db.from('user_preferences').select('*').limit(1),
    ])
    setGrants((g.data ?? []) as Grant[])
    setInvestors((i.data ?? []) as Investor[])
    setApprovedSenders((s.data ?? []) as ApprovedSender[])
    setProfiles((p.data ?? []) as ApplicationProfile[])
    setPreferences(((pref.data ?? [])[0] as UserPreference) ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    ;(async () => {
      await bootstrapOnce()
      await refresh()
    })()
  }, [refresh])

  const addGrant = useCallback(async (g: Omit<Grant, 'id'>) => {
    await db.from('grants').insert(withOwner(g))
    await refresh()
  }, [refresh])
  const updateGrant = useCallback(async (gid: string, patch: Partial<Grant>) => {
    await db.from('grants').update(patch).eq('id', gid)
    await refresh()
  }, [refresh])
  const deleteGrant = useCallback(async (gid: string) => {
    await db.from('grants').delete().eq('id', gid)
    await refresh()
  }, [refresh])

  const addInvestor = useCallback(async (inv: Omit<Investor, 'id'>) => {
    await db.from('investors').insert(withOwner(inv))
    await refresh()
  }, [refresh])
  const deleteInvestor = useCallback(async (iid: string) => {
    await db.from('investors').delete().eq('id', iid)
    await refresh()
  }, [refresh])

  const addSender = useCallback(async (s: Omit<ApprovedSender, 'id'>) => {
    await db.from('approved_senders').insert(withOwner(s))
    await refresh()
  }, [refresh])
  const deleteSender = useCallback(async (id: string) => {
    await db.from('approved_senders').delete().eq('id', id)
    await refresh()
  }, [refresh])

  const addProfile = useCallback(async (p: Omit<ApplicationProfile, 'id'>) => {
    await db.from('application_profiles').insert(withOwner(p))
    await refresh()
  }, [refresh])
  const updateProfile = useCallback(async (id: string, patch: Partial<ApplicationProfile>) => {
    await db.from('application_profiles').update(patch).eq('id', id)
    await refresh()
  }, [refresh])
  const deleteProfile = useCallback(async (id: string) => {
    await db.from('application_profiles').delete().eq('id', id)
    await refresh()
  }, [refresh])

  // One preference record per user — upsert by hand (create first time, else update).
  const savePreferences = useCallback(async (patch: Partial<UserPreference>) => {
    if (preferences?.id) {
      await db.from('user_preferences').update(patch).eq('id', preferences.id)
    } else {
      // First save: persist the FULL effective state so toggles we didn't touch
      // keep their intended defaults instead of falling to PocketBase's `false`.
      const full: Partial<UserPreference> = { notify_email: true, notify_in_app: true, email_frequency: 'daily', ...patch }
      await db.from('user_preferences').insert(withOwner(full))
    }
    await refresh()
  }, [refresh, preferences])

  return {
    grants, investors, approvedSenders, profiles, preferences, loading,
    addGrant, updateGrant, deleteGrant,
    addInvestor, deleteInvestor,
    addSender, deleteSender,
    addProfile, updateProfile, deleteProfile,
    savePreferences,
  }
}
