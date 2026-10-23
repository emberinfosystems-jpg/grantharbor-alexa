# Legal Review Prompt Pack — reusable compliance gate (any EIS app)
**Purpose:** a constrained, citation-forced chain to run an app's Legal page + data behavior against US federal
+ Oregon state law before ship. Run through **Propria / the Legal Team**, then a **licensed attorney** confirms
anything flagged attorney-required. 🛑 AI output = research + first draft, NEVER a licensed sign-off.

## Meta-constraints (apply to every step)
- Cite real statutes/regulations with section numbers. **If unsure a law applies or what it requires, SAY SO —
  never fabricate a statute, section, or case.**
- Classify each law: **DEFINITELY APPLIES / MAY APPLY / LIKELY N/A** with a one-line reason.
- Flag anything touching **liability limits, force majeure, breach-notification, payments, or financial data**
  as **ATTORNEY-REQUIRED**.

## Step 1 — Scope the law
"Act as a legal-research assistant (not legal advice). Enumerate every US federal and Oregon state
law/regulation applying to deploying a consumer software app in the US, for an **Oregon LLC** whose app is:
[APP PROFILE]. For each: cite statute + section, one-line obligation, applicability class + reason. Cover at
minimum: FTC Act §5, COPPA, CAN-SPAM, ADA/§508 (accessibility), GLBA, CCPA/CPRA, Oregon Consumer Privacy Act
(OCPA, ORS 646A.570+), Oregon Consumer Information Protection Act (breach, ORS 646A.600+), Oregon UTPA
(ORS 646.605+), and app-store developer policies."

## Step 2 — Ground-truth our behavior
"Here is the app's ACTUAL data behavior + current Legal page: [PASTE]. Table it: data collected, where stored,
what leaves the device, when, to whom — **free tier vs Pro tier separately.** Flag any Legal-page claim that
does not match the behavior."

## Step 3 — Gap analysis (per obligation)
"For each APPLIES / MAY-APPLY law, list its obligations. For each obligation: (a) do our Legal page + app
behavior satisfy it? (b) if not, what exactly is missing/non-compliant? (c) the specific remediation."

## Step 4 — Verdict + risk register
"Per-law verdict (COMPLIANT / GAP / UNCERTAIN) + a prioritized remediation checklist. Then a RISK REGISTER:
what you're confident about vs. what a LICENSED ATTORNEY must confirm before we rely on it."

## APP PROFILE — GrantHarbor (fill per app)
Local-first grant tracker. **Free tier:** on-device IndexedDB, no account, no data leaves device (one exception:
Grants.gov public search API, sends nothing about the user). **Planned Pro:** accounts (email + hashed pw),
PocketBase cloud sync, email (AWS SES), application form submission/export, EIN handling. Distributed via app
stores. US + Oregon users. `usesPayments` currently false (Stripe not wired).
