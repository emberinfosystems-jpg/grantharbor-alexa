// GrantGuard backend proof — runs the FULL stack: @ember/data adapter → PocketBase,
// with two users, proving auth + owner-scoped RLS + CRUD all work together.
import { createPbClient } from '../../../../10_DESIGN/ember-data/src/adapter.js'

const URL = process.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090'
const db = createPbClient({ url: URL })
const pb = db._pb // escape hatch for auth (mirrors supabase.auth)

const rnd = Math.random().toString(36).slice(2, 8)
const A = { email: `alice_${rnd}@t.local`, password: 'pw12345678', passwordConfirm: 'pw12345678' }
const B = { email: `bob_${rnd}@t.local`, password: 'pw12345678', passwordConfirm: 'pw12345678' }

function assert(cond, msg) { if (!cond) { console.error('  ✗ FAIL:', msg); process.exit(1) } console.log('  ✓', msg) }

// user A
const ua = await pb.collection('users').create(A)
await pb.collection('users').authWithPassword(A.email, A.password)
assert(pb.authStore.isValid, 'user A registered + authenticated')

// A inserts a grant (stamps created_by = self)
const ins = await db.from('grants').insert({
  created_by: ua.id, title: 'SBIR Phase I — NSF', source_agency: 'NSF',
  funding_amount: 275000, deadline: '2026-08-05', status: 'Applied', categories: ['R&D'],
}).select().single()
assert(!ins.error && ins.data?.id, 'A inserted a grant via adapter')
const gid = ins.data.id

// A lists → sees own grant
const la = await db.from('grants').select('*')
assert(!la.error && la.data.some(g => g.id === gid), `A sees own grant (RLS read, ${la.data.length} row/s)`)

// A updates status via adapter
const up = await db.from('grants').update({ status: 'Awarded' }).eq('id', gid)
assert(!up.error && up.data?.status === 'Awarded', 'A updated grant status → Awarded')

// user B — must NOT see A's grant (RLS isolation, the whole point)
await pb.collection('users').create(B)
await pb.collection('users').authWithPassword(B.email, B.password)
const lb = await db.from('grants').select('*')
assert(!lb.error && !lb.data.some(g => g.id === gid), `B CANNOT see A's grant (RLS isolation, B sees ${lb.data.length})`)

// B cannot delete A's grant either
const delB = await db.from('grants').delete().eq('id', gid)
const stillThere = await pb.collection('_superusers').authWithPassword(
  process.env.PB_SU_EMAIL || 'dev@grantguard.local', process.env.PB_SU_PASS || 'devpass123456'
).then(() => pb.collection('grants').getOne(gid)).then(() => true).catch(() => false)
assert(stillThere, "B's delete of A's grant was blocked by RLS")

// A deletes own grant (re-auth as A)
await pb.collection('users').authWithPassword(A.email, A.password)
const del = await db.from('grants').delete().eq('id', gid)
assert(!del.error, 'A deleted own grant')

console.log('\n✅ BACKEND PROVEN: @ember/data adapter → PocketBase, auth + owner-scoped RLS + CRUD all working.')
