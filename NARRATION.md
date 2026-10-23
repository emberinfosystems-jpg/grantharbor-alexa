# GrantHarbor demo — narration to read aloud (your voice, ~2:40)

Read this straight through in one calm take, normal pace. Pause ~1s at each [beat] break — I'll sync
the visuals to it. Real voice for today (clone's a post-deadline upgrade; don't risk the pipeline on
a deadline). Record it in the Ember Recorder, same as last time.

---

**[beat 1 — the hook]**
This is GrantHarbor. It tracks grants for small nonprofits. Our applicant is the Nexus Humanity
Foundation, a food-security charity. A perfect-fit USDA grant just landed on their list — and
normally, applying means hours of re-typing the same org info into yet another form.

**[beat 2 — the ask]**
So we gave GrantHarbor a voice. "Alexa, apply for the USDA food grant."

**[beat 3 — the autofill, the money moment]**
It filled fourteen of seventeen fields straight from the applicant's profile. Three still need human
input: detailed budget, timeline, and measurable objectives. It pulled the legal name, the EIN, the
address, the mission, the four-hundred-thousand-dollar ask, the whole project summary — and it's
honest about the three fields a person still has to write. No hallucinated budget.

**[beat 4 — review and approve]**
It doesn't submit anything. It emails the draft to you. You review it, and you approve on your own
device. Approved and submitted. Confirmation number issued — and you were the submitter. The approval
is verified on your authorization, and that token is now spent.

**[beat 5 — the safety beat]**
Three things GrantHarbor refuses to do. It never auto-submits — a human approves every submission. It
never stores a grant-portal login. And the approval is single-use — so it can't be captured and
reused. Watch: the replay is refused.

**[beat 6 — architecture and close]**
Under the hood it's a self-hosted MCP server over Streamable HTTP — the same tools Alexa Plus calls,
running against the user's own data, local-first and owner-scoped. Email is AWS SES. The server is
open-sourced under Apache 2.0. Grants found, drafted, and submitted — by voice, the day they drop.
That's GrantHarbor.

---
🛑 One honesty line to include on camera (it's required and judges respect it): the MCP server,
the autofill, and the approve-submit loop are **real**; the email is a file stand-in for SES, and
the voice front-end is the allowed **simulated-Alexa web** path.
