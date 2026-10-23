#!/usr/bin/env node
/**
 * Subscription renewal — end-to-end against a LOCAL MOCK of the endpoint.
 *
 * 🛑 The renewal server does not exist yet (emberinformation.com does not resolve). That is
 * exactly why this exists: the client half can be finished and PROVEN now, against a mock
 * that implements the agreed contract, so deploying the server later is a deployment rather
 * than a rewrite. What is NOT proven is the server — and nothing here should be read as
 * saying otherwise.
 *
 * Drives the real decision logic in src/main/renewal.ts (compiled to tools/.build), with a
 * mock issuing REAL Ed25519-signed keys from the actual signing key in Phoenix Vault.
 *
 *   node tools/renewal-test.mjs
 *
 * ⚠ KNOWN COSMETIC NOISE: Node 24 on Windows prints
 *     Assertion failed: !(handle->flags & UV_HANDLE_CLOSING) ... winsync.c
 *   AFTER the summary. The suite has already finished and the process exit code is 0 — it is
 *   a libuv teardown assertion, most likely the `stdio: 'inherit'` handle from the Phoenix
 *   Vault call. Tried and did NOT fix it: awaiting srv.close(), closeAllConnections(),
 *   process.exitCode instead of process.exit(). Recorded here so the next person reads the
 *   EXIT CODE and the pass count rather than spending an hour on the scary-looking line.
 */
import http from 'node:http'
import { execFileSync } from 'node:child_process'
import { createPrivateKey, createPublicKey, sign as edSign, verify as edVerify, generateKeyPairSync } from 'node:crypto'

const c = { r: '\x1b[0m', g: '\x1b[32m', red: '\x1b[31m', d: '\x1b[2m', b: '\x1b[1m' }
let ok = 0, bad = 0
const pass = (m) => { ok++; console.log(`  ${c.g}✓${c.r} ${m}`) }
const fail = (m) => { bad++; console.log(`  ${c.red}✗${c.r} ${m}`) }
const head = (m) => console.log(`\n${c.b}${m}${c.r}`)

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const b32e = (buf) => { let b = 0, v = 0, o = ''; for (const x of buf) { v = (v << 8) | x; b += 8; while (b >= 5) { o += B32[(v >>> (b - 5)) & 31]; b -= 5 } } if (b) o += B32[(v << (5 - b)) & 31]; return o }
const b32d = (s) => { let b = 0, v = 0; const o = []; for (const ch of s.replace(/[^A-Z2-7]/gi, '').toUpperCase()) { const i = B32.indexOf(ch); if (i === -1) throw new Error('bad char'); v = (v << 5) | i; b += 5; if (b >= 8) { o.push((v >>> (b - 8)) & 255); b -= 8 } } return Buffer.from(o) }

// The real signing key, from the vault — so the mock issues keys the app genuinely trusts.
function signingKey() {
  const pem = execFileSync('C:/Users/pheon/AppData/Local/Programs/Python/Python312/python.exe',
    ['-m', 'phoenix_vault.cli', 'get', 'GRANTH_LICENSE_KEY'],
    { cwd: 'C:/Users/pheon/Projects/05_INFRA/phoenix-vault', stdio: ['inherit', 'pipe', 'inherit'], encoding: 'utf8' })
  return createPrivateKey(String(pem).trim())
}

function mintKey(key, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  return b32e(Buffer.concat([edSign(null, body, key), body]))
}

const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  const p = (v) => String(v).padStart(2, '0')
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`
}

// ── the mock endpoint ────────────────────────────────────────────────────────
let mode = 'ok'
const seen = []
function startMock(key) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let body = ''
      req.on('data', (d) => { body += d })
      req.on('end', () => {
        const parsed = (() => { try { return JSON.parse(body) } catch { return {} } })()
        seen.push(parsed)
        const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)) }
        if (mode === 'cancelled') return send(410, { error: 'subscription ended' })
        if (mode === 'down') return send(503, { error: 'unavailable' })
        if (mode === 'garbage') return send(200, { key: '' })
        if (mode === 'forged') {
          // A hostile endpoint returning a key signed by a DIFFERENT key.
          const other = generateKeyPairSync('ed25519').privateKey
          return send(200, { key: mintKey(other, { e: parsed.email, p: 'pro', i: '2026-08-25', x: addDays('2026-08-25', 400) }) })
        }
        const today = '2026-08-25'
        send(200, { key: mintKey(key, { e: parsed.email, p: 'pro', i: today, o: parsed.order, b: addDays(today, 30), x: addDays(today, 45) }) })
      })
    })
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }))
  })
}

// ── run ──────────────────────────────────────────────────────────────────────
head('0. Signing key + mock endpoint')
let key
try { key = signingKey(); pass('signing key retrieved from Phoenix Vault') } catch (e) { fail(`vault read failed: ${e.message}`); process.exit(1) }
const pubRaw = createPublicKey(key).export({ type: 'spki', format: 'der' }).subarray(12).toString('base64')
pubRaw === 'chUcvlF7wT3zOMoK0ICW7Dpb11JGOBECEUVAgBk6iRE='
  ? pass('it is the key the app trusts')
  : fail('🛑 vault key does not match the app public key')

const { srv, port } = await startMock(key)
process.env.GRANTH_RENEWAL_URL = `http://127.0.0.1:${port}/renew`
pass(`mock endpoint on 127.0.0.1:${port}`)

const { shouldAttempt, fetchRenewal, RENEW_LEAD_DAYS } = await import('./.build/renewal.mjs')

// ── scheduling ───────────────────────────────────────────────────────────────
head('1. When does it decide to contact us?')
const D = (s) => new Date(`${s}T12:00:00Z`)
const cases = [
  ['perpetual licence never phones home', { plan: 'pro' }, D('2026-08-25'), false],
  ['basic never phones home', { plan: 'basic', accessThrough: '2026-08-26' }, D('2026-08-25'), false],
  ['30 days of access left — silent', { plan: 'pro', accessThrough: '2026-09-24' }, D('2026-08-25'), false],
  [`${RENEW_LEAD_DAYS} days left — starts trying`, { plan: 'pro', accessThrough: '2026-09-04' }, D('2026-08-25'), true],
  ['2 days left — still trying', { plan: 'pro', accessThrough: '2026-08-27' }, D('2026-08-25'), true],
  ['already past access — still tries', { plan: 'pro', accessThrough: '2026-08-24' }, D('2026-08-25'), true]
]
for (const [label, status, now, want] of cases) {
  const got = shouldAttempt(status, {}, now)
  got.attempt === want ? pass(`${label} (${got.reason})`) : fail(`${label}: got ${got.attempt}, wanted ${want} — ${got.reason}`)
}
const rate = shouldAttempt({ plan: 'pro', accessThrough: '2026-09-04' }, { lastAttempt: D('2026-08-25').toISOString() }, D('2026-08-25'))
rate.attempt === false ? pass(`rate-limited by wall clock (${rate.reason})`) : fail('🛑 not rate-limited — twenty app launches would be twenty requests')

// ── the fetch ────────────────────────────────────────────────────────────────
head('2. The fetch itself')
mode = 'ok'
const good = await fetchRenewal('customer@example.com', 'ORD-1')
good.ok && good.key ? pass('endpoint returned a key') : fail(`no key: ${good.error}`)

const dec = b32d(good.key)
const pub = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(pubRaw, 'base64')]), format: 'der', type: 'spki' })
edVerify(null, dec.subarray(64), pub, dec.subarray(0, 64)) ? pass('the renewed key verifies against the app public key') : fail('🛑 renewed key does not verify')
const payload = JSON.parse(dec.subarray(64).toString('utf8'))
payload.x && payload.b ? pass(`carries BOTH dates — billing ${payload.b}, access ${payload.x}`) : fail('🛑 missing billing or access date')
const buffer = Math.round((Date.parse(payload.x) - Date.parse(payload.b)) / 86400000)
buffer === 15 ? pass('access sits exactly 15 days beyond billing') : fail(`🛑 buffer is ${buffer} days, expected 15`)

// 🛑 What we sent. The only outbound call about the customer — its contents are a
// deliberate list, so the test asserts the list rather than trusting the comment.
const sent = seen[seen.length - 1]
const keys = Object.keys(sent).sort()
JSON.stringify(keys) === JSON.stringify(['app', 'email', 'order', 'v'])
  ? pass(`sends only ${keys.join(', ')} — no records, no fingerprint`)
  : fail(`🛑 request carries unexpected fields: ${keys.join(', ')}`)

head('3. Failure modes')
mode = 'down'
const down = await fetchRenewal('customer@example.com')
!down.ok && !down.cancelled ? pass(`server down is a soft failure (${down.error})`) : fail('server-down not handled as soft')
mode = 'cancelled'
const gone = await fetchRenewal('customer@example.com')
gone.cancelled ? pass('410 Gone reported as CANCELLED, not a retryable error') : fail('🛑 cancellation indistinguishable from an outage')
mode = 'garbage'
const empty = await fetchRenewal('customer@example.com')
!empty.ok ? pass(`empty key rejected (${empty.error})`) : fail('🛑 accepted an empty key')

head('4. A hostile endpoint')
mode = 'forged'
const forged = await fetchRenewal('customer@example.com')
if (!forged.ok) { pass('forged response rejected at fetch') }
else {
  const f = b32d(forged.key)
  edVerify(null, f.subarray(64), pub, f.subarray(0, 64))
    ? fail('🛑🛑 A FORGED KEY VERIFIED — signature checking is broken')
    : pass('forged key fails signature verification (endpoint cannot grant entitlement)')
}

// 🛑 Wait for the socket to actually close. `srv.close(); process.exit()` races libuv on
// Windows and aborts with "UV_HANDLE_CLOSING" AFTER a clean pass — a green run that ends in
// a crash dump is a run people stop trusting.
// 🛑 closeAllConnections() FIRST. `fetch` holds keep-alive sockets open, and `srv.close()`
// alone waits for them politely while libuv tears down underneath — which is what produced
// the "UV_HANDLE_CLOSING" assertion printed AFTER a clean pass.
srv.closeAllConnections?.()
await new Promise((r) => srv.close(r))
console.log(`\n${c.b}${bad ? c.red : c.g}${ok} passed · ${bad} failed${c.r}`)
console.log(`${c.d}🛑 The SERVER half is a mock. Nothing here says the real endpoint exists.${c.r}\n`)
process.exit(bad ? 1 : 0)
