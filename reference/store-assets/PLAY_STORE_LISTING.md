# GrantHarbor — Google Play store listing (Misleading-Claims fix, vc4)

## Why this exists
2026-09-15/16: Google **REJECTED** the GrantHarbor production submission under the **Misleading Claims** policy —
"Missing Source Link for Government Information." The app surfaces government grant info but the listing lacked
(a) a clear official .gov source link and (b) a "we don't represent the government" disclaimer. We have NO
government affiliation → we take the **add-sources-+-disclaimer** path (NOT the appeal path).

**Fix applied on 3 surfaces (so no second rejection):**
1. **Store description** — the revised full description below (adds a visible disclaimer up top + a "Where the
   information comes from" section with both official .gov URLs).
2. **In-app Home page** (`Dashboard.tsx`) — a footer with the same not-affiliated disclaimer + both source links
   (renders on desktop + mobile; verified on-screen).
3. **Legal / Terms** (`Legal.tsx` + `tools/export-legal-md.mjs`) — new "Government Information & Sources" addendum
   (disclaimer + Grants.gov + USASpending.gov). Also fixed a latent accuracy gap: legal said "one external
   service" but the app also calls **USASpending.gov** (award precedent) → now names both. Legal bumped to v1.2.

Sources cited (the two official U.S. gov data sources GrantHarbor actually uses, verified in code):
- **Grants.gov** — https://www.grants.gov (federal grant opportunities; `api.grants.gov`, each opp links to `grants.gov/search-results-detail/{id}`)
- **USASpending.gov** — https://www.usaspending.gov (federal award / precedent data)

---

## Full description (paste into Play Console → Main store listing → Full description)

```
Stop hunting for grants. Let GrantHarbor bring them to you.

GrantHarbor helps small businesses and nonprofits find the government grants they're eligible for and keep every application on track — all from your own device, with nothing to sign up for and nothing to hand over.

DISCLAIMER: GrantHarbor is an independent app. It is not affiliated with, endorsed by, or sponsored by the U.S. government, Grants.gov, USASpending.gov, or any government agency, and it does not represent any government entity. GrantHarbor does not submit applications and does not guarantee funding — all grant awards are decided solely by the respective government agencies.

What you get:
• One place for your whole funding pipeline — grants, applications, deadlines, and the dollars you're tracking
• Deadline reminders at 14, 7, 3, and 1 days, so nothing slips
• Manual import of opportunities you already know about
• Investor and approved-sender lists to keep outreach organized
• A clear funding overview and calendar

Pro adds an ingestion agent (optional subscription):
• Scans open federal opportunities from Grants.gov and surfaces the ones that match what you do
• Matches them against your keywords right on your device — your keywords never leave it
• Shows who has won similar funding before, drawn from public federal award data
• Alerts you when it finds a match, with bulk import and automatic de-duplication

Where the information comes from:
GrantHarbor surfaces public U.S. government information from official sources, and you can verify every one directly:
• Federal grant opportunities — Grants.gov — https://www.grants.gov
• Federal award and precedent data — USASpending.gov — https://www.usaspending.gov
Every opportunity links back to its official Grants.gov listing so you can read and apply at the source.

Private by design: GrantHarbor is local-first. Your grants, notes, and business details live on your device, not on our servers — there's nothing for us to sell, share, or lose. No ads. No tracking. No account required to use it.

Honest about what it is: GrantHarbor helps you find and organize opportunities. It does not submit applications for you, and it does not guarantee funding — it surfaces the grants worth pursuing and makes sure you never miss a deadline.

GrantHarbor is a one-time purchase. The ingestion agent is a separate monthly add-on you can cancel anytime — cancelling keeps the app, it just stops the agent.
```

---

## Resubmission checklist (Scott, in Play Console)
1. **Main store listing → Full description** → paste the block above → Save.
2. **Production → Create new release** → upload `Downloads/GrantHarbor-v1.1-vc4-play-release.aab` (versionCode **4**, versionName 1.1, signed EIS upload key, jar verified). vc3 was burned by the rejected submission → vc4 is required.
3. Release notes (optional): "Added source citations and clearer disclaimers for the government grant data."
4. **Send for review.**
5. Ani: republish the hosted legal pages from the regenerated `legal/privacy-policy.md` / `terms-of-service.md` (v1.2, now carry the Sources section) so the linked privacy URL matches the app.

AAB staged: `Downloads/GrantHarbor-v1.1-vc4-play-release.aab` (4.68 MB).
