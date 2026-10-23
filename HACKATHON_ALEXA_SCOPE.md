# GrantHarbor × Alexa+ — Hackathon Scope
**Track:** Alexa+ (self-hosted MCP server, spec ≥ 2025-11-25, Streamable HTTP). **Stacks:** AWS Builder mini +
Open Source mini + friction logs (+10%). **North star flow:**

> **New grant hits your list → notification → "Alexa, apply" → autofilled draft from your profile → emailed to
> you for review → biometric-gated approval → submission-ready, same day.**

Discovery (exists) + autofill (new) + voice (new) + fast secure approval (new) = "applied the day it dropped."

---

## 1 · Architecture
- **Self-hosted MCP server** (new, in-window) — Streamable HTTP, MCP spec 2025-11-25+. Rides on the existing
  **PocketBase (Pro)** backend so it can reach the user's profile + grants server-side. (Free/local tier stays
  as-is; this is a **Pro flagship feature.**)
- **MCP tool surface:**
  - `list_grants` / `get_deadlines` — from existing discovery/ingest data.
  - `draft_application(grant_id)` — fill a grant application from the **Applicant Profile** (new entity).
  - `preview(app_id)` — return the completed draft for review.
  - `send_for_review(app_id, email)` — email the completed application to the user (see §3).
  - `approve_and_submit(app_id, approval_token)` — release to the submission channel. `approval_token` = the
    **biometric/PIN-gated approval attestation, NEVER a stored grant-portal credential** (see §4).
- **New data entities** (PocketBase collections): **Applicant Profile** (the "fill once" master record) +
  **Application** (a drafted/approved/submitted grant application, with status + audit trail).

## 2 · Alexa+ integration
- Alexa+ calls the MCP server's tools. Owner-only via **Alexa Voice ID** (native).
- Repo must **call the MCP at runtime in code** (loaded MCP config / entry point), not just README — required.
- Fallback allowed by rules: a **simulated Alexa+ web experience** if the live Alexa+ path is gated — but we're
  building the real self-hosted MCP; keep the sim as a backup demo only.

## 3 · Email push + return  🛑 (email is currently DISABLED — must wire a real transport)
- **Outbound (push):** wire **AWS SES** as the email transport (replaces the disabled PocketBase SMTP). SES =
  also the **AWS Builder mini-challenge** qualifier. `send_for_review` renders the completed application (PDF +
  summary of filled/needs-input fields) and emails it to the user. Disclose SES as a subprocessor (§5).
- **Return (approval):** the review email contains a **tokenized approval link** → opens the approval surface →
  **biometric/PIN gate** → on success calls `approve_and_submit`. The token is single-use, short-lived, scoped
  to that one application. (No "reply-to-approve" — too weak for a legal submission.)
- **Delivery to the grantor is grant-dependent:** email-submission where the grantor accepts it; otherwise the
  approval produces a completed package + a pre-filled portal handoff the human clicks. **For the demo:** a
  clean voice → draft → email → biometric-approve → submit-to-endpoint flow shows the whole pattern.

## 4 · Approval / auth  🛑 (defensible or it doesn't ship)
- **Primary: native device biometrics** — WebAuthn/passkeys + Android BiometricPrompt + **Alexa Voice ID**. The
  app never sees or stores a secret; the device attests "authorized human approved." Strongest *and* cleanest.
- **Fallback (no-biometric devices only): one user-CHOSEN PIN/passphrase.** 🛑 NOT derived from public info
  (last name, etc.) — that lowers entropy while feeling secure. A real secret the user sets.
- 🛑 **The human is always the legal submitter.** No unattended auto-submit. No stored grant-portal logins. This
  is required by the Extraction Anti-Pattern Gate + "can we defend this."

## 5 · Legal compliance  🛑 (pages don't exist yet — CREATE them, accurate to what we do)
Create **Privacy Policy + Terms of Service + Support** (per the legal ship-gate, [[mem_legal]]). Must state
**exactly** what we do / don't do:
- **Local-first**; user data exportable + deletable; **we do NOT sell/share personal data.**
- **Voice via Alexa+ MCP** — what Alexa/Amazon receives; owner-gated by Voice ID.
- **Email push** — completed applications are emailed to the user **for their review**; sent via **AWS SES**
  (subprocessor).
- **Autofill** — profile data is used only to fill the user's own applications.
- **Biometrics** — used only for on-device approval; **the biometric never leaves the device and is never
  stored by us.**
- 🛑 **We NEVER auto-submit** a grant application — a human reviews and approves every submission.
- **Subprocessors list:** Amazon/Alexa, AWS SES, AWS (if Bedrock/other used), PocketBase host.
- Run the ship-gates: check-legal / subprocessor-oracle / attributions.

## 6 · Mini-challenge stacking
- **AWS Builder** ($5K + $5K credits): SES for email; optionally **Bedrock** for smart field-mapping in
  `draft_application` (profile → grant-form fields). Document the integrations.
- **Open Source** ($5K + $5K credits): open-source the **MCP server** repo (MIT/Apache, license at repo top).
  On-ethos (the genome wants to be shared).
- **Friction logs** (+10%): log every Alexa+/MCP/SES onboarding friction as we build — our reflex anyway.

## 7 · Phased plan (Aug 31 → Oct 23) + demo scope
- **P1 (wk 1–2):** MCP server skeleton (Streamable HTTP, spec 2025-11-25+, `list_grants`/`get_deadlines` over
  existing data). Applicant Profile + Application entities in PocketBase.
- **P2 (wk 3–4):** `draft_application` autofill (start with **ONE representative grant form** — scope tight);
  `preview`. AWS SES wired; `send_for_review` emails the draft.
- **P3 (wk 5–6):** approval return (tokenized link → biometric/PIN gate → `approve_and_submit`); Alexa+ Voice ID
  owner-gating; submit-to-endpoint.
- **P4 (wk 7):** legal pages created + ship-gates; open-source the MCP repo; polish.
- **P5 (wk 8, by Oct 23):** <3-min demo video (lead with the "apply the day it drops" flow), README + setup,
  product feedback + friction logs, submit.
- 🎯 **Demo scope discipline:** one grant → one profile → one form → the full voice→email→biometric→submit loop.
  Depth beats breadth (judging rewards a complete, coherent experience).

## 🛑 Guardrails (carry into every commit)
No auto-submit · human is legal submitter · no stored portal creds · biometric never leaves device · email push
only *to the user for review* · every in-window change logged in `HACKATHON_WORKLOG.md`.
