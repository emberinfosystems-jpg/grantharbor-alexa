// GrantGuard — PocketBase collection setup (idempotent).
// Creates the 6 entities from the Base44 build bible §4 with owner-scoped RLS.
// Base44 RLS  { created_by_id: "{{user.id}}" }  →  PB rule below on every op.
//
// Run:  node setup-collections.mjs   (PB must be serving on VITE_POCKETBASE_URL)
import PocketBase from 'pocketbase'

const URL = process.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090'
const SU_EMAIL = process.env.PB_SU_EMAIL || 'dev@grantguard.local'
const SU_PASS = process.env.PB_SU_PASS || 'devpass123456'

const pb = new PocketBase(URL)
pb.autoCancellation(false)
await pb.collection('_superusers').authWithPassword(SU_EMAIL, SU_PASS)

const users = await pb.collections.getOne('users')

// Owner-scoped RLS: only the creator can read/write their rows.
const OWNER = '@request.auth.id != "" && created_by = @request.auth.id'
// Create: must be authed and must stamp themselves as the owner.
const OWNER_CREATE = '@request.auth.id != "" && @request.body.created_by = @request.auth.id'

const owner = (name, fields) => ({
  name, type: 'base',
  listRule: OWNER, viewRule: OWNER, createRule: OWNER_CREATE, updateRule: OWNER, deleteRule: OWNER,
  fields: [
    { name: 'created_by', type: 'relation', required: true, maxSelect: 1, cascadeDelete: true, collectionId: users.id },
    ...fields,
    { name: 'created_at', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated_at', type: 'autodate', onCreate: true, onUpdate: true },
  ],
})

const T = (name, o = {}) => ({ name, type: 'text', required: false, ...o })
const N = (name) => ({ name, type: 'number', required: false })
const B = (name) => ({ name, type: 'bool', required: false })
const D = (name) => ({ name, type: 'date', required: false })
const J = (name) => ({ name, type: 'json', required: false, maxSize: 200000 })
const SEL = (name, values, maxSelect = 1) => ({ name, type: 'select', required: false, maxSelect, values })

const SCHEMA = [
  owner('grants', [
    T('title', { required: true }), T('description'), N('funding_amount'), D('deadline'),
    T('source_agency'), T('link_url'), J('categories'), D('received_date'),
    SEL('status', ['New', 'Reviewed', 'Applied', 'Awarded', 'Rejected', 'Expired']),
    T('notes'), T('confirmation_number'), D('submitted_date'), D('expected_response_date'),
  ]),
  owner('investors', [
    T('name', { required: true }), SEL('investor_type', ['venture_capital', 'angel']),
    J('focus_areas'), T('stage'), N('typical_check_min'), N('typical_check_max'),
    N('fund_size'), T('location'), T('website_url'), T('description'), J('portfolio_examples'), B('is_active'),
  ]),
  owner('categories', [
    T('name', { required: true }), T('color'), B('is_default'), T('description', { max: 1000 }),
  ]),
  owner('application_profiles', [
    T('profile_name', { required: true }), T('applicant_name'), T('email'), T('phone'),
    T('business_name'), SEL('business_type', ['LLC', 'Corporation', 'Partnership', 'Sole Proprietorship', 'Nonprofit', 'Other']),
    T('ein'), T('address'), T('city'), T('state'), T('zip_code'), T('industry'),
    N('annual_revenue'), N('years_in_business'), N('employees'), T('mission_statement'),
    N('funding_needed'), T('funding_purpose'), T('executive_summary'), J('documents'),
  ]),
  owner('approved_senders', [
    T('email_or_domain', { required: true }), T('sender_name'),
    SEL('sender_type', ['email', 'domain']), T('notes'),
  ]),
  owner('user_preferences', [
    J('preferred_categories'), B('notify_email'), B('notify_in_app'),
    SEL('email_frequency', ['instant', 'daily', 'weekly']), T('description', { max: 1000 }),
  ]),
]

let created = 0, skipped = 0
for (const spec of SCHEMA) {
  try {
    await pb.collections.getOne(spec.name)
    console.log(`  = ${spec.name} (exists, skipped)`)
    skipped++
  } catch {
    await pb.collections.create(spec)
    console.log(`  + ${spec.name} (created, RLS: owner-scoped)`)
    created++
  }
}
// ── applications — the Alexa+ autofill target: a drafted/approved/submitted grant application
// with an audit trail. Relates to a grant + the profile it was filled from. Owner-scoped like the rest.
try {
  await pb.collections.getOne('applications')
  console.log('  = applications (exists, skipped)'); skipped++
} catch {
  const grantsCol = await pb.collections.getOne('grants')
  const profilesCol = await pb.collections.getOne('application_profiles')
  await pb.collections.create({
    name: 'applications', type: 'base',
    listRule: OWNER, viewRule: OWNER, createRule: OWNER_CREATE, updateRule: OWNER, deleteRule: OWNER,
    fields: [
      { name: 'created_by', type: 'relation', required: true, maxSelect: 1, cascadeDelete: true, collectionId: users.id },
      { name: 'grant', type: 'relation', required: false, maxSelect: 1, cascadeDelete: false, collectionId: grantsCol.id },
      { name: 'profile', type: 'relation', required: false, maxSelect: 1, cascadeDelete: false, collectionId: profilesCol.id },
      T('grant_title'),
      SEL('status', ['Drafting', 'NeedsInput', 'ReadyForReview', 'Approved', 'Submitted']),
      J('filled_fields'), J('needs_input'), T('draft_text'), T('form_template'),
      T('review_email'), T('approval_token_hash'),
      D('approved_at'), D('submitted_at'), T('confirmation_number'),
      { name: 'created_at', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated_at', type: 'autodate', onCreate: true, onUpdate: true },
    ],
  })
  console.log('  + applications (created, RLS: owner-scoped)'); created++
}

console.log(`\ndone — ${created} created, ${skipped} skipped. Collections:`)
const all = await pb.collections.getFullList()
console.log('  ' + all.filter(c => !c.system).map(c => c.name).join(', '))
