/**
 * MOBILE license verification — the offline, signature-verified Pro entitlement, ported for the
 * Capacitor build so ONE Ed25519 license unlocks Pro on desktop AND mobile. Sold on the web via
 * Stripe (0% store cut), verified here with the embedded PUBLIC key. No license server, no store
 * billing — matches the desktop model in `src/main/license.ts` exactly.
 *
 * 🛑🛑 KEEP IN SYNC WITH `src/main/license.ts`. Same public key, same `[64-byte sig][json]` key
 * format, same base32 alphabet, same grace/lapse math. Desktop uses Node `crypto` + safeStorage +
 * fs; this uses `@noble/ed25519` + WebCrypto SHA + localStorage. The SIGNATURE is the security
 * boundary (not secrecy of the stored key — see license.ts), so plaintext localStorage is fine.
 *
 * 🛑 Fails CLOSED: any doubt → 'basic'. Never grant Pro on an error path.
 */
import * as ed from '@noble/ed25519'
import type { LicenseStatus, Plan } from './bridge'

// @noble/ed25519 v2 is hash-agnostic — wire SHA-512 via WebCrypto (universal in WebView + web).
ed.etc.sha512Async = async (...m: Uint8Array[]) =>
  new Uint8Array(await crypto.subtle.digest('SHA-512', ed.etc.concatBytes(...m) as BufferSource))

/** Raw 32-byte Ed25519 public key, base64 — IDENTICAL to license.ts. Verifies, cannot sign. */
const LICENSE_PUBLIC_KEY = 'chUcvlF7wT3zOMoK0ICW7Dpb11JGOBECEUVAgBk6iRE='
const GRACE_DAYS = 3

const LS_LICENSE = 'gh_pro_license' // { key, email }
const LS_TIMEMARK = 'gh_timemark'   // clock-rollback high-water (UTC day number)

interface Payload {
  e: string          // account the licence is bound to, lower-cased (or its sha256[:32] hash)
  p: Plan
  i: string          // ISO date issued
  o?: string         // order / receipt ref
  x?: string         // ACCESS-through date YYYY-MM-DD; absent = perpetual
  b?: string         // BILLING date YYYY-MM-DD (next charge)
}

// ── encoding helpers ───────────────────────────────────────────────────────────
const b64ToBytes = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
const PUBKEY = b64ToBytes(LICENSE_PUBLIC_KEY)

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function b32decode(str: string): Uint8Array {
  let bits = 0, value = 0
  const out: number[] = []
  for (const ch of str) {
    const idx = B32.indexOf(ch)
    if (idx === -1) throw new Error('bad character')
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Uint8Array.from(out)
}
/** Strip formatting so a key can be pasted with or without dashes, in any case. */
const clean = (key: string): string => String(key || '').replace(/[\s-]/g, '').toUpperCase()

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ── date helpers (UTC-day, faithful to license.ts) ──────────────────────────────
const utcDay = (d: Date): number =>
  Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000)

function parseDay(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim())
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  if (d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null
  return utcDay(d)
}

/** Clock-rollback high-water mark (localStorage analog of desktop's .timemark). */
function effectiveToday(): number {
  const now = utcDay(new Date())
  let seen = 0
  try { seen = parseInt(localStorage.getItem(LS_TIMEMARK) || '0', 10) || 0 } catch { /* unreadable */ }
  const today = Math.max(now, seen)
  if (today > seen) { try { localStorage.setItem(LS_TIMEMARK, String(today)) } catch { /* best effort */ } }
  return today
}

/**
 * Verify a licence key — returns the payload or throws a user-actionable reason.
 * 🛑 The email binding is checked by the CALLER (activate/readStatus), not here.
 */
export async function verifyKey(key: string): Promise<Payload> {
  const raw = clean(key)
  if (!raw) throw new Error('Enter your licence key.')

  let decoded: Uint8Array
  try { decoded = b32decode(raw) } catch { throw new Error('That does not look like a licence key.') }
  if (decoded.length < 80) throw new Error('That licence key is incomplete.') // [64 sig][json]
  const sig = decoded.subarray(0, 64)
  const body = decoded.subarray(64)

  let ok = false
  try { ok = await ed.verifyAsync(sig, body, PUBKEY) } catch { ok = false }
  if (!ok) throw new Error('That licence key is not valid.')

  let payload: Payload
  try { payload = JSON.parse(new TextDecoder().decode(body)) } catch { throw new Error('That licence key is not valid.') }
  if (payload.p !== 'pro') throw new Error('That licence key is not a Pro licence.')
  if (!payload.e) throw new Error('That licence key is not bound to an account.')
  return payload
}

/** Does `payload.e` match `accountEmail` (plaintext) or its sha256[:32] hash? */
async function bindingOk(payload: Payload, accountEmail: string): Promise<boolean> {
  const bound = String(payload.e).toLowerCase().trim()
  const actual = String(accountEmail || '').toLowerCase().trim()
  if (!actual) return false
  if (bound === actual) return true
  return bound === (await sha256hex(actual)).slice(0, 32)
}

/** Compute entitlement from a verified payload + the bound email. Faithful to license.ts status(). */
function statusFor(payload: Payload): LicenseStatus {
  const base: LicenseStatus = { plan: 'pro', licensedTo: payload.e, issued: payload.i, order: payload.o }
  if (!payload.x) return base // perpetual — nothing to expire

  const until = parseDay(payload.x)
  if (until === null) return { plan: 'basic', lapsed: true } // unparseable → fail closed

  const today = effectiveToday()
  const graceDaysLeft = until + GRACE_DAYS - today
  if (today <= until) return { ...base, accessThrough: payload.x, renewsOn: payload.b, graceDaysLeft }
  if (graceDaysLeft >= 0) return { ...base, accessThrough: payload.x, renewsOn: payload.b, inGrace: true, graceDaysLeft }
  return { plan: 'basic', licensedTo: payload.e, accessThrough: payload.x, renewsOn: payload.b, lapsed: true, graceDaysLeft }
}

// ── stored-license lifecycle ─────────────────────────────────────────────────────
function readStored(): { key: string; email: string } | null {
  try {
    const raw = localStorage.getItem(LS_LICENSE)
    if (!raw) return null
    const o = JSON.parse(raw)
    return o && o.key ? { key: String(o.key), email: String(o.email || '') } : null
  } catch { return null }
}

/** Activate: verify the key, confirm it's bound to `email`, store both. Throws on any failure. */
export async function activateLicense(key: string, email: string): Promise<LicenseStatus> {
  const payload = await verifyKey(key)
  if (!(await bindingOk(payload, email))) {
    throw new Error(`That licence is registered to a different account (${payload.e}).`)
  }
  try { localStorage.setItem(LS_LICENSE, JSON.stringify({ key: clean(key), email: String(email || '').toLowerCase().trim() })) }
  catch { throw new Error('Could not save the licence on this device.') }
  return statusFor(payload)
}

/** Current entitlement from the stored license. Any doubt → basic. */
export async function readLicenseStatus(): Promise<LicenseStatus> {
  const stored = readStored()
  if (!stored) return { plan: 'basic' }
  try {
    const payload = await verifyKey(stored.key)
    // Re-check the binding on every read (a stored key must still match its stored email).
    if (!(await bindingOk(payload, stored.email))) return { plan: 'basic' }
    return statusFor(payload)
  } catch { return { plan: 'basic' } }
}

export function deactivateLicense(): void {
  try { localStorage.removeItem(LS_LICENSE) } catch { /* best effort */ }
}
