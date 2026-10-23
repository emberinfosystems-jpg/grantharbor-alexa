// GrantGuard theme — now a thin binding over @ember/ui's shared store.
//
// 2026-08-03: the implementation here was harvested into `@ember/ui` as
// `createThemeStore` (it was byte-identical to EquityBridge's apart from the
// storage key). This module keeps the `gg_theme` key and re-exports the same
// names, so every call site is untouched.
//
// Gained for free: `color-scheme` is now set (the old version left a white
// scrollbar on dark screens), a `bootScript()` FOUC guard is available, and
// corrupt/disabled localStorage degrades to the default instead of throwing.
import { createThemeStore } from '@ember/ui'

export type Theme = 'light' | 'dark'

const store = createThemeStore({ key: 'gg_theme', defaultTheme: 'light' })

export const getTheme = store.getTheme as () => Theme
export const setTheme = store.setTheme as (t: Theme) => Theme
export const applyTheme = store.applyTheme as (t: Theme) => void
export const toggleTheme = store.toggle as () => Theme
export const themeBootScript = store.bootScript as () => string
export default store
