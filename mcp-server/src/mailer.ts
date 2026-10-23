/**
 * Pluggable mail transport for send_for_review.
 *
 * - GRANTHARBOR_SES=1 (+ GRANTHARBOR_SES_FROM and AWS creds in env) → real AWS SES. This is the scope's
 *   AWS Builder mini-challenge; it needs `npm i @aws-sdk/client-sesv2`.
 * - otherwise → a demo-safe FILE transport that writes the message to ./outbox, so the whole review loop
 *   runs end-to-end with no account at all. Swap transports by flipping one env var; no code changes.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface Mail { to: string; subject: string; text: string }

export async function sendMail(m: Mail): Promise<{ transport: string; detail: string }> {
  if (process.env.GRANTHARBOR_SES === "1") {
    const from = process.env.GRANTHARBOR_SES_FROM;
    if (!from) throw new Error("GRANTHARBOR_SES_FROM not set for SES transport");
    // Non-literal specifier: tsc won't try to resolve the SDK, so the file transport needs no AWS dep.
    const spec = "@aws-sdk/client-sesv2";
    const ses: any = await import(spec).catch(() => { throw new Error("SES mode needs: npm i @aws-sdk/client-sesv2"); });
    const client = new ses.SESv2Client({});
    await client.send(new ses.SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [m.to] },
      Content: { Simple: { Subject: { Data: m.subject }, Body: { Text: { Data: m.text } } } }
    }));
    return { transport: "ses", detail: `sent to ${m.to} via AWS SES` };
  }

  const dir = join(process.cwd(), "outbox");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${Date.now()}-${m.to.replace(/[^a-z0-9]/gi, "_")}.eml`);
  writeFileSync(file, `To: ${m.to}\nSubject: ${m.subject}\n\n${m.text}\n`);
  return { transport: "file", detail: file };
}
