// Test stub. 🛑 Only what renewal.ts actually touches — a fatter stub would let the module
// quietly start depending on Electron APIs the test never exercises.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
const dir = mkdtempSync(tmpdir() + '/gh-renewal-')
export const app = { getPath: () => dir, getVersion: () => '0.1.0-test' }
