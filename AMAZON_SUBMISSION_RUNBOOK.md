# GrantHarbor → Amazon Appstore — Submission Runbook

> 🛑 **UPDATE 2026-09-04 — READ THIS FIRST. The "free-first" plan below is SUPERSEDED.**
> What actually shipped: a **$16.99 one-time PAID app** (the full tracker). The free "one-page manual"
> tier described below **does not exist yet** — do not treat this doc's free-launch framing as reality.
>
> **Amazon DENIED the first submission** — "app price is unreasonably high" (their Listing & Promotion
> Policy, which rejects an app that *lists IAP prices in-app* **or** *has an unreasonably high list price* —
> the first submission hit BOTH). **Root cause:** the APK was built in the WRONG Vite mode (`pocketbase`,
> the desktop/tester env) instead of `mobile`, so the desktop nav shipped — including the **Upgrade page
> ($16.99 + $19/mo Pro + an off-store checkout)** and the **Discover** agent upsell. A phone can't deliver
> Pro (the ingestion agent needs the desktop bridge), so the app was advertising a subscription it can't honor.
>
> **Fix (done 2026-09-04):** in `App.tsx`, the `local` (mobile) build now filters `upgrade` + `discover`
> out of the nav. And the mobile build is now `npm run build:mobile` / `npm run apk`, which FORCE
> `--mode mobile` (→ `.env.mobile` `VITE_DB_BACKEND=local` → `LOCAL_MODE`) and pin `outDir=dist-web`.
> 🛑 **NEVER build the mobile APK any other way** — a bare `vite build` ships the Pro surfaces and Amazon
> rejects it again. Clean signed APK: `reference/store-assets/amazon-final/GrantHarbor-v1.0-mobile-noPro-*.apk`.
>
> **Pricing is NOT the fix** — $14.99 vs $16.99 won't move Amazon's fuzzy "high price" call; the IAP-price
> listing was the real trigger and it's gone. If a reviewer still flags price, APPEAL with the comparison:
> every grant competitor charges $14.99–$400 **per month** (Submittable $14.99/mo, Grantseeker $57/mo,
> Instrumentl ~$162/mo, GrantHub $995/yr) — GrantHarbor is **$16.99 once.** Google Play (DUNS now in hand)
> is the friendlier home for a paid-upfront app; run it in parallel.

**Goal:** shortest path to "store available." App = `com.emberinfo.grantharbor` v1.0, **$16.99 one-time**,
ships under Ember Information Systems LLC (no DUNS needed for Amazon). Add Pro (desktop) + Google Play later.

## STATUS — what's ready vs. what's needed
- ✅ **GMS-clean** — no Google Play Services / Firebase / Play-Billing. Runs on Fire/Amazon devices, no refactor.
- ✅ **Icon** — `build-assets/icon.png` is 512×512 (exactly what Amazon wants).
- ✅ Android project builds via `android/gradlew`; signing config wired to `keystore.properties`.
- 🛑 **THREE gates before submit** (details below): (1) launch-build hardening, (2) a release keystore,
  (3) at least 3 screenshots (only 1 exists today).

---

## 🛑 THE ONE SNAG — don't upload the tester build
`capacitor.config.ts` currently has **`cleartext: true` + `allowMixedContent: true`** — TESTER-ONLY hacks so
the app can reach PocketBase (Pro sync) on Luke over plain HTTP on the tailnet (`100.84.185.50:8090`). That
backend is **not publicly reachable**, so on an Amazon user's device Pro login would fail *and* app-wide
cleartext is not launch-quality.
**Fix = launch the FREE tier standalone:** strip those two flags, and make sure the free local-first tracker
(IndexedDB, no account, offline) works with the Pro/sync path disabled or hidden. Pro comes back later once
PocketBase is on a public **HTTPS** host. This is the real "time-to-store" task and it's modest.

---

## PART A — one-time setup (YOU, ~20 min; needs your secrets)
1. **Amazon Developer account** — https://developer.amazon.com → register as **Ember Information Systems LLC**.
   Free, no DUNS. Add tax/banking info only when you turn on Pro/paid (not needed for the free launch).
2. **Create the release keystore** (your passwords — store them in the Phoenix Vault, never in git):
   ```bash
   keytool -genkey -v -keystore android/grantharbor-release.keystore -alias grantharbor \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
   Then copy `android/keystore.properties.template` → `android/keystore.properties` and fill in the path +
   the passwords/alias you just set. (Git-ignored; the build auto-uses it for `assembleRelease`.)

## PART B — the launch build (ME, on your go)
3. Harden: remove `cleartext`/`allowMixedContent`; verify the free tier stands alone (Pro path hidden/gated).
4. Build the signed release APK:
   ```bash
   npm run build:web   # produce dist-web
   npx cap sync android
   cd android && ./gradlew assembleRelease
   # -> android/app/build/outputs/apk/release/app-release.apk  (this is what you upload)
   ```

## PART C — the listing (ME = copy below; YOU = paste + upload)
5. **Category:** Business (secondary: Productivity). **Content rating:** all "no" → clean/Everyone.
6. **Assets:** icon 512×512 ✅ · **need ≥3 screenshots** (you have 1: the dashboard). Capture 3–5 from the
   running app (dashboard, a grant detail, add-grant, reports) — phone + a Fire-tablet size if easy.
7. **Upload** the `-noPro` APK, set price **$16.99 one-time**, submit. Amazon tests on Fire devices; a
   GMS-free local-first app passes cleanly. 🛑 Upload ONLY an APK built via `npm run apk` (mode=mobile) —
   a desktop-mode APK re-triggers the price/IAP denial. Review is typically a few days.

## PART D — after it's live
Reviews + the "on Amazon" credibility start accruing immediately. Then: add **Pro** (Amazon IAP or a web-Stripe
subscription once PocketBase is on public HTTPS), and add the **Google Play** listing when DUNS lands — as a
*discovery layer on top*, never a dependency.

---

## READY-TO-PASTE LISTING COPY (GrantHarbor — reassuring-precision voice)

**Title (≤50):** GrantHarbor — Grant Tracker for Small Orgs

**Short description (≤80):** A calm grant tracker for small nonprofits and founders. Honest, local-first.

**Long description:**
> GrantHarbor is a calm, honest grant tracker built for the 1–3 person nonprofit or founder chasing grants —
> not for a grants department. Track every opportunity, deadline, and requirement in one simple place, with one
> clear action per screen so you're productive on day one.
>
> **Why GrantHarbor is different:**
> • **Honest pricing** — a genuinely useful free tier. You pay only if you want the automation, never to keep
>   using your own data.
> • **Local-first & private** — your grant pipeline lives on your device. Exportable, deletable, yours. No
>   data lock-in, ever.
> • **No enterprise bloat** — reports and reminders sized for a small shop, not a corporation.
> • **Deadlines that don't slip** — the alerts that matter, without the notification spam.
>
> Built by Ember Information Systems on a simple promise: if a feature makes the app worse for you, it doesn't
> ship. Track your grants. Keep your data. Never miss a deadline.

**Feature bullets (store "highlights"):**
- Simple grant & deadline tracking, one action per screen
- Local-first: your data stays on your device, fully exportable
- Honest free tier — no paywall on your own records
- Deadline & match reminders, no spam
- Clean reports for a 1–3 person team

**Keywords/search terms:** grant tracker, grants, nonprofit, deadline tracker, funding, grant management,
nonprofit tools, small business grants, grant deadlines, fundraising

🛑 Naming note: source `DIFFERENTIATORS.md` says "GrantGuard" (pre-rename) — canonical is **GrantHarbor**
(matches appId/appName). Use GrantHarbor everywhere.
