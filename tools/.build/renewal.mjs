/**
 * Subscription renewal — the client half.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🛑 WHAT THIS IS NOT: a licence check. The app NEVER asks permission to run. This fetches a
 * NEW SIGNED TOKEN that extends access; verification stays entirely offline, so a dead
 * server, an expired domain, or a plane cannot switch off a feature somebody paid for.
 * If EIS vanishes tomorrow, every perpetual licence keeps working and every subscription
 * runs to the end of the window already paid for. That is the whole point.
 *
 * 🛑 WHY THERE IS TIME TO RETRY. Access is always issued to `billing + 15 days`, and the
 * fetch starts at ~day 35 of a 30-day cycle. That leaves a **10-day window** before access
 * even approaches its end. So every failure here is soft: log it, back off, try tomorrow.
 * Nothing about a failed fetch should ever be visible to the customer until the window is
 * genuinely closing — a subscription that panics on the first timeout punishes people for
 * their own wifi.
 *
 * 🛑 SIGNING-KEY NOTE (decision pending, 2026-08-25). The endpoint this talks to must sign
 * tokens, which means it holds a private key. The master key stays OFFLINE in Phoenix Vault
 * and signs perpetual licences only; the server should hold a SEPARATE renewal key, with the
 * app trusting both public keys. Compromise of the server then costs one rotation and one
 * subscription cycle, instead of every licence ever issued — which is unrecoverable, because
 * offline verification means a stolen key cannot be revoked.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { app } from './electron-stub.mjs';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { autoRenewEnabled } from './license-stub.mjs';
/**
 * 🛑 Overridable so the test suite can point at a local mock. NOT a customer-facing setting —
 * a licence endpoint that any environment variable can redirect is a licence endpoint an
 * attacker can redirect.
 */
export const RENEWAL_URL = process.env.GRANTH_RENEWAL_URL || 'https://emberinformation.com/api/grantharbor/renew';
/** Start trying this many days BEFORE the access-through date. */
export const RENEW_LEAD_DAYS = 10;
/** Never retry more than once in this window, however often the app is opened. */
const MIN_RETRY_HOURS = 6;
const TIMEOUT_MS = 15_000;
function statePath() {
    return join(app.getPath('userData'), '.renewal');
}
export function readState() {
    try {
        return existsSync(statePath()) ? JSON.parse(readFileSync(statePath(), 'utf8')) : {};
    }
    catch {
        return {};
    }
}
function writeState(s) {
    try {
        writeFileSync(statePath(), JSON.stringify(s), 'utf8');
    }
    catch { /* non-fatal */ }
}
function daysBetween(fromISO, toISO) {
    const d = (s) => {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
        return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : NaN;
    };
    return Math.floor(d(toISO) - d(fromISO));
}
export function todayISO(now = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${now.getUTCFullYear()}-${p(now.getUTCMonth() + 1)}-${p(now.getUTCDate())}`;
}
/**
 * Should we attempt a fetch right now?
 *
 * 🛑 Every one of these guards exists to stop the app contacting us when it has no business
 * doing so. A subscription client that phones home on a schedule the user did not agree to
 * is the thing this product is supposed to be an alternative to.
 */
export function shouldAttempt(status, state = readState(), now = new Date()) {
    if (status.plan !== 'pro')
        return { attempt: false, reason: 'not a Pro licence' };
    // A perpetual licence has no access-through date and must NEVER contact us.
    if (!status.accessThrough)
        return { attempt: false, reason: 'perpetual licence — never renews' };
    if (!autoRenewEnabled())
        return { attempt: false, reason: 'auto-renew is off (customer choice)' };
    const today = todayISO(now);
    const daysLeft = daysBetween(today, status.accessThrough);
    if (Number.isNaN(daysLeft))
        return { attempt: false, reason: 'unreadable access date' };
    if (daysLeft > RENEW_LEAD_DAYS)
        return { attempt: false, reason: `${daysLeft} days of access left` };
    if (state.lastAttempt) {
        const since = (now.getTime() - Date.parse(state.lastAttempt)) / 3_600_000;
        // 🛑 Rate-limit by WALL CLOCK, not by launch. Someone who opens and closes the app
        // twenty times in an afternoon must not generate twenty requests.
        if (Number.isFinite(since) && since < MIN_RETRY_HOURS) {
            return { attempt: false, reason: `retried ${Math.round(since)}h ago` };
        }
    }
    return { attempt: true, reason: `${daysLeft} days of access left` };
}
/**
 * Ask the endpoint for a fresh key.
 *
 * 🛑 SENDS THE MINIMUM THAT CAN IDENTIFY THE SUBSCRIPTION: the account email and the order
 * reference. No grant titles, no EIN, no usage, no machine fingerprint. This is the only
 * outbound call the app makes about the customer, so what rides along is a deliberate list,
 * not whatever happened to be nearby.
 */
export async function fetchRenewal(email, order) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(RENEWAL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, order, app: 'grantharbor', v: app.getVersion() }),
            signal: ctrl.signal
        });
        // 410 Gone = the subscription really ended. Distinguishing this from a 500 matters:
        // one means stop asking, the other means try again tomorrow.
        if (res.status === 410)
            return { ok: false, cancelled: true, error: 'subscription ended' };
        if (!res.ok)
            return { ok: false, error: `HTTP ${res.status}` };
        const body = (await res.json());
        const key = typeof body.key === 'string' ? body.key.trim() : '';
        if (!key)
            return { ok: false, error: 'response contained no key' };
        return { ok: true, key };
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    finally {
        clearTimeout(timer);
    }
}
/**
 * One full renewal pass. Returns what happened so callers can log it; throws nothing.
 *
 * `applyKey` is injected rather than imported so this module never has to know how a licence
 * is stored — and so the test can drive the whole cycle without touching safeStorage.
 */
export async function runRenewal(status, applyKey, now = new Date()) {
    const state = readState();
    const decision = shouldAttempt(status, state, now);
    if (!decision.attempt)
        return { ran: false, reason: decision.reason };
    const email = status.licensedTo ?? '';
    if (!email)
        return { ran: false, reason: 'licence carries no account binding' };
    state.lastAttempt = now.toISOString();
    const res = await fetchRenewal(email, status.order);
    if (res.ok && res.key) {
        try {
            // 🛑 The key is VERIFIED by applyKey before anything is stored. A renewal endpoint —
            // ours or an impostor's — cannot hand this app an entitlement it did not sign for.
            applyKey(res.key);
            state.lastSuccess = now.toISOString();
            state.consecutiveFailures = 0;
            delete state.lastError;
            writeState(state);
            return { ran: true, ok: true, reason: 'renewed' };
        }
        catch (e) {
            res.ok = false;
            res.error = `rejected the returned key: ${e instanceof Error ? e.message : String(e)}`;
        }
    }
    state.consecutiveFailures = (state.consecutiveFailures ?? 0) + 1;
    state.lastError = res.error;
    writeState(state);
    // 🛑 A cancelled subscription is not an error to retry — it is an answer.
    return { ran: true, ok: false, reason: res.cancelled ? 'subscription ended' : (res.error ?? 'failed') };
}
