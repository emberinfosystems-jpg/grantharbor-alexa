/**
 * One-time license keypair generator for GrantHarbor.
 *
 * 🛑 RUN THIS ONCE, THEN GUARD THE PRIVATE KEY. Anyone holding it can mint unlimited valid
 * Pro licenses. It must NEVER be committed, bundled, or copied into the app — the app only
 * ever needs the PUBLIC half, which can be read by anyone without consequence.
 *
 * Regenerating the keypair invalidates every license already issued, so do it only if the
 * private key is believed compromised — and expect to re-issue to existing customers.
 */
import { generateKeyPairSync } from 'crypto'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'

const OUT = process.argv[2]
if (!OUT) { console.error('usage: node tools/keygen.mjs <output-dir>'); process.exit(1) }
mkdirSync(OUT, { recursive: true })

const priv = join(OUT, 'granth-license-private.pem')
if (existsSync(priv)) {
  console.error(`\n🛑 ${priv} already exists. Refusing to overwrite — that would invalidate`)
  console.error('   every license ever issued. Delete it deliberately if that is what you want.\n')
  process.exit(1)
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
writeFileSync(priv, privateKey.export({ type: 'pkcs8', format: 'pem' }))
const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
writeFileSync(join(OUT, 'granth-license-public.pem'), pubPem)

// The app embeds the raw 32-byte public key, base64 — smaller and easier to paste than PEM.
const raw = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32)
console.log('\nPrivate key ->', priv, '  🛑 KEEP OFF THE APP AND OFF GIT')
console.log('Public key  ->', join(OUT, 'granth-license-public.pem'))
console.log('\nEmbed this in src/main/license.ts as LICENSE_PUBLIC_KEY:\n')
console.log('  ' + raw.toString('base64') + '\n')
