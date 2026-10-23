/**
 * Demo seed — Nexus Humanity Foundation as the GrantHarbor applicant, applying to a real USDA food grant.
 * Idempotent: a demo user + its Applicant Profile + one grant, all owner-scoped. Writes demo.json
 * (userId, user token, profileId, grantId) for the MCP server + client to use.
 *
 * Run (PocketBase must be serving):  node seed-demo.mjs
 */
import PocketBase from "pocketbase";
import { writeFileSync } from "node:fs";

const PB_URL = process.env.GRANTHARBOR_PB_URL ?? "http://127.0.0.1:8090";
const SU_EMAIL = process.env.PB_SU_EMAIL ?? "dev@grantguard.local";
const SU_PASS = process.env.PB_SU_PASS ?? "devpass123456";
const DEMO_EMAIL = "demo@nexushumanity.org";
const DEMO_PASS = "nexusdemo123456";

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);
await pb.collection("_superusers").authWithPassword(SU_EMAIL, SU_PASS);

// 1 · demo user (idempotent)
let user;
try {
  user = await pb.collection("users").getFirstListItem(`email="${DEMO_EMAIL}"`);
} catch {
  user = await pb.collection("users").create({
    email: DEMO_EMAIL, password: DEMO_PASS, passwordConfirm: DEMO_PASS,
    emailVisibility: true, verified: true, name: "Nexus Humanity Foundation"
  });
}

// 2 · Applicant Profile — Nexus Humanity Foundation
const profileData = {
  created_by: user.id,
  profile_name: "Nexus Humanity Foundation",
  applicant_name: "Scott Taylor",
  email: DEMO_EMAIL,
  phone: "928-555-0142",
  business_name: "Nexus Humanity Foundation",
  business_type: "Nonprofit",
  ein: "99-0000000",
  address: "100 N Clark Rd",
  city: "Show Low",
  state: "AZ",
  zip_code: "85901",
  industry: "Community food security / controlled-environment agriculture",
  annual_revenue: 0,
  years_in_business: 0,
  employees: 2,
  mission_statement:
    "A human-first charitable umbrella putting affordable fresh food within reach of low-income seniors " +
    "and nearby tribal communities. Pillars: Dignity, Sovereignty, Transparency.",
  funding_needed: 400000,
  funding_purpose:
    "Community Food Farm — an off-grid-capable vertical/CEA farm near Show Low, AZ serving low-income " +
    "seniors and the adjacent White Mountain Apache community with fresh produce the regional supply chain can't deliver.",
  executive_summary:
    "Nexus Humanity Foundation's Community Food Farm uses controlled-environment agriculture (~90% less " +
    "water), passive earth cooling, and solar cold storage to grow and hold fresh food in a high-desert " +
    "food desert — serving seniors and tribal residents with dignity."
};
let profile;
try {
  const found = await pb.collection("application_profiles").getFirstListItem(`profile_name="Nexus Humanity Foundation" && created_by="${user.id}"`);
  profile = await pb.collection("application_profiles").update(found.id, profileData);
} catch {
  profile = await pb.collection("application_profiles").create(profileData);
}

// 3 · Grant — USDA Community Food Projects (the real one we researched)
const grantData = {
  created_by: user.id,
  title: "USDA Community Food Projects (CFPCGP)",
  description: "Competitive grants that fight food insecurity through community food projects meeting the needs of low-income people and promoting self-reliance.",
  funding_amount: 400000,
  deadline: "2027-07-16",
  source_agency: "USDA NIFA",
  link_url: "https://www.nifa.usda.gov/grants/programs/community-food-projects-competitive-grant-program-cfpcgp",
  status: "New"
};
let grant;
try {
  const found = await pb.collection("grants").getFirstListItem(`title="USDA Community Food Projects (CFPCGP)" && created_by="${user.id}"`);
  grant = await pb.collection("grants").update(found.id, grantData);
} catch {
  grant = await pb.collection("grants").create(grantData);
}

// 4 · mint a user token (owner-scoped) for the MCP server
const demoAuth = await pb.collection("users").authWithPassword(DEMO_EMAIL, DEMO_PASS);

const out = { userId: user.id, token: demoAuth.token, profileId: profile.id, grantId: grant.id };
writeFileSync(new URL("./demo.json", import.meta.url), JSON.stringify(out, null, 2));
console.log("SEEDED:", JSON.stringify({ userId: out.userId, profileId: out.profileId, grantId: out.grantId }));
