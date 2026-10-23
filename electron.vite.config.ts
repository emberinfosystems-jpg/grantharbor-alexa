import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

// Locate the workspace resolver by walking UP the tree (reorg-proof).
const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const findEis = (d: string): string => { for (; d !== path.dirname(d); d = path.dirname(d)) { const p = path.join(d, 'eis-paths.cjs'); if (fs.existsSync(p)) return p } throw new Error('eis-paths.cjs not found above ' + here) }
const eis = require(findEis(here))

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: { '@ember/ui': eis.emberUiSrc, ...eis.emberAliases(here), ...eis.emberDataAliases, ...eis.emberLegalAliases, ...eis.emberAuthAliases },
      dedupe: ['react', 'react-dom']
    }
  }
})
