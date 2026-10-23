import { app, BrowserWindow, Menu, ipcMain, shell, dialog, Notification } from 'electron'
import { join } from 'path'
import { spawn, ChildProcess } from 'child_process'
import { existsSync, cpSync, mkdirSync, writeFileSync } from 'fs'
import http from 'http'
import { release } from 'os'
import { fetchPosted, enrich } from './ingest'
import { precedent } from './usaspending'
import { ensureSuperuser, issueRecoveryCode, resetWithRecoveryCode, recoveryAvailable } from './auth'
import { status as licenseStatus, activate as licenseActivate, deactivate as licenseDeactivate, autoRenewEnabled, setAutoRenew } from './license'
import { runRenewal } from './renewal'

const PB_PORT = 8090
let pbProc: ChildProcess | null = null

// 🛑 Set when WE are shutting down, so the supervisor below can tell a deliberate stop from
// a crash. Without it, quitting the app would trigger a respawn of the thing we just killed.
let shuttingDown = false
let pbRestarts = 0
const MAX_PB_RESTARTS = 3

function pbHealthy(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PB_PORT}/api/health`, (res) => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1000, () => { req.destroy(); resolve(false) })
  })
}

async function waitForHealth(timeoutMs: number): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await pbHealthy()) return true
    await new Promise((r) => setTimeout(r, 300))
  }
  return false
}

// Boot the app's own PocketBase. In dev an external instance is usually already
// running (health passes → we don't spawn). Packaged, we spawn the bundled binary
// against a per-user writable data dir, seeding it from the shipped schema template.
async function ensurePocketBase(): Promise<void> {
  if (await pbHealthy()) return

  const resBin = app.isPackaged
    ? join(process.resourcesPath, 'pocketbase.exe')
    : join(__dirname, '../../../../10_DESIGN/ember-data/bin/pocketbase.exe')
  const templateDir = app.isPackaged
    ? join(process.resourcesPath, 'pb_template')
    : join(__dirname, '../../pocketbase/pb_template')

  const dataDir = join(app.getPath('userData'), 'pb_data')
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
    if (existsSync(templateDir)) cpSync(templateDir, dataDir, { recursive: true })
  }

  // 🛑 BEFORE serve, never after: `superuser upsert` opens the SQLite file directly, so
  // running it against a live server means two writers on one database. This is what makes
  // offline password recovery possible at all — without it a forgotten password locks the
  // owner out of their own records permanently (there was no superuser in the data dir).
  try {
    ensureSuperuser(resBin, dataDir)
  } catch (e) {
    // Not fatal: the app must still open and work. Recovery simply reports itself as
    // unavailable rather than the whole product refusing to start over a spare key.
    console.error('Local recovery credential could not be provisioned:', e)
  }

  pbProc = spawn(resBin, ['serve', '--dir', dataDir, '--http', `127.0.0.1:${PB_PORT}`], {
    stdio: 'ignore',
    windowsHide: true
  })
  pbProc.on('error', (e) => console.error('PocketBase failed to start:', e))

  // 🛑 SUPERVISE IT. ensurePocketBase() used to run exactly once at startup, so if the
  // backend died at any point afterwards the app stayed open and looked completely normal
  // while every single request failed — sign-in, sign-up, save, everything. Scott hit this
  // on 2026-08-25: the visible symptom was "Could not create account: Something went wrong",
  // which says nothing about the real cause and sends you off checking your password.
  //
  // The app spawns this process, so the app is responsible for it. Bounded restarts, not a
  // loop: if PocketBase cannot stay up after MAX_PB_RESTARTS the fault is real (corrupt
  // data dir, port taken) and hammering it would just hide that behind a spin.
  pbProc.on('exit', () => {
    pbProc = null
    if (shuttingDown || pbRestarts >= MAX_PB_RESTARTS) return
    pbRestarts++
    console.error(`PocketBase exited unexpectedly — restarting (${pbRestarts}/${MAX_PB_RESTARTS})`)
    setTimeout(() => { void ensurePocketBase() }, 500)
  })

  await waitForHealth(20000)
}

/** The ingestion agent's IPC surface. Network lives here; the renderer never fetches. */
function registerIngestHandlers(): void {
  ipcMain.handle('ingest:fetch', async (_e, sinceDays?: number) => {
    // 🛑 Clamp rather than trust. sinceDays crosses the context bridge, and a hostile or
    // simply wrong value must not become an unbounded crawl of a public API on our behalf.
    const days =
      typeof sinceDays === 'number' && Number.isFinite(sinceDays)
        ? Math.min(Math.max(Math.floor(sinceDays), 0), 365)
        : undefined
    return fetchPosted(days)
  })

  // ── award precedent (USAspending) ─────────────────────────────────────────
  // "Who has already won funding like this." 🛑 The keyword comes from the PUBLIC opportunity,
  // never the user's profile (see usaspending.ts). Clamp what crosses the bridge, same as above.
  ipcMain.handle('usaspending:precedent', async (_e, keyword: unknown) => {
    const kw = String(keyword ?? '').slice(0, 120)
    if (!kw.trim()) return { ok: false, awards: [], error: 'No keyword to search.' }
    return precedent(kw)
  })

  // ── desktop notifications ─────────────────────────────────────────────────
  // 🛑 The renderer decides WHETHER to notify (it owns the user's preference and the
  // already-fired set); main only knows HOW. Keeping the policy on one side and the
  // mechanism on the other is what stops a second caller quietly bypassing the user's
  // "off" switch by talking to this handler directly.
  ipcMain.handle('notify:show', (_e, payload: unknown) => {
    if (!Notification.isSupported()) return { shown: false, reason: 'unsupported' }
    const p = (payload ?? {}) as { title?: unknown; body?: unknown; urgent?: unknown }
    const title = String(p.title ?? '').slice(0, 120)
    const body = String(p.body ?? '').slice(0, 300)
    if (!title) return { shown: false, reason: 'empty' }
    const n = new Notification({ title, body, urgency: p.urgent === true ? 'critical' : 'normal' })
    // Clicking a deadline warning should take you to the app, not nowhere.
    n.on('click', () => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) { if (win.isMinimized()) win.restore(); win.focus() }
    })
    n.show()
    return { shown: true }
  })

  // ── diagnostics for a bug report ──────────────────────────────────────────
  // 🛑 Environment facts ONLY. Nothing here touches the user's records — no grant titles,
  // no email, no EIN, no file paths from their machine. A bug report is a message the user
  // sends to a stranger, so anything that could ride along uninvited must never be collected
  // in the first place rather than filtered out later.
  ipcMain.handle('app:diagnostics', async () => ({
    app: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: `${process.platform} ${process.arch}`,
    osRelease: release(),
    packaged: app.isPackaged,
    backend: (await pbHealthy()) ? 'running' : 'NOT running',
    backendRestarts: pbRestarts,
    recovery: recoveryAvailable() ? 'available' : 'unavailable'
  }))

  ipcMain.handle('app:saveReport', async (_e, text: unknown) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const stamp = new Date().toISOString().slice(0, 10)
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Save bug report',
      defaultPath: join(app.getPath('documents'), `GrantHarbor-bug-report-${stamp}.txt`),
      filters: [{ name: 'Text', extensions: ['txt'] }]
    })
    if (canceled || !filePath) return { saved: false }
    writeFileSync(filePath, String(text ?? ''), 'utf8')
    return { saved: true, filePath }
  })

  // ── full account export (a published privacy claim, see lib/exportData.ts) ──
  ipcMain.handle('app:exportData', async (_e, payload: unknown) => {
    const files = Array.isArray(payload) ? payload : []
    if (!files.length) return { saved: false, reason: 'nothing to write' }
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Choose where to save your data export',
      defaultPath: app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Export here'
    })
    if (canceled || !filePaths?.length) return { saved: false }

    // Its own timestamped folder. Writing loose files into Documents would scatter six
    // files into whatever the user already had there and make the export impossible to
    // find, move, or delete as one thing.
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const dir = join(filePaths[0], `GrantHarbor-export-${stamp}`)
    mkdirSync(dir, { recursive: true })

    let written = 0
    for (const f of files) {
      const item = (f ?? {}) as { name?: unknown; contents?: unknown }
      // 🛑 Filenames come from the renderer, so they get sanitised before touching the disk.
      // A name like `../../autoexec` would otherwise write outside the chosen folder — this
      // is the one place in the app where renderer input becomes a filesystem path.
      const name = String(item.name ?? '').replace(/[^A-Za-z0-9._-]/g, '')
      if (!name || name.startsWith('.')) continue
      writeFileSync(join(dir, name), String(item.contents ?? ''), 'utf8')
      written++
    }
    return { saved: true, dir, written }
  })

  // ── Pro licensing ─────────────────────────────────────────────────────────
  // 🛑 The account email is supplied by the renderer, which means it is NOT trustworthy on
  // its own — but it cannot be used to escalate: the licence is signed and bound to a
  // specific address, so claiming to be someone else only produces a binding MISMATCH and
  // drops you to basic. There is no email a caller can pass that mints an entitlement.
  ipcMain.handle('license:status', (_e, email: unknown) => licenseStatus(String(email ?? '')))

  ipcMain.handle('license:activate', (_e, payload: unknown) => {
    const p = (payload ?? {}) as { key?: unknown; email?: unknown }
    return licenseActivate(String(p.key ?? ''), String(p.email ?? ''))
  })

  ipcMain.handle('license:deactivate', () => { licenseDeactivate(); return { plan: 'basic' } })

  ipcMain.handle('license:autoRenew', (_e, on: unknown) =>
    on === undefined ? autoRenewEnabled() : setAutoRenew(on === true))

  // Purchase happens in the user's REAL browser, never in an app window: they need to see
  // the address bar and the padlock on a page that takes money.
  ipcMain.handle('license:openPurchase', () => {
    // 🛑 emberinformation.SHOP — the live storefront (verified 200). This pointed at
    // `emberinformation.com`, which is not a domain EIS owns and does not resolve at all:
    // the Buy button opened nothing. Wrong brand name, never caught because nobody had
    // clicked it. The real product pages live on the shop.
    shell.openExternal('https://emberinformation.shop/')
    return { opened: true }
  })

  // ── offline account recovery ──────────────────────────────────────────────
  ipcMain.handle('auth:recoveryAvailable', () => recoveryAvailable())

  ipcMain.handle('auth:issueRecoveryCode', async (_e, userId: unknown) => {
    // PocketBase ids are 15-char alphanumerics. Validate before it reaches a URL.
    const id = String(userId ?? '')
    if (!/^[a-zA-Z0-9]{1,20}$/.test(id)) throw new Error('Invalid account id.')
    return issueRecoveryCode(id)
  })

  ipcMain.handle('auth:resetWithRecoveryCode', async (_e, payload: unknown) => {
    const p = (payload ?? {}) as { email?: unknown; code?: unknown; password?: unknown }
    return resetWithRecoveryCode(String(p.email ?? ''), String(p.code ?? ''), String(p.password ?? ''))
  })

  ipcMain.handle('ingest:enrich', async (_e, ids: unknown) => {
    if (!Array.isArray(ids)) return {}
    // Numeric Grants.gov ids only, and a hard cap: this is the one call that scales with
    // input, so an unvalidated array would be a request amplifier pointed at grants.gov.
    const safe = ids
      .map((v) => String(v))
      .filter((v) => /^\d{1,12}$/.test(v))
      .slice(0, 100)
    const map = await enrich(safe)
    return Object.fromEntries(map)
  })
}

function createWindow(): void {
  Menu.setApplicationMenu(null)

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      devTools: !app.isPackaged
    }
  })

  // 🛑 Imported grants carry agency links. Without these two guards a click on one would
  // either navigate the app window away from itself, or open a second Electron window with
  // no chrome — both leave the user on an arbitrary remote page inside a trusted-looking
  // frame. External links belong in the real browser, where the address bar is visible.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:$/.test(new URL(url).protocol)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    const current = win.webContents.getURL()
    if (url !== current && !url.startsWith('file://') && !url.startsWith('http://localhost')) {
      event.preventDefault()
      if (/^https?:/.test(url)) shell.openExternal(url)
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * One renewal attempt at launch.
 *
 * 🛑 AT LAUNCH ONLY, and it decides for itself whether to do anything — see renewal.ts, which
 * stays silent for perpetual licences, for auto-renew-off, until access is inside the lead
 * window, and for 6h after any previous try. There is deliberately NO timer: a background
 * process that contacts us on a schedule is what this product is an alternative to, and the
 * 15-day access buffer means a launch-time check has a 10-day window to succeed in.
 *
 * 🛑 Every failure is swallowed. A renewal that cannot reach the server must never stop the
 * app opening — the customer already paid for the window they are inside.
 */
async function tryRenewal(): Promise<void> {
  try {
    const st = licenseStatus('') as { plan: string; accessThrough?: string; licensedTo?: string; order?: string }
    // status('') returns basic unless a licence exists; re-read bound to its own email so
    // the binding check passes for the account the licence was actually issued to.
    const bound = st.licensedTo ? (licenseStatus(st.licensedTo) as typeof st) : st
    const r = await runRenewal(bound, (key) => { licenseActivate(key, bound.licensedTo ?? '') })
    if (r.ran) console.log(`[renewal] ${r.ok ? 'ok' : 'failed'} — ${r.reason}`)
  } catch (e) {
    console.error('[renewal] skipped:', e)
  }
}

app.whenReady().then(async () => {
  registerIngestHandlers()
  await ensurePocketBase()
  createWindow()
  // After the window — the customer sees their app immediately either way.
  void tryRenewal()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

function stopPocketBase(): void {
  shuttingDown = true
  if (pbProc && !pbProc.killed) {
    try { pbProc.kill() } catch { /* already gone */ }
    pbProc = null
  }
}

app.on('window-all-closed', () => {
  stopPocketBase()
  if (process.platform !== 'darwin') app.quit()
})
app.on('before-quit', stopPocketBase)
