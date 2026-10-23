#!/usr/bin/env node
/**
 * End-to-end test of the data export.
 *
 * 🛑 The earlier check fed `buildExport()` hand-written objects. That proves the FORMATTER
 * works and nothing else — it cannot catch a field the database renames, a JSON column that
 * comes back as a string, or a column the export forgot. So this seeds a throwaway account
 * with realistic data, reads it back through the same REST API the app's store uses, and
 * exports THAT.
 *
 * The only thing not covered is the folder-picker dialog, which is Electron's.
 *
 *   node tools/export-test.mjs
 *
 * 🛑 The account is @example.com and is deleted before exit, pass or fail.
 */
import http from 'node:http'
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// 🛑 Compiled into tools/.build, NOT out/. `out/` IS the shipped bundle — putting test
// scaffolding there would ship it to every customer, which is precisely the leak that was
// cleaned out of the packager earlier today. Regenerate with:
//   npx tsc src/renderer/src/lib/exportData.ts src/renderer/src/lib/csvInjection.ts
//        --outDir tools/.build --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck
//   then rename the two .js to .mjs and point exportData's import at ./csvInjection.mjs
import { buildExport, exportSummary } from './.build/exportData.mjs'

const PB = 'http://127.0.0.1:8090'
const TS = Date.now()
const c = { r: '\x1b[0m', g: '\x1b[32m', red: '\x1b[31m', y: '\x1b[33m', d: '\x1b[2m', b: '\x1b[1m' }
let ok = 0, bad = 0
const pass = (m) => { ok++; console.log(`  ${c.g}✓${c.r} ${m}`) }
const fail = (m) => { bad++; console.log(`  ${c.red}✗${c.r} ${m}`) }

function req(path, { method = 'GET', body, token } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(PB + path)
    const p = body ? JSON.stringify(body) : null
    const r = http.request({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search, method,
      headers: { 'Content-Type': 'application/json', ...(p ? { 'Content-Length': Buffer.byteLength(p) } : {}), ...(token ? { Authorization: token } : {}) }
    }, (res) => {
      let d = ''
      res.on('data', (x) => { d += x })
      res.on('end', () => { try { resolve({ status: res.statusCode, body: d ? JSON.parse(d) : {} }) } catch { resolve({ status: res.statusCode, body: d }) } })
    })
    r.on('error', reject); r.setTimeout(10000, () => { r.destroy(); reject(new Error('timeout')) })
    if (p) r.write(p); r.end()
  })
}

// Realistic, and deliberately nasty where it counts.
const EMAIL = `export-test-${TS}@example.com`
const PASSWORD = 'ExportTest!2026'
const GRANTS = [
  // 🛑 Leading '=' — a real formula-injection attempt landing in a grant title.
  { title: '=HYPERLINK("http://evil","click me")', description: 'Injection probe', funding_amount: 125000, deadline: '2026-09-30', source_agency: 'HRSA', link_url: 'https://grants.gov/1', categories: ['Health', 'Rural'], status: 'New', notes: 'quote " and comma , inside' },
  { title: 'National Dam Safety Program', description: 'Multi-line\nsecond line', funding_amount: 7486000, deadline: '2026-09-02', source_agency: 'Department of Homeland Security', link_url: 'https://grants.gov/2', categories: ['Disaster Prevention'], status: 'Reviewed', notes: '' },
  { title: 'Zero-dollar award', description: '', funding_amount: 0, deadline: '2027-01-31', source_agency: 'NSF', link_url: '', categories: [], status: 'Applied', notes: 'unicode — é ü 漢字 🛑' }
]
const INVESTORS = [{ name: 'Redpoint Ventures', investor_type: 'venture_capital', focus_areas: ['Fintech', 'SaaS'], stage: 'Seed to B', typical_check_min: 250000, typical_check_max: 5000000, location: 'San Francisco, CA', website_url: 'https://redpoint.com', description: 'Fit: civic tech', is_active: true }]
const SENDERS = [{ email_or_domain: 'grants.gov', sender_type: 'domain', sender_name: 'Grants.gov', notes: '' }]
const PROFILES = [{ profile_name: 'Acme Robotics — Core', applicant_name: 'Jane Doe', email: 'jane@example.com', phone: '555-0100', business_name: 'Acme Robotics', business_type: 'LLC', ein: '12-3456789', industry: 'Manufacturing', annual_revenue: 480000, employees: 6, mission_statement: 'Build things', funding_needed: 250000, funding_purpose: 'Tooling' }]
const PREFS = { notify_in_app: true, notify_email: false, email_frequency: 'daily', preferred_categories: ['rural health', 'broadband'] }

let user = null
async function seed() {
  console.log(`\n${c.b}1. Seed a throwaway account with realistic data${c.r}`)
  const cr = await req('/api/collections/users/records', { method: 'POST', body: { email: EMAIL, password: PASSWORD, passwordConfirm: PASSWORD } })
  if (cr.status !== 200) throw new Error(`create user failed: ${JSON.stringify(cr.body).slice(0, 200)}`)
  const au = await req('/api/collections/users/auth-with-password', { method: 'POST', body: { identity: EMAIL, password: PASSWORD } })
  user = { id: au.body.record.id, token: au.body.token }
  pass(`account created (${EMAIL})`)

  const insert = async (coll, rows) => {
    for (const row of rows) {
      const r = await req(`/api/collections/${coll}/records`, { method: 'POST', token: user.token, body: { ...row, created_by: user.id } })
      if (r.status !== 200) throw new Error(`${coll} insert failed (${r.status}): ${JSON.stringify(r.body).slice(0, 200)}`)
    }
  }
  await insert('grants', GRANTS); pass(`${GRANTS.length} grants`)
  await insert('investors', INVESTORS); pass(`${INVESTORS.length} investor`)
  await insert('approved_senders', SENDERS); pass(`${SENDERS.length} approved sender`)
  await insert('application_profiles', PROFILES); pass(`${PROFILES.length} application profile`)
  await insert('user_preferences', [PREFS]); pass('preferences')
}

async function readBack() {
  console.log(`\n${c.b}2. Read it back the way the app's store does${c.r}`)
  const get = async (coll) => (await req(`/api/collections/${coll}/records?perPage=200`, { token: user.token })).body.items || []
  const data = {
    email: EMAIL,
    grants: await get('grants'),
    investors: await get('investors'),
    approvedSenders: await get('approved_senders'),
    profiles: await get('application_profiles'),
    preferences: (await get('user_preferences'))[0] ?? null
  }
  pass(`read back ${data.grants.length} grants, ${data.investors.length} investors, ${data.profiles.length} profiles`)
  // 🛑 The check the hand-written test could never make: does a JSON column survive the
  // round trip as an ARRAY, or come back as a string? If it is a string, every CSV cell
  // and the JSON export are both quietly wrong.
  const cats = data.grants.find((g) => g.categories?.length)?.categories
  Array.isArray(cats) ? pass(`JSON columns round-trip as arrays (${JSON.stringify(cats)})`)
                      : fail(`🛑 categories came back as ${typeof cats}: ${JSON.stringify(cats)}`)
  return data
}

function verify(data) {
  console.log(`\n${c.b}3. Export and inspect the actual files${c.r}`)
  const files = buildExport(data)
  const dir = mkdtempSync(join(tmpdir(), 'gh-export-'))
  for (const f of files) writeFileSync(join(dir, f.name), f.contents, 'utf8')
  const written = readdirSync(dir)
  pass(`wrote ${written.length} files: ${written.join(', ')}`)
  console.log(`  ${c.d}${exportSummary(files)}${c.r}`)

  // ── JSON ──
  const json = JSON.parse(readFileSync(join(dir, 'grantharbor-export.json'), 'utf8'))
  pass('JSON parses')
  const counts = json.counts
  counts.grants === GRANTS.length ? pass(`grants count matches (${counts.grants})`) : fail(`grants ${counts.grants} != ${GRANTS.length}`)
  counts.investors === 1 && counts.approved_senders === 1 && counts.application_profiles === 1 && counts.user_preferences === 1
    ? pass('every other table exported with the right count')
    : fail(`counts wrong: ${JSON.stringify(counts)}`)

  const g0 = json.data.grants.find((g) => g.title.startsWith('=HYPERLINK'))
  Array.isArray(g0.categories) ? pass('JSON preserves arrays (not flattened)') : fail('🛑 JSON flattened an array')
  const uni = json.data.grants.find((g) => (g.notes || '').includes('漢字'))
  uni ? pass('unicode survived (é ü 漢字 🛑)') : fail('🛑 unicode lost')

  // 🛑 THE EIN. If a full export omitted it the user could not actually take their
  // business identity elsewhere — and the policy says this is the complete record.
  json.data.application_profiles[0]?.ein === '12-3456789' ? pass('EIN present in the export') : fail('🛑 EIN missing from the export')

  // ── CSV ──
  const csv = readFileSync(join(dir, 'grants.csv'), 'utf8')
  const rows = csv.split('\r\n')
  const header = rows[0].split(',')
  header[0] === 'id' && header.includes('funding_amount') ? pass('grants.csv has a proper header') : fail(`bad header: ${rows[0].slice(0, 80)}`)

  // Numbers/dates unquoted — the bug found earlier today.
  const numeric = rows.find((r) => r.includes('7486000'))
  numeric && numeric.includes(',7486000,') ? pass('funding_amount exported as a NUMBER (no leading apostrophe)') : fail(`🛑 amount mangled: ${String(numeric).slice(0, 90)}`)
  const dated = rows.find((r) => r.includes('2026-09-02'))
  dated && dated.includes(',2026-09-02,') ? pass('deadline exported as a DATE (no leading apostrophe)') : fail(`🛑 date mangled: ${String(dated).slice(0, 90)}`)

  // Formula injection neutralised.
  const inj = rows.find((r) => r.includes('HYPERLINK'))
  inj && /"'=HYPERLINK/.test(inj) ? pass("formula injection neutralised (=HYPERLINK -> '=HYPERLINK)") : fail(`🛑 injection NOT escaped: ${String(inj).slice(0, 90)}`)

  // Embedded quote/comma/newline still parse as ONE row each.
  const parsed = parseCsv(csv)
  parsed.length - 1 === GRANTS.length
    ? pass(`CSV parses back to exactly ${GRANTS.length} rows despite quotes, commas and a newline`)
    : fail(`🛑 CSV parsed to ${parsed.length - 1} rows, expected ${GRANTS.length}`)
  const roundTrip = parsed.find((r) => r[1] && r[1].includes('Dam Safety'))
  roundTrip && roundTrip[2].includes('\n') ? pass('multi-line cell survived the round trip') : fail('🛑 multi-line cell broken')

  // Empty tables still get a header-row file.
  const empties = written.filter((f) => f.endsWith('.csv'))
  empties.length === 5 ? pass('one CSV per table, including tables with no rows') : fail(`expected 5 CSVs, got ${empties.length}`)

  const readme = readFileSync(join(dir, 'README.txt'), 'utf8')
  readme.includes('Rows exported:') && readme.includes(EMAIL) ? pass('README names the account and row counts') : fail('README incomplete')

  console.log(`\n  ${c.d}sample of grants.csv:${c.r}`)
  rows.slice(0, 3).forEach((r) => console.log(`  ${c.d}${r.slice(0, 118)}${c.r}`))
  rmSync(dir, { recursive: true, force: true })
}

/** Minimal RFC4180 parser — proves the file is readable by something that is not us. */
function parseCsv(text) {
  const out = []; let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\r' && text[i + 1] === '\n') { row.push(cell); out.push(row); row = []; cell = ''; i++ }
    else cell += ch
  }
  if (cell || row.length) { row.push(cell); out.push(row) }
  return out
}

try {
  const health = await req('/api/health')
  if (health.status !== 200) throw new Error('PocketBase not reachable — start GrantHarbor first')
  await seed()
  verify(await readBack())
} catch (e) {
  fail(String(e.message))
} finally {
  if (user) {
    try { await req(`/api/collections/users/records/${user.id}`, { method: 'DELETE', token: user.token }); console.log(`\n${c.d}throwaway account deleted${c.r}`) } catch { console.log(`\n${c.y}could not delete ${EMAIL} — remove it by hand${c.r}`) }
  }
}
console.log(`\n${c.b}${bad ? c.red : c.g}${ok} passed · ${bad} failed${c.r}\n`)
process.exit(bad ? 1 : 0)
