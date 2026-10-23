# GrantHarbor Alexa+ MCP Server

**License: Apache-2.0** — open-source, per the Build-Ship-Shape *Open Source* mini-challenge. The genome
wants to be shared.

A self-hosted [Model Context Protocol](https://modelcontextprotocol.io) server that exposes a user's
GrantHarbor data as MCP tools over **Streamable HTTP** (spec 2025-11-25+). It's what lets **Alexa+** run
GrantHarbor's north-star loop by voice:

> new grant on your list → *"Alexa, apply"* → autofilled draft from your profile → emailed to you for
> review → biometric-gated approval → submission-ready.

## Tool surface
| Tool | Phase | What it does |
|---|---|---|
| `list_grants` | **live** | List the user's tracked grants (optional status filter), phrased for Alexa to read aloud. |
| `get_deadlines` | **live** | Upcoming deadlines, soonest first (optional `withinDays`). |
| `draft_application` | P2 | Autofill an application for a grant from the Applicant Profile. *(stub)* |
| `preview` | P2 | Return the completed draft for review. *(stub)* |
| `send_for_review` | P3 | Email the draft to the user via **AWS SES** with a single-use approval link. *(stub)* |
| `approve_and_submit` | P3 | Release to the submission channel after on-device biometric approval. *(stub)* |

The P2/P3 tools are **registered now as honest stubs** so Alexa+ sees the whole surface from day one;
each returns a clear "coming in P2/P3" message instead of failing silently.

## Run it
```bash
cd mcp-server
npm install
# point it at the GrantHarbor PocketBase (Pro backend) and give it an owner-scoped token:
#   GRANTHARBOR_PB_URL    (default http://127.0.0.1:8090)
#   GRANTHARBOR_PB_TOKEN  (a logged-in user's auth token — owner-scoped, never an admin key)
#   GRANTHARBOR_MCP_PORT  (default 3700)
npm run dev        # tsx watch (dev)   —or—   npm run build && npm start
```
MCP endpoint: `http://127.0.0.1:3700/mcp` · health probe: `GET /healthz`.

## How Alexa+ connects
Alexa+ calls this server's tools over Streamable HTTP, owner-gated by **Alexa Voice ID** (only the
account holder can invoke it). The repo calls the MCP at runtime (this server IS the runtime), satisfying
the Alexa+ track's "call the MCP in code, not just the README" rule.

## 🛑 Safety invariants (carried from `../HACKATHON_ALEXA_SCOPE.md`)
- **The human is always the legal submitter.** No unattended auto-submit, ever.
- **No stored grant-portal credentials.** `approve_and_submit` takes a single-use biometric/PIN
  attestation token — never a portal login.
- **Owner-scoped only.** The server reads the user's own grants/profile via an owner-scoped PocketBase
  token (RLS), and transmits nothing about the user to any third party beyond the user's own review email.
- **Email goes only to the user**, for review — never to a grantor.
