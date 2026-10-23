/**
 * GrantHarbor Alexa+ MCP server — the hackathon keystone.
 *
 * The Build-Ship-Shape (Alexa+ track) rules require the repo to CALL an MCP server at runtime,
 * not just describe one. This is that server. It exposes a user's GrantHarbor data as MCP tools
 * over Streamable HTTP (spec 2025-11-25+, provided by @modelcontextprotocol/sdk), so Alexa+ can
 * run the north-star loop:
 *
 *     new grant on your list → "Alexa, apply" → autofilled draft from your profile
 *     → emailed to you for review → biometric-gated approval → submission-ready.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🛑 PHASING (so the tool SURFACE is complete for Alexa+ from day one, even where the
 *    IMPLEMENTATION is still landing):
 *   P1 (THIS FILE, live now):  list_grants · get_deadlines   — read the user's real data.
 *   P2 (next):                 draft_application · preview    — Applicant Profile → one form.
 *   P3 (after):                send_for_review (AWS SES) · approve_and_submit (biometric token).
 * The P2/P3 tools are registered as honest stubs: Alexa+ sees the whole surface, and each stub
 * returns a clear "not yet implemented" instead of a silent failure.
 *
 * 🛑 AUTH / PRIVACY: the server reaches the user's OWN grants/profile in PocketBase server-side,
 *    scoped by the auth token in GRANTHARBOR_PB_TOKEN (owner-scoped RLS, same as the app). It never
 *    holds a grant-portal credential and never auto-submits — the human is always the legal submitter
 *    (approve_and_submit takes a biometric/PIN attestation token, never a stored portal login).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import express, { type Request, type Response } from "express";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { sendMail } from "./mailer.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import PocketBase from "pocketbase";

const PB_URL = process.env.GRANTHARBOR_PB_URL ?? "http://127.0.0.1:8090";
const PB_TOKEN = process.env.GRANTHARBOR_PB_TOKEN ?? "";
const PORT = Number(process.env.GRANTHARBOR_MCP_PORT ?? 3700);

/** A fresh PocketBase client per call — a rotated/expired token never sticks across requests. */
function pb(): PocketBase {
  const client = new PocketBase(PB_URL);
  // record-auth token saved with a null model: we only need it on the Authorization header.
  if (PB_TOKEN) client.authStore.save(PB_TOKEN, null);
  return client;
}

/** Money/date formatting kept voice-friendly — Alexa reads these aloud. */
function speakMoney(n: unknown): string {
  const v = Number(n) || 0;
  if (!v) return "an unspecified amount";
  return `$${v.toLocaleString("en-US")}`;
}
function speakDate(iso: unknown): string {
  const s = String(iso ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "no set deadline";
  const d = new Date(`${s}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
function daysUntil(iso: unknown): number | null {
  const s = String(iso ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const then = new Date(`${s}T00:00:00`).getTime();
  const now = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00").getTime();
  return Math.round((then - now) / 86_400_000);
}

interface GrantRecord {
  id: string;
  title?: string;
  funding_amount?: number;
  deadline?: string;
  source_agency?: string;
  status?: string;
}

interface ProfileRecord {
  id: string;
  business_name?: string;
  applicant_name?: string;
  email?: string;
  phone?: string;
  business_type?: string;
  ein?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  mission_statement?: string;
  funding_needed?: number;
  funding_purpose?: string;
  executive_summary?: string;
  annual_revenue?: number;
  years_in_business?: number;
}

/**
 * A representative federal grant-application form. Each field knows how to autofill itself from the
 * user's Applicant Profile (+ the grant); required fields with no source land in "needs your input".
 * ONE form, scoped tight — depth over breadth, per the hackathon demo discipline.
 */
const APPLICATION_FORM: Array<{ key: string; label: string; required: boolean; fill: (g: GrantRecord, p: ProfileRecord) => string | number | undefined }> = [
  { key: "applicant_legal_name", label: "Applicant legal name", required: true, fill: (_g, p) => p.business_name || p.applicant_name },
  { key: "ein", label: "EIN / tax ID", required: true, fill: (_g, p) => p.ein },
  { key: "organization_type", label: "Organization type", required: true, fill: (_g, p) => p.business_type },
  { key: "mailing_address", label: "Mailing address", required: true, fill: (_g, p) => [p.address, p.city, p.state, p.zip_code].filter(Boolean).join(", ") || undefined },
  { key: "authorized_contact", label: "Authorized contact", required: true, fill: (_g, p) => p.applicant_name },
  { key: "contact_email", label: "Contact email", required: true, fill: (_g, p) => p.email },
  { key: "contact_phone", label: "Contact phone", required: false, fill: (_g, p) => p.phone },
  { key: "project_title", label: "Project title", required: true, fill: (_g, p) => {
      const fp = (p.funding_purpose ?? "").trim();
      if (fp) return fp.split(/\s[—–-]\s/)[0].trim().slice(0, 80); // short title, not the whole paragraph
      return p.business_name ? `${p.business_name} project` : undefined;
    } },
  { key: "funding_requested", label: "Funding requested", required: true, fill: (g, p) => p.funding_needed || g.funding_amount },
  { key: "project_summary", label: "Project summary", required: true, fill: (_g, p) => p.executive_summary || p.mission_statement },
  { key: "statement_of_need", label: "Statement of need", required: true, fill: (_g, p) => p.funding_purpose },
  { key: "organization_mission", label: "Organization mission", required: false, fill: (_g, p) => p.mission_statement },
  { key: "annual_operating_budget", label: "Annual operating budget", required: false, fill: (_g, p) => p.annual_revenue },
  { key: "years_in_operation", label: "Years in operation", required: false, fill: (_g, p) => p.years_in_business },
  { key: "project_budget_detail", label: "Detailed project budget", required: true, fill: () => undefined },
  { key: "project_timeline", label: "Project timeline", required: true, fill: () => undefined },
  { key: "measurable_objectives", label: "Measurable objectives", required: true, fill: () => undefined }
];
const FORM_TEMPLATE_ID = "federal-generic-v1";

/** Resolve the owner user id to stamp on writes (owner-scoped RLS). */
async function ownerId(client: PocketBase): Promise<string> {
  if (process.env.GRANTHARBOR_USER_ID) return process.env.GRANTHARBOR_USER_ID;
  const res: any = await client.collection("users").authRefresh();
  const id = res?.record?.id ?? (client.authStore as any)?.record?.id ?? (client.authStore as any)?.model?.id;
  if (!id) throw new Error("no-owner");
  return id;
}

/** Render the filled form into a readable application draft. */
function renderDraft(grantTitle: string, filled: Record<string, string | number>, needs: string[]): string {
  const lines = [`DRAFT APPLICATION — ${grantTitle}`, ""];
  for (const f of APPLICATION_FORM) {
    if (f.key in filled) lines.push(`${f.label}: ${filled[f.key]}`);
  }
  if (needs.length) {
    lines.push("", "— Still needs your input —");
    for (const n of needs) lines.push(`• ${n}`);
  }
  return lines.join("\n");
}

/** Build a fresh MCP server instance (one per session). */
function buildServer(): McpServer {
  const server = new McpServer({ name: "grantharbor", version: "0.1.0" });

  // ── P1 · list_grants ──────────────────────────────────────────────────────
  server.tool(
    "list_grants",
    "List the grants on the user's GrantHarbor tracker. Optionally filter by status " +
      "(e.g. New, Applied, Submitted). Returns titles, funding amounts, agencies and deadlines, " +
      "phrased for the user to hear.",
    {
      status: z.string().optional().describe("Filter to grants with this status, e.g. 'New'."),
      limit: z.number().int().min(1).max(50).optional().describe("Max grants to return (default 10).")
    },
    async ({ status, limit }) => {
      const take = limit ?? 10;
      try {
        const filter = status ? `status = ${JSON.stringify(status)}` : "";
        const rows = await pb().collection("grants").getList<GrantRecord>(1, take, {
          sort: "deadline",
          ...(filter ? { filter } : {})
        });
        if (!rows.items.length) {
          return { content: [{ type: "text", text: status ? `You have no grants with status ${status}.` : "Your grant tracker is empty." }] };
        }
        const lines = rows.items.map((g, i) => {
          const dl = g.deadline ? `, deadline ${speakDate(g.deadline)}` : "";
          const amt = g.funding_amount ? `, up to ${speakMoney(g.funding_amount)}` : "";
          return `${i + 1}. ${g.title ?? "Untitled grant"}${amt}${dl}${g.source_agency ? ` (${g.source_agency})` : ""}.`;
        });
        const head = status ? `You have ${rows.items.length} ${status} grant(s):` : `You're tracking ${rows.totalItems} grant(s). Here are the soonest:`;
        return { content: [{ type: "text", text: [head, ...lines].join("\n") }] };
      } catch (e) {
        return pbError(e, "list your grants");
      }
    }
  );

  // ── P1 · get_deadlines ────────────────────────────────────────────────────
  server.tool(
    "get_deadlines",
    "Report the user's upcoming grant deadlines, soonest first — the ones that still have a " +
      "future close date. Use this to answer 'what's due soon?'.",
    {
      withinDays: z.number().int().min(1).max(365).optional().describe("Only deadlines within this many days.")
    },
    async ({ withinDays }) => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const rows = await pb().collection("grants").getList<GrantRecord>(1, 50, {
          sort: "deadline",
          filter: `deadline >= "${today}"`
        });
        let items = rows.items.filter((g) => g.deadline);
        if (withinDays != null) items = items.filter((g) => (daysUntil(g.deadline) ?? 1e9) <= withinDays);
        if (!items.length) {
          return { content: [{ type: "text", text: withinDays ? `Nothing is due within ${withinDays} days.` : "You have no upcoming deadlines." }] };
        }
        const lines = items.slice(0, 15).map((g) => {
          const d = daysUntil(g.deadline);
          const when = d === 0 ? "due today" : d === 1 ? "due tomorrow" : d != null ? `due in ${d} days` : "no set date";
          return `• ${g.title ?? "Untitled grant"} — ${when} (${speakDate(g.deadline)}).`;
        });
        return { content: [{ type: "text", text: [`Upcoming deadlines (${items.length}):`, ...lines].join("\n") }] };
      } catch (e) {
        return pbError(e, "check your deadlines");
      }
    }
  );

  // ── P2 · draft_application ────────────────────────────────────────────────
  server.tool(
    "draft_application",
    "Draft a grant application for the given grant, autofilled from the user's Applicant Profile. " +
      "Reports how many fields were filled and which still need the user's input, and saves the draft.",
    { grant_id: z.string().describe("The id of the grant to draft an application for.") },
    async ({ grant_id }) => {
      try {
        const client = pb();
        const owner = await ownerId(client);
        const grant = await client.collection("grants").getOne<GrantRecord>(grant_id);
        const profiles = await client.collection("application_profiles").getList<ProfileRecord>(1, 1, { sort: "-updated_at" });
        if (!profiles.items.length) {
          return { content: [{ type: "text", text: "You don't have an Applicant Profile yet. Create one in GrantHarbor first, then I can autofill applications from it." }], isError: true };
        }
        const profile = profiles.items[0];

        const filled: Record<string, string | number> = {};
        const needs: string[] = [];
        for (const f of APPLICATION_FORM) {
          const v = f.fill(grant, profile);
          if (v !== undefined && v !== null && String(v).trim() !== "") filled[f.key] = v;
          else if (f.required) needs.push(f.label);
        }
        const status = needs.length ? "NeedsInput" : "ReadyForReview";
        const draft_text = renderDraft(grant.title ?? "Untitled grant", filled, needs);

        const rec = await client.collection("applications").create({
          created_by: owner,
          grant: grant_id,
          profile: profile.id,
          grant_title: grant.title ?? "",
          status,
          filled_fields: filled,
          needs_input: needs,
          draft_text,
          form_template: FORM_TEMPLATE_ID
        });

        const filledCount = Object.keys(filled).length;
        const needLine = needs.length
          ? ` ${needs.length} field(s) still need your input: ${needs.join(", ")}.`
          : " Every required field is filled — it's ready for your review.";
        return { content: [{ type: "text", text: `Drafted your application for "${grant.title ?? "this grant"}". I filled ${filledCount} of ${APPLICATION_FORM.length} fields from your profile.${needLine} Draft saved as ${rec.id}. Say "preview ${rec.id}" to hear it. Nothing submits without your approval.` }] };
      } catch (e) {
        if (e instanceof Error && e.message === "no-owner") {
          return { content: [{ type: "text", text: "I couldn't identify your account — set GRANTHARBOR_PB_TOKEN (a logged-in user token) or GRANTHARBOR_USER_ID." }], isError: true };
        }
        return pbError(e, "draft that application");
      }
    }
  );

  // ── P2 · preview ──────────────────────────────────────────────────────────
  server.tool(
    "preview",
    "Return the saved draft for an application so the user can review it before approving.",
    { application_id: z.string().describe("The id of the drafted application to preview.") },
    async ({ application_id }) => {
      try {
        const rec: any = await pb().collection("applications").getOne(application_id);
        const needs: string[] = Array.isArray(rec.needs_input) ? rec.needs_input : [];
        const tail = needs.length ? `\n\nStill needs your input: ${needs.join(", ")}.` : "\n\nReady for your review and approval.";
        return { content: [{ type: "text", text: `${rec.draft_text || "(no draft text)"}${tail}` }] };
      } catch (e) {
        return pbError(e, "preview that application");
      }
    }
  );

  // ── P3 · send_for_review ──────────────────────────────────────────────────
  server.tool(
    "send_for_review",
    "Email the completed draft to the user for review, with a single-use approval token. Emails only " +
      "the user, never a grantor. Sets the application to ReadyForReview; does NOT submit.",
    {
      application_id: z.string().describe("The drafted application to send."),
      email: z.string().email().describe("The user's own email address to send the review copy to.")
    },
    async ({ application_id, email }) => {
      try {
        const client = pb();
        const app: any = await client.collection("applications").getOne(application_id);
        // Mint a single-use approval token; store ONLY its hash. The raw token rides in the review email
        // (demo). In production the email carries a tokenized link that opens the on-device biometric gate.
        const token = randomBytes(18).toString("base64url");
        const hash = createHash("sha256").update(token).digest("hex");
        await client.collection("applications").update(application_id, {
          status: "ReadyForReview", review_email: email, approval_token_hash: hash
        });
        const needs: string[] = Array.isArray(app.needs_input) ? app.needs_input : [];
        const body = [
          `Your GrantHarbor application for "${app.grant_title}" is ready for your review.`, "",
          app.draft_text || "", "",
          needs.length ? `Still needs your input: ${needs.join(", ")}.` : "Every required field is filled.", "",
          `To approve and submit, confirm on your device. Approval token (demo): ${token}`, "",
          "— GrantHarbor. You are the legal submitter; nothing is sent until you approve."
        ].join("\n");
        const res = await sendMail({ to: email, subject: `Review: ${app.grant_title}`, text: body });
        return { content: [{ type: "text", text: `I emailed the draft to ${email} for your review (via ${res.transport}). Approve it from your device to submit — nothing goes out until you do.` }] };
      } catch (e) {
        return pbError(e, "send that for review");
      }
    }
  );

  // ── P3 · approve_and_submit ───────────────────────────────────────────────
  server.tool(
    "approve_and_submit",
    "Submit an application AFTER the user approved it. approval_token is the user's single-use, on-device " +
      "biometric/PIN attestation — NEVER a stored grant-portal credential. The human is the legal submitter.",
    {
      application_id: z.string().describe("The approved application to submit."),
      approval_token: z.string().describe("Single-use approval attestation from the user's device.")
    },
    async ({ application_id, approval_token }) => {
      try {
        const client = pb();
        const app: any = await client.collection("applications").getOne(application_id);
        if (!app.approval_token_hash) {
          return { content: [{ type: "text", text: "That application hasn't been sent for review yet, or its approval already expired. Nothing was submitted." }], isError: true };
        }
        const hash = createHash("sha256").update(approval_token).digest("hex");
        if (hash !== app.approval_token_hash) {
          return { content: [{ type: "text", text: "That approval didn't match. For your protection, nothing was submitted." }], isError: true };
        }
        const confirmation = "GH-" + randomBytes(4).toString("hex").toUpperCase();
        await client.collection("applications").update(application_id, {
          status: "Submitted",
          submitted_at: new Date().toISOString(),
          confirmation_number: confirmation,
          approval_token_hash: "" // single-use: invalidate immediately
        });
        return { content: [{ type: "text", text: `Approved and submitted "${app.grant_title}". Confirmation ${confirmation}. You were the submitter — the approval was verified on your authorization, and that token is now spent.` }] };
      } catch (e) {
        return pbError(e, "submit that application");
      }
    }
  );

  return server;
}

/** Uniform PocketBase error → a spoken-friendly message (never leaks a stack to Alexa). */
function pbError(e: unknown, action: string) {
  const msg = e instanceof Error ? e.message : String(e);
  const hint = /fetch failed|ECONNREFUSED|network/i.test(msg)
    ? " GrantHarbor's data service isn't reachable right now — is PocketBase running?"
    : "";
  return { content: [{ type: "text" as const, text: `I couldn't ${action}.${hint}` }], isError: true };
}

// ── Streamable HTTP transport (spec 2025-11-25+) ─────────────────────────────
const app = express();
app.use(express.json());

// One transport per MCP session, keyed by the session id the SDK issues on initialize.
const transports: Record<string, StreamableHTTPServerTransport> = {};

app.post("/mcp", async (req: Request, res: Response) => {
  const sid = req.headers["mcp-session-id"] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  if (sid && transports[sid]) {
    transport = transports[sid];
  } else if (!sid && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => { transports[id] = transport; }
    });
    transport.onclose = () => { if (transport.sessionId) delete transports[transport.sessionId]; };
    await buildServer().connect(transport);
  } else {
    res.status(400).json({ jsonrpc: "2.0", error: { code: -32000, message: "Bad Request: no valid session id" }, id: null });
    return;
  }
  await transport.handleRequest(req, res, req.body);
});

// GET = the server→client SSE stream; DELETE = explicit session teardown.
async function replay(req: Request, res: Response) {
  const sid = req.headers["mcp-session-id"] as string | undefined;
  if (!sid || !transports[sid]) { res.status(400).send("Invalid or missing session id"); return; }
  await transports[sid].handleRequest(req, res);
}
app.get("/mcp", replay);
app.delete("/mcp", replay);

// A plain liveness probe (not part of MCP) so the Alexa skill / ops can health-check.
app.get("/healthz", (_req, res) => res.json({ ok: true, service: "grantharbor-mcp", version: "0.1.0" }));

app.listen(PORT, () => {
  console.log(`[grantharbor-mcp] Streamable HTTP MCP server on http://127.0.0.1:${PORT}/mcp`);
  console.log(`[grantharbor-mcp] PocketBase: ${PB_URL} ${PB_TOKEN ? "(token set)" : "(NO token — set GRANTHARBOR_PB_TOKEN)"}`);
});
