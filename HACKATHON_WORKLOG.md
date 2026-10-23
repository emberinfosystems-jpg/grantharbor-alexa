# GrantHarbor × Amazon Developer Hackathon — In-Window Work Log
**Hackathon:** Build, Ship, Shape (Alexa+ track) · **Window:** Aug 31 – Oct 23, 2026 · **Entrant:** Ember
Information Systems LLC (registered day-one, Aug 31). **Why this file:** the rules require an existing project
to be *significantly updated during the window*, with the updates clearly described and demoed. This log is
that record. Every GrantHarbor change from Aug 31 forward gets a dated entry here.

---

## BASELINE — state at hackathon start (Aug 31, 2026)
So we can prove what was built in-window, here's what existed *before*:
- Electron + React + PocketBase (Pro cloud sync) app; Capacitor Android build (shipping to Amazon Appstore).
- Free **local-first** tier (IndexedDB) + **Pro** cloud sync (PocketBase). **GMS-clean.**
- **Grant discovery works** (USAspending/`ingest`); grant tracking, deadlines, reports, investors.
- 🛑 **No MCP server** — Alexa integration built entirely in-window.
- 🛑 **Email transport DISABLED** (PocketBase SMTP off, `smtp.example.com`) — email push built in-window.
- 🛑 **No legal pages** (Privacy/ToS/Support) — created in-window.
- 🛑 **No applicant-profile / application-autofill entities** — created in-window.

---

## LOG

### 2026-08-31 — Day 1 (times PT)
- **~4:20 PM** — **Registered** Ember Information Systems LLC as an Amazon Developer + joined the hackathon
  (Alexa+ track). *(Submission window opened 10:15 AM PT the same day — registered day-one.)*
- **Icon fixed:** replaced the stock Capacitor launcher icon with GrantHarbor's across all 5 densities (legacy
  + adaptive foreground) via new `tools/gen-android-icons.mjs`; rebuilt + reinstalled the debug APK on-device.
- **Loadability confirmed on-device** (PID alive, renders full dashboard) — free local-first tier.
- **Store screenshots captured** (4: Dashboard, Grants, Applications, Investors) → `reference/store-assets/mobile/`.
- **Amazon Appstore submission runbook** authored (`AMAZON_SUBMISSION_RUNBOOK.md`) + ready listing copy.
- **Scoped the Alexa+ MCP integration** (see `HACKATHON_ALEXA_SCOPE.md`): voice → autofill draft → email review
  → biometric-gated approval → submission-ready. Inventory of current code state done (above).

### 2026-08-31 — GrantHarbor store-prep + legal (Day 1 cont.)
- **Paid Basic $16.99** (was a mistaken $39 = Phoenix bundle price); **Pro → disabled "Coming Soon"** (the
  mobile "Upgrade to Pro" button was a dead `bridge()` no-op); **cleartext/tailnet-PB stripped** (free tier is
  local-first standalone). Verified on-device.
- **Licence section hidden on mobile** (`!LOCAL_MODE`); `Licence → License` (US spelling).
- **Legal review run** (`LEGAL_REVIEW_PROMPT_PACK.md`) → fixes committed (all "DRAFT, pending counsel"):
  - `@ember/legal` rail: **added Force Majeure** clause (fleet-wide; with the mandatory-duty carve-out).
  - `Legal.tsx`: `hasAccounts: !LOCAL_MODE` (mobile ToS → "No Account Needed"), dropped the Account-Data
    disclosure on mobile (local-first collects none), added the **Connectivity & Consent** clause.
  - Bundle-verified + on-device: Legal page shows Terms/Privacy/Support, LLC + Oregon, review-with-counsel notice.
- 🔜 **Store-side legal to-do (surfaced by the review):** host the privacy policy at a public URL (emberinformation.shop)
  + fill the store Data-Safety questionnaire to MATCH ("no data collected" for the free tier). Verify support inbox live.
  Attorney-required later: Force-Majeure wording, breach plan, GLBA/EIN, payments.

<!-- New entries go below, newest last. Date · what changed · why · files touched. -->

### 2026-10-14 — Alexa+ connection model + in-app "Voice (Alexa+)" Settings card
- **Pulled the real Alexa+ ↔ MCP connection model** (Amazon dev docs, developer.amazon.com/docs/alexaplus/add-ons/):
  - You deploy an **add-on** (`alexa-ai deploy`) that sits between your MCP server and Alexa+. Our server already
    meets the contract: **Streamable HTTP, MCP spec 2025-11-25+, <500ms** round-trip.
  - **Connection = OAuth 2.1 account-linking** (auth-code + PKCE/S256), done **in the Alexa app** — enable the
    GrantHarbor add-on → scan QR / sign in → approve scopes → **Voice-ID gated**. Native app ⇒ app-to-app deep
    link can complete approval in GrantHarbor. **NOT automatic**, not primarily in the third-party app's settings.
  - Server production requirements (TODO): 401 w/o WWW-Authenticate, Protected Resource Metadata at RFC 9728
    well-known, OAuth server metadata at `/.well-known/oauth-authorization-server`, S256, `resource` param,
    Bearer in Authorization header. Not supported: DCR, CIMD, OIDC, step-up.
- **Built `components/AlexaConnect.tsx`** — a "Voice — Alexa+" card, wired into `pages/Settings.tsx` (after the
  account/notifications row). Shows the feature, connection status, a **Connect-with-Alexa** modal walking the
  real steps (enable add-on → sign in → approve), and the Voice-ID / no-auto-submit safety note. Makes the
  integration **visible in-app** (was backend-only).
- ✅ **VERIFIED visually** (dev:web, Settings page): the "Voice — Alexa+" card renders, the Connect modal shows
  the 4 real steps + OAuth note + "Open the Alexa app" deep-link, and "I've linked GrantHarbor" flips the
  status to "Connected to Alexa+". Renderer typechecks clean (tsc `-p tsconfig.web.json`, exit 0).
- **Production backend TODO:** implement the OAuth 2.1 account-linking endpoints on the MCP server + deploy the
  add-on via `alexa-ai`. (Demo path stays the simulated-Alexa web experience + file-token.)

### 2026-10-13 — Demo flow prepped (one-command runner + shot script)
- **`run-demo.ps1`**: one command brings up PocketBase, seeds Nexus Humanity Foundation + the USDA grant,
  starts the MCP server (**port-polled, no startup race**), runs the full apply loop, and leaves services up
  for the UI shots. `stop-demo.ps1` tears it down. Verified: loop fires clean (draft 14/17 → review → approve
  → Confirmation GH-75074C70 → replay refused).
- **`DEMO_SCRIPT.md`**: shot-by-shot <3-min runbook — hook → "Alexa, apply" → the autofill money-moment →
  review/approve → the safety beat (no auto-submit, no stored creds, single-use replay refused) → architecture
  close. Includes judging hooks (Alexa+ MCP keystone, AWS SES + open-source mini-challenges), the gated-Alexa
  simulated-web fallback, and a real-vs-simulated honesty list for the narration.
- Files: `mcp-server/run-demo.ps1`, `mcp-server/stop-demo.ps1`, `DEMO_SCRIPT.md`.

### 2026-10-13 — Fire-tablet layout pass (verified, no UI fixes needed)
- Ran the standalone renderer (`npm run dev:web -- --mode mobile`, port 5290) and inspected GrantHarbor at
  real Fire dimensions: **Fire HD 8 landscape 1280×800, Fire 7 landscape 1024×600, Fire 7 portrait 600×1024.**
- AppShell shows the desktop sidebar at ≥768px — content offset by `md:pl-56` exactly matching the sidebar's
  `w-56` (verified in the DOM: no element sits left of the 224px line, nothing clips) — and drops to the
  MobileNav bottom-tab bar below 768px. Stat cards reflow to a 2×2 grid in portrait. All 11 sidebar items fit
  the tightest 600px height with no overflow.
- **Finding: the responsive layout is ALREADY Fire-ready.** "Convert to Fire tablet" = the Amazon Appstore
  resubmit (APK is GMS-clean), NOT a UI rebuild. Only cosmetic nit: a donut legend label clips ~2px at exactly
  1024px width — not worth a change.
- Process note: first screenshot caught the sidebar mid-transition and *looked* clipped; DOM inspection + a
  settled screenshot proved the layout correct. Verified visually, not from one frame.

### 2026-10-12 — P3: review → approve → submit (the full loop closed)
- **`send_for_review`**: mints a single-use approval token (stores only its SHA-256 **hash**), emails the
  draft via a **pluggable mailer** (`mailer.ts`: file transport now → real AWS SES by flipping
  `GRANTHARBOR_SES=1` when the account lands), sets status ReadyForReview. Emails only the user, never a grantor.
- **`approve_and_submit`**: verifies the token against the stored hash, sets Submitted + submitted_at +
  confirmation_number, and **invalidates the token (single-use)**. Human is the legal submitter; the token
  stands in for the on-device biometric attestation (WebAuthn/Android BiometricPrompt drops in on mobile).
- Fixed the `project_title` mapping (short title, not the whole funding_purpose paragraph) — app-output quality.
- **✅ VERIFIED END-TO-END (live):** list_grants → draft_application (14/17) → send_for_review (file) → read
  token from the review email → approve_and_submit → "Confirmation GH-8B40A63E, token now spent" → a second
  approval correctly **REFUSED** (single-use). **The entire Alexa+ loop runs in software**, minus the voice
  front-end. Files: `mcp-server/src/mailer.ts` (new), `mcp-server/src/index.ts`, `mcp-server/call-draft.mjs`.
- **Remaining:** Alexa+ voice front-end (may be gated → simulated-web fallback) · real AWS SES swap (needs
  your AWS account) · real device biometrics (mobile) · Fire-tablet layout pass + Amazon resubmit · demo video.

### 2026-10-12 — P1: self-hosted MCP server (the Alexa+ keystone)
- **Built the self-hosted MCP server** — the piece the Alexa+ track requires the repo to *call at
  runtime*. New `mcp-server/` package: TypeScript, **Streamable HTTP transport** (MCP spec 2025-11-25+,
  via `@modelcontextprotocol/sdk`), session-managed, with a `/healthz` probe.
- **Two tools LIVE**, reading the user's real data from the GrantHarbor PocketBase (owner-scoped token):
  - `list_grants` — the user's tracked grants (optional status filter), phrased for Alexa to speak.
  - `get_deadlines` — upcoming deadlines, soonest first (optional `withinDays`).
- **Full tool surface registered as honest stubs** so Alexa+ sees everything from day one:
  `draft_application` + `preview` (P2), `send_for_review` (AWS SES, P3), `approve_and_submit`
  (biometric attestation, P3). Each stub returns a clear "coming in P2/P3", never a silent failure.
- **Safety baked in from the start:** human is always the legal submitter, no auto-submit, no stored
  portal creds, owner-scoped reads only. Apache-2.0 licensed (Open Source mini-challenge).
- Files: `mcp-server/package.json`, `mcp-server/tsconfig.json`, `mcp-server/src/index.ts`,
  `mcp-server/README.md`. Verified: npm install (exit 0), tsc build (exit 0), boots + `/healthz` 200.

### 2026-10-12 — P2: Applicant Profile → draft_application (real autofill)
- **Found the Applicant Profile already exists** — `application_profiles` collection (org name, EIN,
  business_type, address, mission, budget, executive_summary, funding_purpose…). So P2 was the *missing*
  half: the Application entity + real autofill, not rebuilding the profile.
- **New `applications` collection** (owner-scoped RLS) added to `setup-collections.mjs`: relations to a
  grant + the profile it was filled from; `status` (Drafting→NeedsInput→ReadyForReview→Approved→Submitted),
  `filled_fields`, `needs_input`, `draft_text`, `form_template`, + audit fields (approved_at, submitted_at,
  confirmation_number, approval_token_hash).
- **`draft_application` + `preview` are now REAL** (were stubs): draft_application reads the grant + the
  user's profile, maps them onto a representative **17-field federal grant form** (`federal-generic-v1`),
  computes filled-vs-needs-input, **saves an `applications` draft**, and returns a spoken summary
  ("I filled N of 17 fields… these still need your input: …"). `preview` returns the saved draft.
  Still no submission without approval (P3).
- Compiles green (tsc exit 0). Files: `pocketbase/setup-collections.mjs`, `mcp-server/src/index.ts`.
- **✅ VERIFIED END-TO-END (live):** brought up PocketBase → seeded **Nexus Humanity Foundation** as the
  demo applicant + the real USDA CFPCGP grant → started the MCP server with an owner-scoped token → a real
  **MCP client over Streamable HTTP** called `list_grants` → `draft_application` → `preview`. Result:
  *"I filled 14 of 17 fields from your profile. 3 still need your input: Detailed project budget, Project
  timeline, Measurable objectives."* The full drafted application rendered + saved as an `applications`
  record. The whole Alexa+ loop works bar the voice front-end + P3 tail. Demo scripts: `mcp-server/seed-demo.mjs`,
  `mcp-server/call-draft.mjs` (demo.json holds a throwaway local token — gitignore before commit).
- 🔧 Polish noted: `project_title` autofills from `funding_purpose` (too long for a title) and duplicates
  `statement_of_need` — tighten the field mapping before the demo video.
- **Next (P3):** `send_for_review` (AWS SES + single-use approval link) + `approve_and_submit` (biometric
  attestation). Then the Alexa+ skill wiring + the Fire-tablet layout pass (parallel).
