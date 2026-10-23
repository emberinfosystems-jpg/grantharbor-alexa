# GrantHarbor × Alexa+ — Demo Script (<3 min)

**Hackathon:** Build, Ship, Shape — Alexa+ track. **Entrant:** Ember Information Systems LLC.
**North star in one line:** *"A grant hits your list → 'Alexa, apply' → it's drafted from your profile,
emailed to you, and submitted the moment you approve — the same day it dropped."*

> 🎯 Judging discipline: **depth over breadth.** One grant, one profile, one form, the *whole* loop. Don't
> tour the app — tell the apply story end to end.

---

## Pre-flight (before you hit record)
```powershell
cd mcp-server
.\run-demo.ps1          # PocketBase + seed + MCP server + runs the loop once, leaves services up
```
Then, in the project root, for the UI shots:
```powershell
npm run dev:web -- --mode mobile    # http://127.0.0.1:5290  (tablet-size the window for the Fire look)
```
Stop after: `mcp-server\stop-demo.ps1`.

---

## The shots

**[0:00–0:20] The hook.** Open on the GrantHarbor dashboard (Fire-tablet size). *"This is GrantHarbor — it
tracks grants for small nonprofits. Our applicant is Nexus Humanity Foundation, a food-security charity.
A perfect-fit USDA grant just landed on their list — and normally, applying means hours of re-typing the
same org info into yet another form."*

**[0:20–0:45] The ask.** *"So we gave GrantHarbor a voice."* Say it: **"Alexa, apply for the USDA food
grant."** (Live Alexa+ if available; otherwise the simulated-Alexa web path — same MCP call underneath.)

**[0:45–1:30] The autofill — the money moment.** Cut to the loop output (from `run-demo.ps1`, or call it
live). Read the real line on screen:
> *"I filled **14 of 17 fields** from your profile. 3 still need your input: detailed budget, timeline,
> measurable objectives."*
*"It pulled the legal name, EIN, address, mission, the $400,000 ask, the whole project summary — straight
from the Applicant Profile — and it's honest about the 3 fields a human still has to write. No hallucinated
budget."*

**[1:30–2:05] Review + approve.** *"It doesn't submit anything. It emails the draft to you."* Show the
review email (the `outbox/*.eml` file, or the SES inbox once wired). *"You review it, and you approve on
your own device."* → the submit line:
> *"Approved and submitted. Confirmation GH-xxxx. You were the submitter — the approval is verified on your
> authorization, and that token is now spent."*

**[2:05–2:30] The safety beat (the part judges remember).** *"Three things we refuse to do: we never
auto-submit — a human approves every submission. We never store a grant-portal login. And the approval is
single-use —"* show the **replay getting refused** *"— so it can't be captured and reused."*

**[2:30–3:00] The architecture + close.** *"Under the hood it's a self-hosted MCP server over Streamable
HTTP — the same tools Alexa+ calls, running against the user's own data, local-first and owner-scoped.
Email is AWS SES; the MCP server is open-sourced, Apache-2.0."* Close on the dashboard: *"Grants found,
drafted, and submitted — by voice, the day they drop. That's GrantHarbor."*

---

## Talking points / judging hooks
- **Alexa+ track requirement met:** the repo calls a real self-hosted MCP server at runtime (`mcp-server/`),
  not just a README. 6 tools: `list_grants`, `get_deadlines`, `draft_application`, `preview`,
  `send_for_review`, `approve_and_submit`.
- **AWS Builder mini-challenge:** email via AWS SES (pluggable mailer — flip `GRANTHARBOR_SES=1`).
- **Open Source mini-challenge:** the MCP server is Apache-2.0 (`mcp-server/README.md`, license at top).
- **The real story:** Nexus Humanity Foundation applying to the *actual* USDA Community Food Projects grant —
  a true mission, not a toy.

## If live Alexa+ is gated
Demo the **simulated-Alexa web experience** (allowed by the rules). The MCP server, the autofill, the
review/approve/submit loop, and the security are all identical and real — only the voice front-end is
simulated. Say so plainly on camera; it's honest and it still shows the whole pattern.

## What's real vs. simulated (keep the narration honest)
- **Real:** MCP server, autofill from profile, saved application record, single-use approval, status
  transitions, confirmation number, owner-scoped data.
- **Stand-in for the demo:** the email transport is the file "outbox" until AWS SES is wired; the approval
  token stands in for the on-device biometric (WebAuthn / Android BiometricPrompt on the shipped mobile app).
