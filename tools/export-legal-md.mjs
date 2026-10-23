/**
 * export-legal-md.mjs — render the app's Terms / Privacy / Support to Markdown from the SINGLE SOURCE
 * OF TRUTH (@ember/legal). Output matches the in-app Legal page, no hand-authored drift. Host these, or
 * paste into store console fields. Uses the MOBILE/store config (local-first, no account).
 *
 *   node tools/export-legal-md.mjs   ->   legal/{terms-of-service,privacy-policy,support}.md
 */
import { buildTerms, buildPrivacy, buildSupport } from '../../../../10_DESIGN/ember-legal/src/legalContent.js';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'legal');
mkdirSync(OUT, { recursive: true });

// GrantHarbor MOBILE / store config (local-first, no account) — mirrors Legal.tsx.
const cfg = {
  appName: 'GrantHarbor',
  tagline: 'grant tracking',
  description: 'GrantHarbor helps businesses discover and track government grants, manage deadlines, and streamline funding applications.',
  effectiveDate: 'September 2026',
  version: '1.2',
  supportEmail: 'support@emberinformation.com',
  usesPayments: false,
  localFirst: true,
  hasAccounts: false,
  noServer: true,
  addenda: [
    { title: 'Government Information & Sources', body: [
      'GrantHarbor is an independent application. It is not affiliated with, endorsed by, sponsored by, or representing the U.S. government, Grants.gov, USASpending.gov, or any government agency, and it does not provide or facilitate any government service. GrantHarbor does not submit applications and does not guarantee funding — all grant decisions are made solely by the respective government agencies.',
      'The government grant information the app surfaces comes from official, public U.S. government sources, which you can verify directly: federal grant opportunities from Grants.gov (https://www.grants.gov), and federal award and precedent data from USASpending.gov (https://www.usaspending.gov). Every opportunity the app shows links back to its official Grants.gov listing so you can read the original and apply at the source.',
    ] },
    { title: 'Outbound Connections', body: [
      'GrantHarbor connects to two external services, both operated by the U.S. federal government and both public: the Grants.gov search API (the source of the open funding opportunities the app finds for you) and the USASpending.gov award API (used by Pro\'s "who has won funding like this" precedent lookup). No other servers are contacted for grant data.',
      'These requests are identical for every user of the app. They contain no account information, no keywords, no identifiers, and no contents of your records — the app downloads the public lists and then compares them against your keywords on your own device. Neither service can tell what you are looking for, or that the request came from you rather than any other user.',
      'This connection is only made when you run a search from the Discover page. It is never automatic, and the rest of the app works with no network connection at all.',
    ] },
    { title: 'Connectivity & Consent', body: [
      'GrantHarbor is local-first: by default, your records stay on your device. Some optional features need to connect to outside services to work — for example email, bug reports, and submitting or exporting your applications.',
      'Pro unlocks the ingestion agent, which scans open federal opportunities (via the public APIs above) and matches them against your keywords on your own device — your keywords never leave it, and Pro does not upload or sync your records. Pro is purchased on our website (emberinformation.shop); payment is handled by our payment processor (Stripe), and Ember Information Systems never sees your card details. The email you purchase with is attached to your Pro licence, so buying Pro means we receive that email address. Your Pro licence (that email plus the key) is stored on your device and verified offline; there is no licence server to check in with.',
      'Before any feature transmits your data, creates an account, or collects information, Ember Information Systems will tell you in plain language and let you choose whether to turn it on — except where the law requires otherwise.',
    ] },
  ],
  dataCollected: [
    { category: 'Grant & Application Records', detail: 'The grants, investors, application profiles, and notes you enter. Stored locally on your device.', retention: 'Until you delete them.' },
    { category: 'Business Identifiers', detail: 'Business details you enter for applications, which may include an Employer Identification Number (EIN). Stored locally on your device; never transmitted to us.', retention: 'Until you delete it.' },
    { category: 'Approved Senders', detail: 'Email addresses/domains you mark as trusted grant-alert sources.', retention: 'Until you remove them.' },
    { category: 'Technical Data', detail: 'App version and error logs, for debugging (on-device).', retention: 'Rolling 90 days.' },
    { category: 'Pro Licence Email', detail: 'If you buy Pro, the email your licence is issued to is attached to it, so purchasing Pro means we receive that email address. Pro is bought on our website; Stripe handles payment and Ember Information Systems never sees your card details. The app itself transmits nothing; the licence is verified on your device.', retention: 'Kept while your Pro licence is active.' },
  ],
};

const htmlToMd = (s) => String(s)
  .replace(/<strong>(.*?)<\/strong>/gs, '**$1**')
  .replace(/<em>(.*?)<\/em>/gs, '*$1*')
  .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gs, '[$2]($1)')
  .replace(/<[^>]+>/g, '');

function renderItem(item) {
  if (typeof item === 'string') return htmlToMd(item);
  if (item.html) return htmlToMd(item.html);
  if (item.list) return item.list.map((x) => `- ${htmlToMd(x)}`).join('\n');
  if (item.table && item.table.length) {
    const keys = Object.keys(item.table[0]);
    const cap = (k) => k[0].toUpperCase() + k.slice(1).replace(/([A-Z])/g, ' $1');
    return [
      `| ${keys.map(cap).join(' | ')} |`,
      `| ${keys.map(() => '---').join(' | ')} |`,
      ...item.table.map((r) => `| ${keys.map((k) => htmlToMd(String(r[k] ?? ''))).join(' | ')} |`),
    ].join('\n');
  }
  return '';
}

function toMd(docTitle, sections) {
  const head = `# ${cfg.appName} — ${docTitle}\n\n` +
    `**Ember Information Systems LLC** · a limited liability company under the laws of Oregon, United States\n` +
    `Effective ${cfg.effectiveDate} · v${cfg.version}\n\n` +
    `---\n\n`;
  const body = sections.map((sec) =>
    `## ${sec.num}. ${sec.title}\n\n` + sec.body.map(renderItem).filter(Boolean).join('\n\n')
  ).join('\n\n');
  return head + body + '\n';
}

writeFileSync(join(OUT, 'terms-of-service.md'), toMd('Terms of Service', buildTerms(cfg)));
writeFileSync(join(OUT, 'privacy-policy.md'), toMd('Privacy Policy', buildPrivacy(cfg)));
writeFileSync(join(OUT, 'support.md'), toMd('Support', buildSupport(cfg)));
console.log('wrote legal/terms-of-service.md, privacy-policy.md, support.md');
