import { LegalPage } from '@ember/legal'
import { LOCAL_MODE } from '../lib/db'

// GrantGuard's legal config — the only per-app part; the clauses live in @ember/legal.
export default function Legal() {
  return (
    <LegalPage
      config={{
        // Renamed 2026-08-24: "GrantGuard" collided on the USPTO register in-lane
        // (see project_fleet_naming_convention). GrantHarbor pairs with MoneyHarbor.
        appName: 'GrantHarbor',
        tagline: 'grant tracking',
        description:
          'GrantHarbor helps businesses discover and track government grants, manage deadlines, and streamline funding applications.',
        effectiveDate: 'September 2026',
        version: '1.2',
        // 🛑 Must match the address the in-app bug reporter tells people to write to
        // (components/ReportBug.tsx). Without this the rail falls back to `legal@`, so the
        // Support page and the Report-a-problem card would name two different inboxes —
        // and the one nobody watches is where the bug reports would land.
        // ✅ PUBLISHED contact. support@emberinformation.com is LIVE (mailbox created 2026-09-01).
        // (Earlier note here warned it didn't resolve yet — accurate then, now stood up. The .com is
        // the corporate/email domain; the storefront is emberinformation.shop for purchases.)
        supportEmail: 'support@emberinformation.com',
        // 🛑 FALSE UNTIL STRIPE IS ACTUALLY WIRED. The rail turns this into a published
        // statement that "Stripe, Inc." receives user data (legalContent.js:404).
        // Upgrade.tsx `startCheckout()` is still a stub — so claiming it was a false
        // data-flow disclosure. Flip back to true the same commit checkout goes live.
        usesPayments: false,
        // ✅ VERIFIED 2026-08-24 against the code: PocketBase runs LOCALLY (bundled
        // pocketbase.exe, spawned on 127.0.0.1:8090, SQLite in pb_data). No cloud
        // backend, no analytics, no crash-reporting SDK in package.json.
        //
        // ✅ RE-VERIFIED 2026-08-25 after the ingestion agent landed. The app now makes an
        // OUTBOUND request to the Grants.gov public API — but localFirst still holds, and
        // that is a design property, not a lucky accident: the agent fetches the entire
        // public corpus with NO keyword and matches on-device (src/main/ingest.ts), so
        // nothing about the user is in the request. Had it sent the user's keywords as a
        // search query, this flag would have had to become false. See the addendum below.
        localFirst: true,
        // Mobile free tier = local IndexedDB, no account; desktop/Pro uses PocketBase accounts.
        hasAccounts: !LOCAL_MODE,
        // Mobile = no server at all → nothing is transmitted or retained by us (desktop/Pro has PocketBase).
        noServer: LOCAL_MODE,
        // 🛑 NOT listed under `subprocessors`. A subprocessor is a third party that
        // processes user data on our behalf; Grants.gov receives no user data at all.
        // Naming them there would be a false statement in the other direction — it would
        // tell readers a government agency holds information about them.
        addenda: [
          {
            title: 'Government Information & Sources',
            body: [
              'GrantHarbor is an independent application. It is not affiliated with, endorsed by, sponsored by, or representing the U.S. government, Grants.gov, USASpending.gov, or any government agency, and it does not provide or facilitate any government service. GrantHarbor does not submit applications and does not guarantee funding — all grant decisions are made solely by the respective government agencies.',
              'The government grant information the app surfaces comes from official, public U.S. government sources, which you can verify directly: federal grant opportunities from Grants.gov (https://www.grants.gov), and federal award and precedent data from USASpending.gov (https://www.usaspending.gov). Every opportunity the app shows links back to its official Grants.gov listing so you can read the original and apply at the source.',
            ],
          },
          {
            title: 'Outbound Connections',
            body: [
              'GrantHarbor connects to two external services, both operated by the U.S. federal government and both the public sources of the information the app shows you: the Grants.gov public search API (the open funding opportunities) and the USASpending.gov award-data API (which shows who has won similar funding before).',
              'The Grants.gov request is identical for every user of the app: it contains no account information, no keywords, no identifiers, and no contents of your records — the app downloads the public list of open opportunities and then compares it against your keywords on your own computer. The USASpending.gov request carries only the public title of an opportunity you are already viewing, never your own saved keywords, records, or identifiers.',
              'These connections are only made when you run a search or look up award precedent from the Discover page. They are never automatic, and the rest of the app — including all of your grant, application, investor, and business records — works with no network connection at all.',
            ],
          },
          // 🛑 DRAFT wording — pending licensed-attorney review (see LEGAL_REVIEW_PROMPT_PACK.md).
          {
            title: 'Connectivity & Consent',
            body: [
              'GrantHarbor is local-first: by default, your records stay on your device. Some optional features need to connect to outside services to work — for example email, bug reports, and submitting or exporting your applications.',
              'Pro unlocks the ingestion agent, which scans open federal opportunities (via the public APIs above) and matches them against your keywords on your own device — your keywords never leave it, and Pro does not upload or sync your records. Pro is purchased on our website (emberinformation.shop); payment is handled by our payment processor (Stripe), and Ember Information Systems never sees your card details. The email you purchase with is attached to your Pro licence, so buying Pro means we receive that email address. Your Pro licence (that email plus the key) is stored on your device and verified offline; there is no licence server to check in with.',
              'Before any feature transmits your data, creates an account, or collects information, Ember Information Systems will tell you in plain language and let you choose whether to turn it on — except where the law requires otherwise.',
            ],
          },
        ],
        dataCollected: [
          // Account exists only on desktop/Pro (PocketBase); the mobile local-first free tier has none.
          ...(LOCAL_MODE ? [] : [{ category: 'Account Data', detail: 'Email and a hashed password.', retention: 'Until you delete your account.' }]),
          { category: 'Grant & Application Records', detail: 'The grants, investors, application profiles, and notes you enter.', retention: 'Until you delete them or your account.' },
          // 🛑 ADDED 2026-08-24 — was UNDISCLOSED. src/renderer/src/lib/einValidation.ts
          // validates US EINs, so the app accepts a tax identifier. An undisclosed
          // government identifier is a real gap, not a technicality.
          { category: 'Business Identifiers', detail: 'Business details you enter for applications, which may include an Employer Identification Number (EIN). Stored locally on your device; never transmitted to us.', retention: 'Until you delete it or your account.' },
          { category: 'Approved Senders', detail: 'Email addresses/domains you mark as trusted grant-alert sources.', retention: 'Until you remove them.' },
          { category: 'Technical Data', detail: 'App version and error logs, for debugging.', retention: 'Rolling 90 days.' },
          { category: 'Pro Licence Email', detail: 'If you buy Pro, the email your licence is issued to is attached to it, so purchasing Pro means we receive that email address. Pro is bought on our website; Stripe handles payment and Ember Information Systems never sees your card details. The app itself transmits nothing; the licence is verified on your device.', retention: 'Kept while your Pro licence is active.' },
        ],
      }}
    />
  )
}
