// GrantGuard auth — now a thin binding over the @ember/auth rail.
//
// 2026-08-03: this hook was one of the SEVEN implementations harvested into
// `@ember/auth` (Asset #6). It read the PocketBase authStore directly and
// exposed `{ isAuthed, userId, email }`; other apps in the fleet called the same
// three things `isAuthenticated` / `record` / `user`, which is exactly why no
// screen could move between two apps without a rewrite.
//
// The adapter is built ONCE here, at module scope — an adapter constructed
// inside render would be a new object every pass and would tear down and
// rebuild the PocketBase listener on each one.
//
// `collection: 'users'` matches db.ts (`pb.collection('users').authWithPassword`).
import { pocketbaseAuth } from '@ember/auth/adapters'
import { pb } from './db'

export { useAuth } from '@ember/auth'

export const grantGuardAuth = pocketbaseAuth({ pb, collection: 'users' })
