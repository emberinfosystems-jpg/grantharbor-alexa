#!/usr/bin/env node
/**
 * GrantHarbor — Ebony smoke test.
 * ─────────────────────────────────────────────────────────────────────────────
 * The security/claims half of the ship gate ([[feedback_beta_ebony_gate]]): exercise the
 * things that would actually hurt a paying customer, then — if Ebony is reachable at :8000 —
 * ask her to review what was found.
 *
 * Follows the pattern set by horizon/scripts/ebony-test.js: the deterministic checks are the
 * gate, and the AI review is a bonus that must NEVER be load-bearing. Ebony offline is a
 * skip, not a failure — a gate that only passes when a 9GB model happens to be resident is
 * a gate nobody can run.
 *
 *   node tools/ebony-test.mjs              full run
 *   node tools/ebony-test.mjs --no-ebony   deterministic checks only
 *
 * 🛑 Every account this creates is @example.com and is DELETED before exit, pass or fail.
 */
import http from 'node:http'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createPublicKey, verify as edVerify } from 'node:crypto'

const PB = 'http://127.0.0.1:8090'
const EBONY = 'http://127.0.0.1:8000'
const APP = join(import.meta.dirname, '..')
const DO_EBONY = !process.argv.includes('--no-ebony')
const TS = Date.now()

const c = { r: '\x1b[0m', g: '\x1b[32m', red: '\x1b[31m', y: '\x1b[33m', cy: '\x1b[36m', b: '\x1b[1m', d: '\x1b[2m', o: '\x1b[38;5;214m' }
let passed = 0, failed = 0, skipped = 0
const findings = []
const pass = (m) => { passed++; console.log(`  ${c.g}✓${c.r} ${m}`) }
const fail = (m) => { failed++; findings.push(m); console.log(`  ${c.red}✗${c.r} ${m}`) }
const warn = (m) => { findings.push(m); console.log(`  ${c.y}!${c.r} ${m}`) }
const skip = (m) => { skipped++; console.log(`  ${c.d}— ${m} (skipped)${c.r}`) }
const head = (m) => console.log(`\n${c.b}${c.cy}${m}${c.r}`)

function req(url, { method = 'GET', body, token } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const payload = body ? JSON.stringify(body) : null
    const r = http.request({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search, method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(token ? { Authorization: token } : {})
      }
    }, (res) => {
      let d = ''
      res.on('data', (x) => { d += x })
      res.on('end', () => { try { resolve({ status: res.statusCode, body: d ? JSON.parse(d) : {} }) } catch { resolve({ status: res.statusCode, body: d }) } })
    })
    r.on('error', reject)
    r.setTimeout(8000, () => { r.destroy(); reject(new Error('timeout')) })
    if (payload) r.write(payload)
    r.end()
  })
}

const created = []
async function makeUser(tag) {
  const email = `ebony-${tag}-${TS}@example.com`
  const password = 'EbonySmokeTest!9'
  const r = await req(`${PB}/api/collections/users/records`, { method: 'POST', body: { email, password, passwordConfirm: password } })
  if (r.status !== 200) throw new Error(`could not create ${email}: ${JSON.stringify(r.body).slice(0, 160)}`)
  const a = await req(`${PB}/api/collections/users/auth-with-password`, { method: 'POST', body: { identity: email, password } })
  created.push({ id: a.body.record.id, token: a.body.token, email })
  return { id: a.body.record.id, token: a.body.token, email }
}
async function cleanup() {
  for (const u of created) {
    try { await req(`${PB}/api/collections/users/records/${u.id}`, { method: 'DELETE', token: u.token }) } catch { /* best effort */ }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
async function checkBackend() {
  head('1. Backend')
  try {
    const h = await req(`${PB}/api/health`)
    h.status === 200 ? pass('PocketBase healthy on 127.0.0.1:8090') : fail(`PocketBase health returned ${h.status}`)
  } catch {
    fail('PocketBase unreachable — start GrantHarbor first')
    return false
  }
  // 🛑 LOCAL ONLY. Legal.tsx publishes localFirst:true; a backend listening on 0.0.0.0
  // would put a business's grant records on the LAN and make that claim false.
  try {
    const nets = execFileSync('powershell.exe', ['-NoProfile', '-Command',
      "(Get-NetTCPConnection -State Listen -LocalPort 8090 | Select-Object -ExpandProperty LocalAddress) -join ','"],
      { encoding: 'utf8' }).trim()
    const loopbackOnly = /^(127\.0\.0\.1|::1)(,(127\.0\.0\.1|::1))*$/.test(nets)
    if (loopbackOnly) pass(`bound to loopback only (${nets})`)
    else fail(`🛑 listening beyond loopback (${nets}) — contradicts localFirst:true`)
  } catch { skip('could not enumerate listeners') }
  return true
}

async function checkRls() {
  head('2. Owner-scoped RLS (the thing that keeps one machine safe for real client data)')
  let a, b
  try { a = await makeUser('a'); b = await makeUser('b') } catch (e) { fail(String(e.message)); return }
  pass('created two throwaway accounts')

  const g = await req(`${PB}/api/collections/grants/records`, {
    method: 'POST', token: a.token,
    body: { title: 'EBONY PROBE — A private grant', description: 'x', funding_amount: 1, deadline: '2027-01-01', source_agency: 'probe', categories: [], status: 'New', created_by: a.id }
  })
  if (g.status !== 200) { fail(`account A could not create its own record (${g.status})`); return }
  pass('account A created a grant')

  // 🛑 THE test. If B can read A's row, one local install is unsafe for a real business.
  const asB = await req(`${PB}/api/collections/grants/records?perPage=200`, { token: b.token })
  const leaked = (asB.body.items || []).some((r) => r.id === g.body.id)
  leaked ? fail("🛑 ACCOUNT B CAN READ ACCOUNT A'S GRANT — RLS not enforcing owner scope")
         : pass("account B cannot see account A's grant")

  const upd = await req(`${PB}/api/collections/grants/records/${g.body.id}`, { method: 'PATCH', token: b.token, body: { title: 'hijacked' } })
  upd.status === 200 ? fail("🛑 ACCOUNT B EDITED ACCOUNT A'S GRANT") : pass(`account B cannot edit it (${upd.status})`)

  const del = await req(`${PB}/api/collections/grants/records/${g.body.id}`, { method: 'DELETE', token: b.token })
  del.status === 204 ? fail("🛑 ACCOUNT B DELETED ACCOUNT A'S GRANT") : pass(`account B cannot delete it (${del.status})`)

  const anon = await req(`${PB}/api/collections/grants/records?perPage=200`)
  ;(anon.body.items || []).length > 0 ? fail(`🛑 UNAUTHENTICATED read returned ${anon.body.items.length} grants`) : pass('unauthenticated read returns nothing')

  try { await req(`${PB}/api/collections/grants/records/${g.body.id}`, { method: 'DELETE', token: a.token }) } catch { /* cleaned with the user anyway */ }
}

function checkLicence() {
  head('3. Licence integrity')
  const src = readFileSync(join(APP, 'src/main/license.ts'), 'utf8')
  const m = /LICENSE_PUBLIC_KEY = '([^']+)'/.exec(src)
  if (!m) { fail('could not find LICENSE_PUBLIC_KEY'); return }
  pass('public key present in source')

  if (/BEGIN PRIVATE KEY|PRIVATE KEY-----/.test(src)) fail('🛑 private key material in license.ts')
  else pass('no private key material in license.ts')

  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const b32d = (s) => { let b = 0, v = 0; const o = []; for (const ch of s.replace(/[^A-Z2-7]/gi, '').toUpperCase()) { const i = B32.indexOf(ch); if (i === -1) throw new Error('bad'); v = (v << 5) | i; b += 5; if (b >= 8) { o.push((v >>> (b - 8)) & 255); b -= 8 } } return Buffer.from(o) }
  const der = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(m[1], 'base64')])
  const pub = createPublicKey({ key: der, format: 'der', type: 'spki' })

  let real
  try {
    const out = execFileSync(process.execPath, [join(APP, 'tools/issue-license.mjs'), `ebony-probe-${TS}@example.com`, 'EBONY-SMOKE'], { encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] })
    real = out.trim().split('\n').pop().trim()
  } catch (e) {
    skip(`could not mint a probe licence (${String(e.message).split('\n')[0]})`)
    return
  }
  const dec = b32d(real)
  edVerify(null, dec.subarray(64), pub, dec.subarray(0, 64))
    ? pass('a freshly minted licence verifies against the shipped public key')
    : fail('🛑 minted licence does NOT verify — signing key and app key disagree')

  // 🛑 Forgery must fail. A licence system that accepts edited keys is decoration.
  const t = Buffer.from(dec); t[t.length - 2] ^= 0x01
  edVerify(null, t.subarray(64), pub, t.subarray(0, 64)) ? fail('🛑 TAMPERED licence ACCEPTED') : pass('tampered licence rejected')

  const payload = JSON.parse(dec.subarray(64).toString('utf8'))
  payload.e ? pass(`licence is bound to an account (${payload.e})`) : fail('🛑 licence carries no email binding — freely shareable')
}

function checkBundle() {
  head('4. What actually ships to a customer')
  const appDir = join(APP, 'dist/GrantHarbor-win32-x64/resources/app')
  if (!existsSync(appDir)) { skip('no packaged build found — run npm run package'); return }

  const walk = (d, acc = []) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p, acc); else acc.push(p) } return acc }
  const files = walk(appDir)
  pass(`packaged app contains ${files.length} files`)

  const leaks = files.filter((f) => /issue-license|keygen\.mjs/.test(f))
  leaks.length ? fail(`🛑 licence MINTING tools ship to customers: ${leaks.map((f) => f.split(/[\\/]/).pop()).join(', ')}`)
               : pass('no licence-minting tooling in the bundle')

  const keyed = files.filter((f) => { try { return /BEGIN (RSA |EC )?PRIVATE KEY/.test(readFileSync(f, 'utf8')) } catch { return false } })
  keyed.length ? fail(`🛑 PRIVATE KEY MATERIAL in the bundle: ${keyed.join(', ')}`) : pass('no private key material in the bundle')

  const junk = files.filter((f) => /BUILD_PLAN|\.log|dev_pid|tsconfig|\.env$/.test(f))
  junk.length ? warn(`internal build files ship: ${junk.map((f) => f.split(/[\\/]/).pop()).join(', ')}`) : pass('no build scaffolding in the bundle')
}

function checkSecrets() {
  head('5. Secrets & recovery')
  const plaintext = 'C:/Users/pheon/Documents/02_PHOENIX_VDR/09_KEYS_GRANTHARBOR/granth-license-private.pem'
  existsSync(plaintext) ? fail('🛑 plaintext signing key still on disk') : pass('no plaintext signing key on disk')

  const auth = readFileSync(join(APP, 'src/main/auth.ts'), 'utf8')
  const hashed = /scryptSync/.test(auth)
  if (hashed) pass('recovery codes are hashed (scrypt), never stored plainly')
  else fail('🛑 recovery codes may be stored in plaintext')
  const constTime = /timingSafeEqual/.test(auth)
  if (constTime) pass('recovery code compared in constant time')
  else warn('recovery code comparison is not constant-time')
  const osEnc = /safeStorage/.test(auth)
  if (osEnc) pass('local superuser credential is OS-encrypted (DPAPI)')
  else fail('🛑 recovery credential not OS-encrypted')

  // 🛑 STRIP COMMENTS BEFORE SCANNING. First run of this check FAILED on GrantHarbor —
  // and the thing it matched was preload's own comment, "no generic `invoke(channel, …)`
  // passthrough", i.e. the sentence documenting that the hole does not exist. A checker
  // that reads prose as code manufactures findings, and a gate that cries wolf gets
  // ignored on the day it is right. (Same bug the subprocessor oracle had: it flagged its
  // own warning text as a Stripe disclosure.)
  const preloadRaw = readFileSync(join(APP, 'src/preload/index.ts'), 'utf8')
  const preload = preloadRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  // A real passthrough forwards a VARIABLE as the channel. Literal-string channels are the
  // safe form, so require a bare identifier — not a quote — in the first argument.
  const genericIpc = /ipcRenderer\.invoke\(\s*(?!['"`])[A-Za-z_$]/.test(preload)
  if (genericIpc) fail('🛑 preload exposes a GENERIC ipc invoke — any channel reachable from the renderer')
  else {
    const channels = [...preloadRaw.matchAll(/ipcRenderer\.invoke\(\s*'([^']+)'/g)].map((m) => m[1])
    pass(`preload IPC surface is narrow and fixed (${channels.length} named channels, no passthrough)`)
  }
}

async function askEbony() {
  head('6. Ebony review')
  if (!DO_EBONY) { skip('--no-ebony'); return }
  let online = false
  try { const r = await req(`${EBONY}/session`, { method: 'POST', body: { id: `gh-ebony-${TS}` } }); online = r.status === 200 || r.status === 201 } catch { /* offline */ }
  if (!online) {
    skip('Ebony not reachable at :8000 — start holly-desktop to enable the AI review')
    console.log(`  ${c.d}(non-fatal by design: the deterministic checks above are the gate)${c.r}`)
    return
  }
  pass('Ebony online at :8000')
  const sid = `gh-ebony-${TS}`
  const summary = findings.length ? findings.map((f) => `- ${f}`).join('\n') : '- none'
  const r = await req(`${EBONY}/chat`, {
    method: 'POST',
    body: {
      session_id: sid,
      message: `You are Ebony, the enterprise build of Holly, reviewing GrantHarbor — a local-first Electron grant-tracking app by Ember Information Systems, about to be sold to small businesses and nonprofits.\n\nAutomated smoke test: ${passed} passed, ${failed} failed, ${skipped} skipped.\nFindings:\n${summary}\n\nIt stores business data (incl. EIN) in a local PocketBase with owner-scoped RLS; licences are Ed25519-signed and email-bound; password recovery is an offline scrypt-hashed recovery code; the ingestion agent fetches the public Grants.gov corpus and matches on-device so no user data is transmitted.\n\nGive a direct professional review: the 3 biggest remaining risks before it is sold to a paying customer. Be blunt. 5 bullets max.`
    }
  })
  const text = r.body?.response || r.body?.message || ''
  if (!text) { warn(`Ebony returned no review (status ${r.status})`); return }
  console.log(`\n${c.o}┌─ Ebony's review ─────────────────────────────────────────${c.r}`)
  String(text).split('\n').forEach((l) => console.log(`${c.o}│${c.r} ${l}`))
  console.log(`${c.o}└──────────────────────────────────────────────────────────${c.r}`)
  pass('Ebony review completed')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(`${c.b}GrantHarbor — Ebony smoke test${c.r}  ${c.d}${new Date().toISOString()}${c.r}`)
let up = false
try {
  up = await checkBackend()
  if (up) await checkRls()
  else skip('RLS checks need the backend')
  checkLicence()
  checkBundle()
  checkSecrets()
  await askEbony()
} finally {
  await cleanup()
  console.log(`\n${c.d}cleaned up ${created.length} throwaway account(s)${c.r}`)
}

console.log(`\n${c.b}${failed ? c.red : c.g}${passed} passed · ${failed} failed · ${skipped} skipped${c.r}`)
process.exit(failed ? 1 : 0)
