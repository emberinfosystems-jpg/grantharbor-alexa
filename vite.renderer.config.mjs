import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

// Locate the workspace resolver by walking UP the tree (reorg-proof).
const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const findEis = (d) => { for (; d !== path.dirname(d); d = path.dirname(d)) { const p = path.join(d, 'eis-paths.cjs'); if (fs.existsSync(p)) return p } throw new Error('eis-paths.cjs not found above ' + here) }
const eis = require(findEis(here))

// Standalone renderer server — view the UI in a browser without launching Electron.
export default defineConfig({
  root: 'src/renderer',
  // 🛑 root is src/renderer, so Vite's envDir defaults there too and MISSES the project-root
  // .env / .env.mobile — the mobile build silently fell back to localhost:8090 (the phone
  // itself) and every login "bounced". Pin envDir to the project root where the .env files live.
  envDir: here,
  // 🛑 Pin the mobile web bundle to <root>/dist-web (capacitor.config `webDir`). Vite's default
  // outDir is <root>/dist = src/renderer/dist, so without this the APK bundle landed in the wrong
  // place and `cap sync` shipped a STALE dist-web. Absolute because root is src/renderer.
  build: { outDir: path.join(here, 'dist-web'), emptyOutDir: true },
  plugins: [react()],
  resolve: {
    alias: {
      '@ember/ui': eis.emberUiSrc,
      ...eis.emberAliases(here),
      ...eis.emberDataAliases,
      ...eis.emberLegalAliases,
      // 🛑 emberAuthAliases was in electron.vite.config.ts but NOT here, so the standalone
      // browser preview died on "Failed to resolve @ember/auth" from the moment auth was
      // wired. Two alias lists for the same app WILL drift; this one is only exercised
      // when someone opens the UI in a browser, which is exactly when nobody notices.
      ...eis.emberAuthAliases
    },
    dedupe: ['react', 'react-dom']
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss({ config: path.join(here, 'tailwind.config.cjs') }),
        autoprefixer()
      ]
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5290,
    fs: { allow: [here, eis.emberUiRoot, eis.emberDataRoot, eis.emberLegalRoot, eis.emberAuthRoot].filter(Boolean) }
  }
})
