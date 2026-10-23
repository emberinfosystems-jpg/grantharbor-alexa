// GrantGuard datastore — the app's single door to the backend.
// Wraps the shared @ember/data rail (supabase-dialect facade over PocketBase).
// Swapping backends = flip VITE_DB_BACKEND in .env; no code here changes.
//
// Phase 1 (backend) status: collections + owner-scoped RLS live and proven
// (see pocketbase/smoke-rls.mjs). Reads/writes require an authenticated user —
// wiring the auth screen + swapping useStore onto these calls is Phase 2.
import { makeClient } from '@ember/data'
import { explainPocketbaseError } from '@ember/auth/adapters'
import { makeLocalClient } from './localDb'

// Backend mode. 'local' = free mobile tier: on-device IndexedDB, no auth (the device is the
// boundary). 'pocketbase' = desktop + Pro: server, accounts, cross-device sync. Build default
// comes from VITE_DB_BACKEND (.env = pocketbase, .env.mobile = local); a runtime localStorage
// override ('gh_backend') lets a future Pro upgrade flip local → cloud without a rebuild.
function resolveBackend(): string {
  try { const o = localStorage.getItem('gh_backend'); if (o) return o } catch { /* localStorage unavailable */ }
  const env = (import.meta as unknown as { env?: Record<string, string> }).env
  return env?.VITE_DB_BACKEND || 'pocketbase'
}
export const LOCAL_MODE = resolveBackend() === 'local'

// A no-op PocketBase-shaped stub so @ember/auth's adapter (built at module load in useAuth.ts)
// can construct in local mode without a real server. The auth flow is never rendered when
// LOCAL_MODE — App skips the gate entirely — so this only needs to exist, not to work.
const pbStub = {
  baseURL: '',
  authStore: {
    record: null, model: null, token: '', isValid: false,
    onChange: (_cb: unknown, _fireNow?: boolean) => () => {}, clear: () => {}
  },
  collection: () => { throw new Error('auth is unavailable in local mode') }
}

export const db = LOCAL_MODE
  ? (makeLocalClient() as unknown as ReturnType<typeof makeClient>)
  : makeClient({ backend: 'pocketbase' })
// Auth escape hatch (mirrors supabase.auth) — real PocketBase SDK instance, or the stub locally.
export const pb = LOCAL_MODE
  ? (pbStub as unknown as import('pocketbase').default)
  : (db as unknown as { _pb: import('pocketbase').default })._pb

export function currentUserId(): string | null {
  if (LOCAL_MODE) return 'local' // single-device: a stable owner key for withOwner + alerts
  return pb.authStore.record?.id ?? null
}

/**
 * 🛑 Every auth call goes through `explained`. This is not defensive garnish — it is the
 * whole difference between a usable sign-up form and a dead end.
 *
 * PocketBase answers a failed create with the top-level message "Something went wrong while
 * processing your request." and puts the REAL cause in `err.response.data` as per-field
 * validation errors. Re-throwing `err` as-is means "that email is already registered",
 * "password must be at least 8 characters", and "the database isn't running" all render
 * identically as a shrug — with no way for the user to act on any of them.
 *
 * @ember/auth already solved this and its own comment records that the fix was harvested
 * from Resonance "where its absence cost weeks". GrantHarbor hand-rolled these two helpers
 * instead of using the rail and so inherited the identical bug — Scott hit it on 2026-08-25
 * trying to create the first account, and got exactly "Could not create account: Something
 * went wrong." 🛑 If you add another direct `pb.collection(...)` call here, wrap it too.
 */
async function explained<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    throw new Error(explainPocketbaseError(err))
  }
}

export async function signIn(email: string, password: string) {
  return explained(() => pb.collection('users').authWithPassword(email, password))
}

export async function register(email: string, password: string) {
  await explained(() => pb.collection('users').create({ email, password, passwordConfirm: password }))
  return signIn(email, password)
}

/**
 * Change the password of the signed-in user.
 *
 * 🛑 `oldPassword` is required by PocketBase and that requirement is load-bearing: without
 * it, anyone who walks up to an unlocked session could change the password and lock the real
 * owner out of their own business records.
 *
 * PocketBase invalidates the auth token when the password changes, so we re-authenticate
 * with the NEW password immediately — otherwise the user is silently signed out mid-session
 * and the app looks like it crashed the moment they touch anything.
 */
export async function changePassword(email: string, oldPassword: string, newPassword: string) {
  const uid = currentUserId()
  if (!uid) throw new Error('Not signed in.')
  await explained(() =>
    pb.collection('users').update(uid, {
      oldPassword,
      password: newPassword,
      passwordConfirm: newPassword
    })
  )
  return explained(() => pb.collection('users').authWithPassword(email, newPassword))
}

/**
 * Confirm the current password without disturbing the session.
 *
 * 🛑 `authWithPassword` REPLACES the auth store on success, so calling it on the live client
 * to "just check" would silently re-issue the session token. A throwaway client keeps the
 * check side-effect-free.
 */
export async function verifyPassword(email: string, password: string): Promise<true> {
  const probe = new (pb.constructor as new (url: string) => typeof pb)(pb.baseURL)
  probe.autoCancellation(false)
  try {
    await probe.collection('users').authWithPassword(email, password)
  } catch {
    throw new Error('That password is not correct.')
  }
  probe.authStore.clear()
  return true
}

export async function requestPasswordReset(email: string) {
  return explained(() => pb.collection('users').requestPasswordReset(email))
}

export async function confirmPasswordReset(token: string, password: string) {
  return explained(() => pb.collection('users').confirmPasswordReset(token, password, password))
}

export function signOut() {
  pb.authStore.clear()
}

// Stamp created_by so owner-scoped RLS accepts the write.
export function withOwner<T extends object>(row: T): T & { created_by: string } {
  const uid = currentUserId()
  if (!uid) throw new Error('not authenticated')
  return { ...row, created_by: uid }
}
