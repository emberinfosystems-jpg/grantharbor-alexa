# GrantHarbor — Devpost submission packet (paste-ready)

**Hackathon:** Build, Ship, Shape — Amazon Developer Hackathon · **Deadline: 2026-10-23**
**Entrant:** Ember Information Systems LLC · **Primary track: Alexa+** · **Mini-challenges: AWS Builder + Open Source**

---

## Tracks & mini-challenges
- **Primary track:** Alexa+ (self-hosted MCP server, spec 2025-11-25+, Streamable HTTP)
- **Mini — AWS Builder:** email via AWS SES (pluggable mailer)
- **Mini — Open Source:** the MCP server, Apache-2.0

## Project name & tagline
**GrantHarbor — apply for a grant by voice, the day it drops.**
A grant hits your list → "Alexa, apply" → it's drafted from your profile, emailed to you, and submitted the moment you approve.

## What it does (description)
GrantHarbor is a calm, local-first grant tracker for the 1–3 person nonprofit or founder — not a grants department. For the hackathon we gave it a voice: a self-hosted **MCP server** that Alexa+ calls at runtime so you can run the entire grant-application loop hands-free.

Say "Alexa, apply for the USDA food grant." GrantHarbor:
1. **Drafts the application** — pulls your legal name, EIN, address, mission, budget ask, and project summary straight from your Applicant Profile onto a representative 17-field federal form. It fills what it can and is **honest about what it can't**: *"I filled 14 of 17 fields. 3 still need your input: detailed budget, timeline, measurable objectives."* No hallucinated numbers.
2. **Emails you the draft** (AWS SES) — it never submits anything on its own.
3. **Submits only when you approve** — approval is single-use and verified on your authorization; the human is always the legal submitter.

## How it works (tech)
- **Self-hosted MCP server** (`mcp-server/`, TypeScript, `@modelcontextprotocol/sdk`, **Streamable HTTP, MCP spec 2025-11-25+**, session-managed, `/healthz`). Six tools Alexa+ calls: `list_grants`, `get_deadlines`, `draft_application`, `preview`, `send_for_review`, `approve_and_submit`.
- **Data:** the user's own GrantHarbor PocketBase, **owner-scoped** token — reads only that user's grants/profile.
- **Email:** AWS SES via a pluggable mailer (file transport for the demo, real SES by flipping `GRANTHARBOR_SES=1`).
- **Alexa+ connection:** OAuth 2.1 account-linking (auth-code + PKCE/S256), Voice-ID gated, surfaced in-app via the "Voice — Alexa+" Settings card.
- **App:** Electron + React + PocketBase; Capacitor Android build (GMS-clean, ships to Amazon Appstore).

## Safety (the part judges remember)
Three refusals, by design: **never auto-submit** (a human approves every submission) · **never store a grant-portal login** · **single-use approval** (the token is spent on use; a replay is refused). Owner-scoped reads only.

## What we built/changed DURING the window (required for existing projects)
Baseline on Aug 31: the local-first tracker + grant discovery existed. **Built entirely in-window:**
- The **self-hosted MCP server** + all six tools (there was **no MCP server** before).
- **Applicant Profile → `draft_application` autofill** onto a 17-field federal form; the new `applications` collection (owner-scoped RLS, status machine, audit fields).
- **`send_for_review` + `approve_and_submit`** — single-use hashed approval token, pluggable SES mailer.
- **AWS SES** mailer integration (AWS Builder mini).
- The in-app **"Voice — Alexa+" connection card** (`AlexaConnect.tsx`) + the real OAuth 2.1 account-linking model.
- **Legal pages** (Privacy/ToS/Support, Force-Majeure + Connectivity-&-Consent clauses), **email transport**, **applicant-profile/application entities** — all created in-window.
- Fire-tablet layout verification + Amazon Appstore resubmit prep.
*(Full dated record: `HACKATHON_WORKLOG.md`.)*

## Repo (ACTION — Scott's hands)
- Repo URL: `________` (grantguard-desktop pushed to GitHub).
- 🛑 Make it **PRIVATE**, then add these 5 reviewers as collaborators (invites expire in 7 days — add at submit time):
  `knmeiss`, `giolaq`, `anishamalde`, `mosesroth`, `emersonsklar`
- Repo must contain the `mcp-server/` source (the Alexa+ tech called at runtime) + run instructions (`mcp-server/run-demo.ps1`, `README.md`).

## Open Source mini — required fields
- **Repo URL:** `________`  · **GitHub username:** `________`
- **Contribution:** the `mcp-server/` package — a self-hosted MCP server for voice-driven grant application, **Apache-2.0** (license at `mcp-server/` top). New open-source project shipped during the window.
- **What/how/why:** exposes six grant-workflow tools over Streamable-HTTP MCP so any MCP client (Alexa+) can run the apply loop against a user's own data; it matters because it lets small nonprofits apply the day a grant drops, with a human-approved, replay-safe submission.

## AWS Builder mini — required fields
- **AWS services used:** Amazon SES (transactional email for the draft-review step), via a pluggable mailer (`mailer.ts`) that flips from file transport to SES with `GRANTHARBOR_SES=1`.

## Product feedback (honest — judges read this)
- **Alexa+ / MCP:** The MCP-as-the-integration-surface model is excellent — building to the open spec (Streamable HTTP, 2025-11-25+) meant our server is portable, not Alexa-locked. The <500ms round-trip contract is reasonable. **Needs work:** the OAuth 2.1 account-linking requirements (Protected Resource Metadata at RFC 9728 well-known, OAuth server metadata, S256, no DCR/OIDC/step-up) are scattered across docs; one consolidated "MCP server production checklist" would have saved hours. Would build with it again: yes.
- **AWS SES:** clean, well-documented, the pluggable-mailer pattern made it a one-flag swap. Onboarding smooth.

## Friction log (optional — up to 10% judging bonus)
1. **Task:** wire Alexa+ account-linking. **Expected:** one auth doc. **Actual:** OAuth 2.1 requirements (PKCE/S256, RFC 9728 Protected Resource Metadata, `/.well-known/oauth-authorization-server`, `resource` param, unsupported: DCR/CIMD/OIDC/step-up) spread across pages. **Severity:** medium. **Workaround:** demo via the allowed simulated-Alexa web path; real linking is a backend follow-up. **Suggestion:** ship a single copy-paste MCP-server OAuth checklist + a conformance probe.
2. **Task:** confirm "demo-ready" for a gated capability (live Alexa+ in Preview). **Expected:** clear guidance. **Actual:** the simulated-web path is allowed but it took reading the rules closely to confirm. **Severity:** low. **Suggestion:** state the simulated-path allowance prominently in the Alexa+ track quickstart.

## Demo video
- Link: `________` (YouTube/Vimeo, PUBLIC, English, **under 3:00**). Script: `DEMO_SCRIPT.md`.
- Honesty note in-narration: MCP server + autofill + approve/submit loop are **real**; the email is a file "outbox" stand-in for SES, and the voice front-end is the allowed **simulated-Alexa web** path.
