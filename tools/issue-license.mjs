/**
 * Mint a GrantHarbor Pro licence key.
 *
 * 🛑 EIS-ONLY TOOL. Requires the private key, which lives in the VDR and must never reach
 * the app, this repo, or a customer. Run it after a payment clears.
 *
 *   node tools/issue-license.mjs <customer-email> [order-ref]
 *
 * The key is bound to the email, so it cannot be shared usefully — the app checks the
 * binding against the signed-in account on every launch, not just at activation.
 */
import { createPrivateKey, sign as edSign, createHash } from 'crypto'
import { readFileSync, existsSync } from 'fs'
import { execFileSync } from 'child_process'

/**
 * 🛑 THE SIGNING KEY COMES FROM PHOENIX VAULT, NOT FROM A FILE ON DISK.
 *
 * It used to sit in the VDR as plaintext PEM. That was a stopgap explicitly only valid
 * "while 0 licences are issued" — the moment one real customer holds a key, that file is
 * the thing that lets anyone who reaches it mint free Pro licences forever, and revoking
 * it means invalidating every licence already sold. There is no partial recovery.
 *
 * The vault gives it encryption at rest (scrypt + ChaCha20-Poly1305, DPAPI session cache),
 * so the secret exists in the clear only inside this process, only while signing.
 *
 * Resolution order, most-explicit first:
 *   1. GRANTH_LICENSE_KEY  — a file path. Escape hatch for a machine with no vault.
 *   2. Phoenix Vault       — the normal path.
 *   3. the legacy plaintext PEM — still honoured, but it SAYS SO loudly, because a silent
 *      fallback to the insecure source is how a migration quietly never finishes.
 */
const VAULT_ENTRY = 'GRANTH_LICENSE_KEY'
const LEGACY_PEM = 'C:/Users/pheon/Documents/02_PHOENIX_VDR/09_KEYS_GRANTHARBOR/granth-license-private.pem'
const PYTHON = 'C:/Users/pheon/AppData/Local/Programs/Python/Python312/python.exe'
const VAULT_DIR = 'C:/Users/pheon/Projects/05_INFRA/phoenix-vault'

function keyFromVault() {
  try {
    // 🛑 stdio: stdin+stderr INHERIT, stdout PIPE. The passphrase prompt is written to
    // stderr (fixed 2026-08-25 for exactly this reason) so it stays visible on the console
    // and can be typed, while the secret itself comes back on stdout and never touches a
    // terminal, a log, or shell history.
    const out = execFileSync(PYTHON, ['-m', 'phoenix_vault.cli', 'get', VAULT_ENTRY], {
      cwd: VAULT_DIR,
      stdio: ['inherit', 'pipe', 'inherit'],
      encoding: 'utf8'
    })
    const pem = String(out).trim()
    return pem.includes('BEGIN PRIVATE KEY') ? pem : null
  } catch {
    return null // not stored yet, wrong passphrase, or cancelled — caller reports it
  }
}

function loadPrivateKey() {
  const override = process.env.GRANTH_LICENSE_KEY
  if (override) {
    if (!existsSync(override)) {
      console.error(`
🛑 GRANTH_LICENSE_KEY points at a file that does not exist: ${override}
`)
      process.exit(1)
    }
    console.error(`  key source: ${override} (GRANTH_LICENSE_KEY override)`)
    return readFileSync(override, 'utf8')
  }

  const fromVault = keyFromVault()
  if (fromVault) {
    console.error('  key source: Phoenix Vault')
    return fromVault
  }

  if (existsSync(LEGACY_PEM)) {
    console.error('')
    console.error('  ⚠  USING THE PLAINTEXT KEY IN THE VDR — it is not encrypted at rest.')
    console.error('     Move it into the vault, then delete the file:')
    console.error(`       python -m phoenix_vault.cli add ${VAULT_ENTRY} --file "${LEGACY_PEM}"`)
    console.error('')
    return readFileSync(LEGACY_PEM, 'utf8')
  }

  console.error(`\n🛑 No signing key. Store it in Phoenix Vault as ${VAULT_ENTRY}:`)
  console.error(`     python -m phoenix_vault.cli add ${VAULT_ENTRY} --file <key.pem>`)
  console.error('   or run tools/keygen.mjs if this is a new install.\n')
  process.exit(1)
}

const email = process.argv[2]
const order = process.argv[3]
const renewsOn = process.argv[4]   // biller's current_period_end; omit = perpetual licence
if (!email) {
  console.error('usage: node tools/issue-license.mjs <customer-email> [order-ref] [renews-on YYYY-MM-DD]')
  console.error('  omit renews-on for the perpetual $39 licence;')
  console.error('  for the $19/mo add-on, pass the biller current_period_end date.')
  console.error('  ACCESS is issued 15 days LATER than that, automatically.')
  process.exit(1)
}
if (renewsOn && !/^\d{4}-\d{2}-\d{2}$/.test(renewsOn)) {
  console.error('renew date must be YYYY-MM-DD')
  process.exit(1)
}

// 🛑 ACCESS = BILLING + buffer. The ONE piece of date arithmetic we do, and it is plain
// day-addition on a UTC date — not month arithmetic, which is the part we refuse to own.
const ACCESS_BUFFER_DAYS = 15
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  const p = (v) => String(v).padStart(2, '0')
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`
}
const accessThrough = renewsOn ? addDays(renewsOn, ACCESS_BUFFER_DAYS) : undefined

// 🛑 `b` (the billing date) comes from the BILLER — never computed here. "+30 days" is not
// a month (it bills 12.17 times a year) and naive month-adding turns Jan 31 into Mar 3
// outside a leap year. The biller already solved anchoring, short-month clamping and Feb 29.
// `x` (access) is that date plus a flat 15 days, which IS safe day-arithmetic:
// 2027-01-31 + 15 = 2027-02-15, correct across a short month.
//
// 🛑 BOTH are carried so the app can show the customer both. With only `x` on screen they
// read "access until 15 Feb" and get charged on 31 Jan with no warning.
const payload = {
  e: String(email).toLowerCase().trim(),
  p: 'pro',
  i: new Date().toISOString().slice(0, 10),
  ...(order ? { o: String(order) } : {}),
  ...(accessThrough ? { x: accessThrough, b: renewsOn } : {})
}
const body = Buffer.from(JSON.stringify(payload), 'utf8')
const key = createPrivateKey(loadPrivateKey())
const sig = edSign(null, body, key)

// 🛑 BASE32, NOT base64url. Keys are grouped with dashes so a human can read one off a
// receipt — and base64url's alphabet CONTAINS '-'. The first version grouped a base64url
// string with dashes, so stripping the grouping on paste also ate real payload characters:
// every GENUINE key failed to verify while every forgery still correctly failed. Base32
// (A-Z 2-7) shares no character with the separator, so grouping is lossless.
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function b32encode(buf) {
  let bits = 0, value = 0, out = ''
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}
const raw = b32encode(Buffer.concat([sig, body]))
const grouped = raw.match(/.{1,8}/g).join('-')
console.log('\nLicence for :', payload.e)
console.log('Issued      :', payload.i, order ? `(order ${order})` : '')
console.log('Type        :', renewsOn ? 'subscription' : 'PERPETUAL — never expires')
if (renewsOn) {
  console.log('Card charged:', renewsOn)
  console.log('Access until:', accessThrough, `(+${ACCESS_BUFFER_DAYS}d buffer, then 3d grace)`)
}
console.log('\n' + grouped + '\n')
