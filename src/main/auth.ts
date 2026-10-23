/**
 * Offline account recovery for GrantHarbor.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🛑 WHY THIS EXISTS, AND WHY IT IS NOT EMAIL
 *
 * Verified 2026-08-25: the shipped `pb_template` has `smtp.enabled = false` and the
 * placeholder host `smtp.example.com`. PocketBase answers request-password-reset with **204
 * regardless of whether the address exists** — so the app showed "Check your email for a
 * reset link" and no email was ever sent, to anyone. Worse, the data dir had **no superuser
 * at all**, meaning a forgotten password locked the owner out of their own business records
 * permanently, with no path back.
 *
 * Email is also the wrong mechanism for this app. GrantHarbor is local-first: the database is
 * a file on the user's machine. Routing a token through a mail server, on the internet, to
 * unlock a local file is backwards — it makes an offline app depend on being online, and it
 * hands a third party a signal about the user.
 *
 * So recovery is a RECOVERY CODE, generated on this machine, verified on this machine.
 *
 * 🛑 THE SECURITY IS HONEST ABOUT WHAT IT PROTECTS. `pb_data/data.db` is plaintext SQLite:
 * anyone holding that file already has the records, password or not. The account password
 * guards the app on a shared computer, not the data at rest. A local reset therefore gives
 * up nothing that was actually being protected — but it still demands the recovery code,
 * so simply sitting down at an unlocked machine is not enough to take over the account.
 *
 * The code is stored as a scrypt hash, never in plaintext. Losing it is not catastrophic:
 * a signed-in user can generate a new one from Settings at any time.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { app, safeStorage } from 'electron'
import { execFileSync } from 'child_process'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const PB_URL = 'http://127.0.0.1:8090'
const SU_EMAIL = 'local-recovery@grantharbor.invalid'

/** Where the encrypted superuser password lives. Never written in plaintext. */
function credPath(): string {
  return join(app.getPath('userData'), '.recovery-cred')
}

/**
 * 🛑 safeStorage is DPAPI-backed on Windows: the ciphertext is bound to the OS user account,
 * so copying this file to another machine yields nothing. If the platform cannot encrypt we
 * REFUSE to fall back to plaintext — an unprotected superuser password sitting in AppData is
 * a worse failure than having no recovery at all, and it would be invisible to the user.
 */
function saveCred(password: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS encryption unavailable — refusing to store a recovery credential in plaintext.')
  }
  writeFileSync(credPath(), safeStorage.encryptString(password))
}

function loadCred(): string | null {
  const p = credPath()
  if (!existsSync(p) || !safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(readFileSync(p))
  } catch {
    return null // re-provisioned below
  }
}

/**
 * Ensure a local superuser exists so the app can reset its own user's password.
 *
 * 🛑 MUST be called BEFORE the serve process starts. `superuser upsert` opens the SQLite
 * file directly; doing that while PocketBase is serving means two writers on one database.
 */
export function ensureSuperuser(pbBin: string, dataDir: string): void {
  if (loadCred()) return
  // 32 bytes of base64url — well past PocketBase's minimum, no shell-quoting hazards.
  const password = randomBytes(24).toString('base64url')
  execFileSync(pbBin, ['superuser', 'upsert', SU_EMAIL, password, '--dir', dataDir], {
    stdio: 'ignore',
    windowsHide: true
  })
  saveCred(password)
}

async function suToken(): Promise<string> {
  const password = loadCred()
  if (!password) throw new Error('No local recovery credential is provisioned.')
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: SU_EMAIL, password })
  })
  if (!res.ok) throw new Error('Local recovery credential was rejected.')
  return (await res.json()).token
}

async function su(path: string, init: RequestInit = {}): Promise<any> {
  const token = await suToken()
  const res = await fetch(`${PB_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: token, ...(init.headers || {}) }
  })
  const body = res.status === 204 ? {} : await res.json().catch(() => ({}))
  if (!res.ok) {
    // Surface PocketBase's per-field detail, same reasoning as db.ts `explained()`.
    const data = body?.data && typeof body.data === 'object' ? body.data : null
    const detail = data
      ? Object.entries(data).map(([f, i]: [string, any]) => `${f}: ${i?.message || i?.code}`).join(' · ')
      : body?.message || `HTTP ${res.status}`
    throw new Error(detail)
  }
  return body
}

/**
 * Add the `recovery_hash` field to the users collection if it is not already there.
 * Idempotent, and applied at runtime rather than baked into pb_template so that installs
 * created BEFORE this feature existed also gain recovery instead of staying stranded.
 */
export async function ensureRecoveryField(): Promise<void> {
  const cols = await su('/api/collections?perPage=200')
  const users = (cols.items || []).find((c: any) => c.name === 'users')
  if (!users) throw new Error('users collection not found')
  if ((users.fields || []).some((f: any) => f.name === 'recovery_hash')) return

  await su(`/api/collections/${users.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: [
        ...users.fields,
        // `hidden` keeps the hash out of every API response, including the user's own
        // record — there is no reason for the renderer to ever see it.
        { name: 'recovery_hash', type: 'text', required: false, hidden: true, max: 400 }
      ]
    })
  })
}

// ── recovery codes ───────────────────────────────────────────────────────────

/** Ambiguous characters removed: no 0/O, 1/I/L. These get read off paper and retyped. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function generateCode(): string {
  const raw = randomBytes(20)
  let out = ''
  for (let i = 0; i < 20; i++) {
    out += ALPHABET[raw[i] % ALPHABET.length]
    if (i % 5 === 4 && i !== 19) out += '-'
  }
  return out // XXXXX-XXXXX-XXXXX-XXXXX
}

export function normalizeCode(input: string): string {
  return String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function hashCode(code: string, salt: string): string {
  return `${salt}:${scryptSync(normalizeCode(code), salt, 32).toString('hex')}`
}

function verifyCode(code: string, stored: string): boolean {
  const [salt, expected] = String(stored || '').split(':')
  if (!salt || !expected) return false
  const actual = scryptSync(normalizeCode(code), salt, 32).toString('hex')
  const a = Buffer.from(actual, 'hex')
  const b = Buffer.from(expected, 'hex')
  // Length check first — timingSafeEqual throws on a mismatch rather than returning false.
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Generate a fresh recovery code for a user, store its hash, return the plaintext ONCE. */
export async function issueRecoveryCode(userId: string): Promise<string> {
  await ensureRecoveryField()
  const code = generateCode()
  await su(`/api/collections/users/records/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ recovery_hash: hashCode(code, randomBytes(16).toString('hex')) })
  })
  return code
}

/**
 * Reset a password using the recovery code. Runs entirely offline.
 *
 * 🛑 Every failure returns the SAME message. Distinguishing "no such account" from "wrong
 * code" would turn this into an oracle for which email addresses exist on the machine, and
 * the user gains nothing from the distinction — they must produce a valid pair either way.
 */
export async function resetWithRecoveryCode(
  email: string,
  code: string,
  newPassword: string
): Promise<{ ok: true }> {
  const GENERIC = 'That email and recovery code do not match an account on this computer.'
  if (String(newPassword || '').length < 8) {
    throw new Error('Password must be at least 8 characters.')
  }
  await ensureRecoveryField()

  const clean = String(email || '').trim().replace(/"/g, '')
  const found = await su(`/api/collections/users/records?perPage=1&filter=${encodeURIComponent(`email="${clean}"`)}&fields=id,recovery_hash`)
  const user = (found.items || [])[0]
  if (!user || !user.recovery_hash || !verifyCode(code, user.recovery_hash)) {
    throw new Error(GENERIC)
  }

  await su(`/api/collections/users/records/${user.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ password: newPassword, passwordConfirm: newPassword })
  })
  // 🛑 Burn the code. A recovery code that still works after use is a permanent spare key
  // to the account, sitting in whatever note or drawer the user left it in.
  await su(`/api/collections/users/records/${user.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ recovery_hash: '' })
  })
  return { ok: true }
}

/** True when this install has a usable local recovery credential. */
export function recoveryAvailable(): boolean {
  return safeStorage.isEncryptionAvailable() && !!loadCred()
}
