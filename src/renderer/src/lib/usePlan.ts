/**
 * Current entitlement for the signed-in account.
 *
 * 🛑 DEFAULTS TO 'basic', ALWAYS. Every failure path — no bridge, IPC error, unreadable
 * licence file, mid-flight loading — resolves to basic. An entitlement check that fails
 * OPEN gives the paid product away on any error, and it does so silently, so nobody finds
 * out until revenue is already gone.
 *
 * Verification happens in the MAIN process against an embedded public key. This hook only
 * reports the answer; it never decides it, so patching the renderer's state gains nothing
 * that patching the binary would not already give.
 */
import { useCallback, useEffect, useState } from 'react'
import { bridge, type LicenseStatus } from './bridge'
import { LOCAL_MODE } from './db'

export function usePlan(email: string | null | undefined) {
  const [status, setStatus] = useState<LicenseStatus>({ plan: 'basic' })
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const api = bridge()
    // 🛑 Desktop keys entitlement to the signed-in account, so no account = basic. But mobile
    // (LOCAL_MODE) has no account at all — the license binds to its OWN issued email and the
    // bridge's licenseStatus re-verifies that binding internally against the stored key. Gating
    // on a null `email` there would make a validly-activated license read as basic forever
    // (the bug that kept mobile Pro locked after activation). So only require `email` off-mobile.
    if (!api || (!email && !LOCAL_MODE)) { setStatus({ plan: 'basic' }); setLoading(false); return }
    try {
      setStatus(await api.licenseStatus(email ?? ''))
    } catch {
      setStatus({ plan: 'basic' })
    } finally {
      setLoading(false)
    }
  }, [email])

  useEffect(() => { void refresh() }, [refresh])

  return { ...status, isPro: status.plan === 'pro', loading, refresh }
}
