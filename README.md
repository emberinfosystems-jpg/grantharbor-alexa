# GrantHarbor × Alexa+

**Apply for a grant by voice, the day it drops.** An [Amazon Developer Hackathon — Build, Ship, Shape](https://amazonappdev2026.devpost.com/) entry by **Ember Information Systems LLC**.

- **Primary track:** Alexa+ — a self-hosted **MCP server** (Streamable HTTP, spec 2025-11-25+) that Alexa+ calls at runtime.
- **Mini challenges:** **AWS Builder** (email via Amazon SES) · **Open Source** (the MCP server, Apache-2.0 — see `LICENSE`).

GrantHarbor is a calm, local-first grant tracker for the 1–3 person nonprofit or founder. For the hackathon we gave it a voice: say *"Alexa, apply for the USDA food grant"* and it drafts the application from your Applicant Profile, emails you the draft, and submits it **only when you approve** — human-in-the-loop, single-use, replay-safe.

## The Alexa+ integration (`mcp-server/`)
A self-hosted MCP server exposing six tools over Streamable HTTP, reading the user's own owner-scoped PocketBase:
`list_grants` · `get_deadlines` · `draft_application` · `preview` · `send_for_review` · `approve_and_submit`

**Safety by design:** never auto-submits (a human approves every submission), never stores a grant-portal login, and every approval token is single-use (a replay is refused).

## Run the demo
Requires Node 20+ and PowerShell on Windows.
```powershell
cd mcp-server
.\run-demo.ps1      # starts PocketBase, seeds Nexus Humanity Foundation + the USDA grant,
                    # starts the MCP server (:3700), and runs the full apply loop once
```
Then, for the UI (optional, in the project root):
```powershell
npm install
npm run dev:web -- --mode mobile   # http://127.0.0.1:5290
```
Stop everything: `mcp-server\stop-demo.ps1`.

## What was built during the hackathon window
GrantHarbor existed before Aug 31, 2026; the Alexa+ voice layer was built in-window. Full dated record: **`HACKATHON_WORKLOG.md`**. Demo script: **`DEMO_SCRIPT.md`**.

## License
Apache-2.0 — see `LICENSE`. © 2026 Ember Information Systems LLC.
