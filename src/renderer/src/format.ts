/**
 * GrantGuard formatting.
 *
 * 2026-08-03: `usd()` now delegates to `@ember/ui`'s shared `formatCurrency`.
 * The old local copy was a third independent variant of the same function
 * (EquityBridge and Sessions had the other two) and shared their bug: a null or
 * empty value from the backend rendered as the literal **"$NaN"** on screen.
 * The shared one coerces non-finite input to $0.00.
 *
 * `cents: false` preserves this app's whole-dollar convention — grant amounts
 * are never quoted to the penny.
 */
import { formatCurrency } from '@ember/ui'

/** Format a number as whole-dollar USD. */
export function usd(n: number): string {
  return formatCurrency(n, { cents: false })
}

/** Today's date as ISO yyyy-mm-dd. */
export function today(): string {
  return new Date().toISOString().slice(0, 10)
}
