# GrantGuard — Build Plan (off Base44, module-first)

**Source of truth for scope:** `02_PHOENIX_VDR\02_ENTITIES\Grant_Guard.odt` (the Base44 build bible — the real deployed app).
**Goal:** port GrantGuard OFF Base44 onto owned rails, mobile-first, Play-Store-shippable. Reuse fleet modules; build new only where nothing exists.
**Honest state (2026-07-27):** local port = 3/13 pages in bare HTML + 9 done logic modules. Backend, design system, 10 pages, and mobile shell are the work.

---

## 🔁 Reuse ledger (2026-07-29 design pass) — the four-app compounding
**Reused straight from the shared rails (built nothing):** `@ember/ui` (Card, Input, Select, Button,
StatusBadge, Switch, Label, EmptyState, `cn`) · `@ember/data` (PocketBase adapter + bundled `pocketbase.exe`) ·
`@ember/legal` (Terms/Privacy) · `eis-paths` (alias resolver). This is why the whole skin + backend + legal came
"for free" — coin-block / vector / equitybridge already share these.

**NEW reusable parts built here → HARVEST into `@ember/ui` for the other three apps:**
| Component | File | Generalizes to |
|---|---|---|
| `FundingRings` | `components/FundingRings.tsx` | concentric radial "activity rings" — N rings, values, colors (any allocation/sources viz) |
| `Kpi` tile (icon-chip + label + value + tint) | `pages/Dashboard.tsx` / `Applications.tsx` | a richer `StatTile` variant — used 7× already this app |
| `GrantBoard` | `components/GrantBoard.tsx` | generic `KanbanBoard` (columns + native drag-drop `onMove`) |
| `GrantCalendar` | `components/GrantCalendar.tsx` | generic `MonthCalendar` (colored day chips) |
| Segmented toggle | inline (Grants view · Settings theme · Investors type) | a `Segmented` control |
| `theme.ts` light/dark | `lib/theme.ts` | localStorage theme toggle (simpler than the next-themes `ThemeProvider`) |
| Rich entity card | `pages/Investors.tsx` `InvestorCard` | `EntityCard` (title + badge + desc + tag chips + field rows) |

🔴 These are still GrantGuard-local — promoting them into `10_DESIGN/ember-ui` is the harvest step so the sum
compounds (Scott's directive 07-29). Tracked as a spawned task.

## Reusable modules already owned (verified to exist 07-27)
| Need | Module | Path |
|---|---|---|
| Base44 `entities.X.*` → own DB | **`pbClient` adapter** (Base44-SDK-shaped) | `01_PRODUCTS\01_Polished\TouchTracker\src\lib\pocketbaseAdapter.js` |
| CSV export helpers | `exports.js` | `…\TouchTracker\src\lib\exports.js` |
| PB migrations pattern | `pb_migrations\*` | `…\TouchTracker\pocketbase\` |
| Running PocketBase exemplar | Resonance (`pocketbase ^0.27`) | `01_PRODUCTS\00_In-Process\resonance` |
| Design system (shadcn-flavored) | **@ember/ui** (primitives, patterns, tokens.css) | `10_DESIGN\ember-ui` |
| Email send (grant alerts) | ember-digest / embercourier | `Projects\ember-digest`, `03_SALES\embercourier` |
| API-key vault (when Stripe keys go live) | Phoenix Vault | `05_INFRA\phoenix-vault` |
| Local LLM (InvokeLLM replacement) | Holly / Ollama | `holly-desktop`, Ollama :11434 |

## Already done locally — keep as-is (pure logic, framework-agnostic)
`csvInjection`, `grantFilters`, `grantSort`, `grantStatus`, `deadlineCalc`, `einValidation`, `fundingOverview`, `investorFilter`, `grantTypes` (`src/renderer/src/lib/`).

---

## Work breakdown

### Phase 1 — Backend swap (data + auth + RLS + files) — ✅ BACKEND PROVEN 2026-07-27
- [x] **Shared rail built:** `@ember/data` (`10_DESIGN/ember-data`) — generalized supabase-dialect adapter + backend-select factory + bundled `pocketbase.exe` (0.39.5). Consumed via `eis-paths.cjs` (`emberDataAliases`), same clean way as `@ember/ui`. **Harvest once, every app reuses.**
- [x] PocketBase stood up for GrantGuard (`pocketbase/pb_data`, superuser `dev@grantguard.local`), serving :8090.
- [x] **6 collections created with owner-scoped RLS** via `pocketbase/setup-collections.mjs` (Base44 RLS `{created_by_id}` → PB rule `@request.auth.id != "" && created_by = @request.auth.id` on every op).
- [x] **PROVEN end-to-end** (`pocketbase/smoke-rls.mjs`, all 7 asserts pass): 2-user isolation — user B cannot read OR delete user A's grant. Auth + RLS + adapter CRUD all working.
- [x] App wired: `.env` (VITE_DB_BACKEND=pocketbase), `src/renderer/src/lib/db.ts` (client + auth helpers + `withOwner`), Vite aliases in both configs.
- [x] **Store swapped** `state/useStore.ts` localStorage → live backend via `db`. Public API identical → the 3 pages unchanged.

**To run the backend:** `& "10_DESIGN/ember-data/bin/pocketbase.exe" serve --dir "<gg>/pocketbase/pb_data" --http 127.0.0.1:8090`

### Phase 2 — Auth + live data in the app — ✅ DONE + VERIFIED IN BROWSER 2026-07-27
- [x] `src/renderer/src/components/AuthScreen.tsx` — login/register UI (email+password), themed.
- [x] `src/renderer/src/lib/useAuth.ts` — reactive auth off `pb.authStore`; `App.tsx` gates on it (AuthScreen ↔ Workspace) + Sign out.
- [x] `useStore.ts` now reads/writes the backend; first-login **seeds demo data once** (`bootstrapOnce` guard — immune to StrictMode double-invoke).
- [x] **VERIFIED end-to-end in the browser (Vite renderer :5290 → PocketBase :8090):** registered `founder@acme.local` → dashboard computed off 5 live grants ($935K) → **added "DOE Solar Innovation Prize" via the UI → confirmed written to PocketBase (owner-stamped) → full page reload → data persisted** (6 grants, $1.115M, pipeline recomputed). Real auth + RLS + persistence, not localStorage.
- [x] Bugs found by running it + fixed: (1) `@supabase` static import broke the browser bundle → made Supabase opt-in in `@ember/data/client.js`; (2) StrictMode double-seed → `bootstrapOnce`; (3) Dashboard keyed rows by title → keyed by `title-idx`.
- 🔴 NOT YET (later phases): this is the **browser-served renderer** (same React app Electron loads) — packaged Electron app + Capacitor mobile shell = Phase 5. @ember/ui skin + remaining 10 pages = Phase 2/3 continuation.

### Phase 2 — Skin + missing pages — REUSE @ember/ui
- [x] **3 pages skinned with @ember/ui + VERIFIED in browser 2026-07-27.** Wired the full Tailwind pipeline
      (tailwind.config.cjs + postcss.config.cjs + preset/tokens via eis-paths; `@ember/ui` alias + `emberAliases`
      + peer deps installed). Shell/Sidebar/AuthScreen converted to ember-ui tokens too (whole app cohesive).
      Dashboard=StatTile/Card; Grants=Card table + Input/Select/Button/StatusBadge; Investors=Card grid.
      Dark mode from OS pref (`.dark` class in main.tsx); green brand kept via `--primary` override.
      Verified by computed styles (active nav green rgb(65,200,160), StatusBadges tinted, cards from tokens),
      0 console errors on all 4 pages. Also aligned `@ember/legal` to the ember-ui token vocab so Legal themes too.
- [x] **Grants Board/Kanban view — DONE + VERIFIED in browser 2026-07-27.** `components/GrantBoard.tsx` — native
      HTML5 drag-and-drop (zero new deps), 6 status columns w/ counts, drag-over highlight, "Drop here" placeholders.
      Table/Board segmented toggle on the Grants page. Verified end-to-end: simulated dragging "EDA Build to Scale"
      New→Awarded → **persisted to PocketBase** (updateGrant path) → board re-rendered (New 3→2, Awarded 1→2).
- [x] **Grants Calendar view — DONE 2026-07-27.** `components/GrantCalendar.tsx` — month grid, prev/next/Today,
      grants as status-colored chips on their deadline day, today highlighted. Third option in the Grants view toggle.

### Phase 5 — Ship: SELF-CONTAINED DESKTOP APP ✅ ACHIEVED + VERIFIED 2026-07-27 (the "not a turd" fix)
Scott's desktop `GrantGuard.exe`/shortcut was the stale Jul-12 wireframe. Fixed:
- [x] Electron **main process now boots its own PocketBase** (`src/main/index.ts`): health-check first (reuse a running
      instance in dev), else spawn the bundled `pocketbase.exe` against `%APPDATA%\grantguard-desktop\pb_data`, seeding
      it from a bundled schema-only template on first run; killed on quit. Waits for health before opening the window.
- [x] Bundled a **clean schema-only `pb_template`** (6 collections + owner RLS, 0 records, 1.1MB) — built on a temp port.
- [x] `npm run package` now `--extra-resource`s `pocketbase.exe` + `pb_template` into the app.
- [x] Rebuilt (electron-vite: 36KB Tailwind CSS + 507KB JS, 1706 modules) + repackaged (fresh exe 2026-07-27).
- [x] **VERIFIED the packaged .exe end-to-end:** killed dev PB → launched exe → it spawned its OWN PocketBase (:8090
      healthy) → created its data dir from the template → registered a user + inserted an owner-scoped grant via its own
      backend. Desktop shortcut already points to the fresh build. **Double-click → working app, no manual server.**
- 🔴 STILL NOT app-store: this is a **Windows desktop app**, not the Play-Store/Capacitor mobile build. That + code-signed
      installer = the real Phase 5 finish. Also: couldn't screenshot the native window (computer-use can't grant a portable exe).
- 🔴 **HIGH PRIORITY (deferred, Scott 07-27): Auth forgot/reset password** — do once the product is closer to
      polished. Tracked as a spawn_task chip. This is the top of the queue after the current polish pass.
- [x] **Legal (Terms + Privacy) — DONE via new shared `@ember/legal` rail + VERIFIED in browser 2026-07-27.**
      `pages/Legal.tsx` passes GrantGuard's config to `<LegalPage>`; both tabs render (Terms w/ Stripe clause, Privacy w/ GrantGuard's own data table + non-extractive commitment). Rail harvested from Horizon; consumed via eis-paths `emberLegalAliases`. See [[project_ember_legal_rail]].
- [x] **Remaining pages BUILT + VERIFIED in browser 2026-07-27** (polished to the same @ember/ui bar):
      **Approved Senders** (CRUD, EmptyState — write path proven: sender persisted owner-stamped),
      **Applications** (derived view of submitted grants — Applied/Awarded/Rejected with confirmation #),
      **Apply / Application Profiles** (grouped add/edit/delete form, EmptyState),
      **Settings** (notification switches + email-frequency, live-saving; account deletion w/ inline confirm).
      Store extended for approved_senders / application_profiles / user_preferences (same backend-backed pattern).
      🐛 Found+fixed by running it: first `user_preferences` save wrote only the toggled field → others fell to
      PocketBase `false` default; fixed to insert the FULL effective state (re-verified: email=false, in_app=true kept).
      8-item nav now: Dashboard, Grants, Applications, Apply, Investors, Approved Senders, Settings, Legal.
- [ ] Auth: forgot/reset password screens (only remaining Phase-2 page).

### Phase 3 — Integrations — REUSE engines, wire features
- [ ] Grant-match / summarize → local Ollama (replaces `InvokeLLM`).
- [ ] Grant-alert emails → ember-digest/embercourier + Resend (replaces `SendEmail`).
- [ ] Doc attachments → PocketBase file fields (replaces `UploadFile`/signed URLs).
- [ ] Doc data extract → PyMuPDF + Ollama (replaces `ExtractDataFromUploadedFile`).
- [ ] DROP for v1: GenerateImage/Speech/Video/TranscribeAudio.

### Phase 4 — THE DIFFERENTIATOR (mostly new) — grant ingestion
- [ ] Decide source: (a) parse incoming grant-alert emails from ApprovedSenders, and/or (b) pull Grants.gov API.
- [ ] Pipeline: ingest → dedupe → auto-create Grant records → notify per UserPreference.
- [ ] **This is what makes GrantGuard worth leading with. Without it, it's a manual grant spreadsheet.**

### Phase 5 — Ship (the "$25 app store" part)
- [x] **Capacitor wrap → Android APK → RUNS ON DEVICE end-to-end (2026-08-29).** Registered
      `cuztest@ember.app` on the B160V → wrote to Luke's PocketBase over the tailnet → full dashboard
      renders with live data. Server-side confirmed (auth-with-password from Luke: user id qvh3dbmh2z6767w).
- [x] **Mobile nav BUILT + verified (2026-08-29):** `components/MobileNav.tsx` — bottom tab bar (Dashboard/
      Grants/Applications/Investors) + a "More" bottom-sheet (Discover/Apply/Approved Senders/Settings/Legal/
      Upgrade). Fixed, safe-area (`env(safe-area-inset-bottom)`), 44px targets. Wired via AppShell's
      `mobileNav` prop (its sidebar is `hidden md:flex` — desktop-only; the app MUST supply mobile nav).
      🐛 **Fixed a real mobile bug:** the wide Grants table expanded the layout viewport → on mobile that
      breaks `position:fixed` (tab bar slid sideways off-screen / whole page pulled left). Fix = page-level
      `html,body{overflow-x:hidden}` in index.css + wrap the table in `overflow-x-auto` so it scrolls itself.
      ✅ Board (kanban) view given the same `overflow-x-auto` wrapper (`GrantBoard.tsx`, app-side around the
      shared `@ember/ui` Board — rail untouched) — verified: columns scroll internally, nav stays fixed.
- [ ] Remaining shell polish: pull-to-refresh, bottom-sheet dialogs for forms (native feel).
- [ ] Play Store internal testing track (needs signed release AAB, not the debug APK).
- [ ] Stripe subscription tiers (Scott HAS Stripe; vault keys only when live billing is needed).

#### 2026-08-29 — Mobile build notes (the two bugs + the architecture)
**Pipeline (all on C:):** `dist-web` = standalone renderer (`vite build --config vite.renderer.config.mjs
--mode mobile`); Capacitor (`com.emberinfo.grantharbor`, webDir `dist-web`); `android/` platform;
`gradlew assembleDebug` → `app-debug.apk`. JDK 21 + Android SDK per CAPACITOR_MOBILE_PIPELINE.md.
**Backend = PocketBase on Luke** (`http://100.84.185.50:8090`, tailnet), phone joins via Tailscale.
Env in `.env.mobile` (Luke URL), desktop keeps `.env` (localhost + its own bundled PB).

**Two bugs found on-device (logged so they don't recur):**
1. **Wrong URL baked in.** `vite.renderer.config.mjs` has `root: 'src/renderer'`, so Vite's `envDir`
   defaulted there and MISSED the project-root `.env.mobile` → APK fell back to `127.0.0.1:8090` (the
   phone itself) → every login "server is not running". **Fix: `envDir: here`** in the renderer config.
2. **Mixed content.** Capacitor serves from `https://localhost`; a plain-`http://` PB call is blocked by
   the WebView even with `cleartext:true`. **Fix: `android.allowMixedContent: true`** in capacitor.config.
   🛑 BOTH `cleartext` + `allowMixedContent` are **TESTER-ONLY** — at launch, serve PB over HTTPS and remove.

**Architecture (Scott, 2026-08-29): local-first free / shared-backend Pro.**
- **Free = local-first** (desktop's bundled PB, single device — the non-extractive default, unchanged).
- **Pro = optional "multiple doors"** — sync to Ember-hosted PB, reach data from desktop + phone. Opt-in,
  disclosed in terms. The mobile app IS the Pro second-door artifact (points at the shared PB).
- ✅ **DECIDED (Scott, 2026-08-29): OPTION 2** — mobile MUST stand alone (free, on-device store, no
  account) AND be a Pro sync node. Reasoning: the standalone app IS the Play Store product; many users
  have no desktop. Free-local mobile = the app's core value; Pro sync = the upgrade.

#### 2026-08-29 — Option 2 v1 BUILT: free local-first standalone (on-device, no account)
- **`src/renderer/src/lib/localDb.ts`** — `makeLocalClient()`: a supabase-dialect client over
  **IndexedDB** (zero native deps, runs in the WebView), implementing the exact surface `useStore`
  calls (`.from().select().order().limit()`, `.insert()`, `.update().eq()`, `.delete().eq()` → `{data,error}`).
  Drop-in for `db` — store/pages untouched. No auth/RLS (device = boundary). 🔜 harvest into `@ember/data`
  as a `local` backend for the mobile-first fleet.
- **`db.ts`** — `LOCAL_MODE` from `resolveBackend()` (runtime `localStorage['gh_backend']` override →
  `VITE_DB_BACKEND`). Local mode: `db` = local client, `pb` = no-op stub (so `@ember/auth` adapter
  constructs), `currentUserId()` = `'local'`. **`.env.mobile` now `VITE_DB_BACKEND=local`** (was pocketbase).
- **`App.tsx`** — `if (LOCAL_MODE) return <Workspace local/>` — skips the auth gate; header shows
  "On this device", no Sign out.
- **VERIFIED on B160V:** tsc clean → APK opens **straight to dashboard, no login**, demo data from
  IndexedDB, **no network**. Force-stop + relaunch → data **persists**, no double-seed. Store screenshot:
  `reference/store-assets/GrantHarbor-mobile-dashboard-standalone.png`.
- 🔜 **Pro sync (fast-follow):** a "Sync across devices" action sets `gh_backend=pocketbase` + the Luke/prod
  URL, migrates local IndexedDB records up to the shared PB (owner-stamped), then runs cloud. The cloud
  path is already proven (see prior section). Also: HTTPS backend at launch; entitlement gate; terms clause.
- 🔜 **Store screenshots need polish** — current capture has the debug status/notification bar; produce
  clean framed shots (demo-mode status bar or crop) for the actual Play listing.
- Adds later: Pro/Free entitlement gate, local→cloud migration on upgrade, `@ember/legal` terms clause.
- 🛑 Tester PB currently running on Luke as a background process (bound `100.84.185.50:8090`); firewall
  rule `GrantHarbor PB tailnet 8090` opened inbound 8090 to `100.64.0.0/10` only.

---

## Critical path (honest)
Phase 1 (backend swap) → Phase 2 (skin + pages) unblock a **real, usable desktop app**.
Phase 4 (ingestion) is what makes it a *product* vs a tracker.
Phase 5 is what makes it *sellable on a store*.
Reuse means Phases 1–3 are mostly wiring owned parts, not net-new code.
