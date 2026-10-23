// Auto-renew defaults ON, matching the real module's documented behaviour.
export let __autoRenew = true
export function autoRenewEnabled() { return __autoRenew }
export function __setAutoRenew(v) { __autoRenew = v }
