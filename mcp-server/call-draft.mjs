/**
 * Demo MCP client — drives the FULL GrantHarbor loop over Streamable HTTP, the same path Alexa+ uses:
 *   list_grants → draft_application → preview → send_for_review → (read token from the review email) →
 *   approve_and_submit.
 * Proves the whole stack end-to-end (MCP protocol + server + PocketBase + mailer), not a direct DB call.
 *
 * Run (MCP server + PocketBase up, seed-demo.mjs run first):  node call-draft.mjs
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const demo = JSON.parse(readFileSync(new URL("./demo.json", import.meta.url), "utf8"));
const endpoint = new URL(process.env.GRANTHARBOR_MCP_URL ?? "http://127.0.0.1:3700/mcp");
const client = new Client({ name: "grantharbor-demo-client", version: "0.1.0" });
await client.connect(new StreamableHTTPClientTransport(endpoint));
const say = (r) => (r.content ?? []).map((c) => c.text).filter(Boolean).join("\n");

console.log("=== tools exposed to Alexa+ ===");
console.log((await client.listTools()).tools.map((t) => t.name).join(", "));

console.log("\n=== list_grants ===");
console.log(say(await client.callTool({ name: "list_grants", arguments: {} })));

console.log("\n=== draft_application (the Alexa 'apply' moment) ===");
const draft = say(await client.callTool({ name: "draft_application", arguments: { grant_id: demo.grantId } }));
console.log(draft);
const appId = draft.match(/saved as (\w+)/)?.[1];

if (appId) {
  console.log("\n=== send_for_review ===");
  console.log(say(await client.callTool({ name: "send_for_review", arguments: { application_id: appId, email: "demo@nexushumanity.org" } })));

  // simulate the user opening their email: pull the approval token from the newest review message
  const outboxDir = fileURLToPath(new URL("./outbox/", import.meta.url));
  const files = readdirSync(outboxDir).filter((f) => f.endsWith(".eml")).sort();
  const latest = readFileSync(join(outboxDir, files.at(-1)), "utf8");
  const token = latest.match(/Approval token \(demo\): (\S+)/)?.[1];
  console.log(`(user opens the review email, approves on-device — token ${token?.slice(0, 8)}…)`);

  console.log("\n=== approve_and_submit ===");
  console.log(say(await client.callTool({ name: "approve_and_submit", arguments: { application_id: appId, approval_token: token } })));

  console.log("\n=== approve_and_submit AGAIN (must be refused — single-use) ===");
  console.log(say(await client.callTool({ name: "approve_and_submit", arguments: { application_id: appId, approval_token: token } })));
}
await client.close();
