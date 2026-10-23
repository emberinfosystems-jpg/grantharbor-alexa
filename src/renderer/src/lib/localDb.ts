// GrantHarbor LOCAL-FIRST datastore (free mobile tier).
//
// Implements the SAME supabase-dialect surface the app already calls on `db`
// (`.from(t).select().order().limit()`, `.insert()`, `.update().eq()`, `.delete().eq()`, each
// resolving to `{ data, error }`) — but backed by IndexedDB in the device's WebView. So the
// store and every page are untouched: swapping `db` for this is a drop-in (same trick the app
// used going localStorage → PocketBase, run in reverse for the offline tier).
//
// No auth, no RLS: on a single device the device IS the boundary. `created_by` stamps are
// accepted and stored but ignored. Pro sync (later) swaps this for the PocketBase client and
// migrates these records up to the shared backend.
//
// 🔜 HARVEST: when a 2nd mobile-first app needs offline, promote this into `@ember/data` as a
// `local` backend (makeClient({ backend: 'local' })). Built app-local first per fleet doctrine.

const DB_NAME = 'grantharbor_local'
const DB_VERSION = 1
const STORES = ['grants', 'investors', 'approved_senders', 'application_profiles', 'user_preferences'] as const
type StoreName = (typeof STORES)[number]

let _dbp: Promise<IDBDatabase> | null = null
function openDb(): Promise<IDBDatabase> {
  if (_dbp) return _dbp
  _dbp = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _dbp
}

// PocketBase-style 15-char id, so records look/behave the same as the cloud tier.
function genId(): string {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < 15; i++) s += c[Math.floor(Math.random() * c.length)]
  return s
}

function reqP<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
}
function txDone(t: IDBTransaction): Promise<void> {
  return new Promise<void>((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error) })
}

type Result = { data: unknown; error: Error | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

class LocalQuery implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private payload: Row | null = null
  private filters: [string, unknown][] = []
  private _order: { col: string; ascending: boolean } | null = null
  private _limit: number | null = null
  constructor(private store: StoreName) {}

  select(_cols?: string): this { this.op = 'select'; return this }
  insert(row: Row): this { this.op = 'insert'; this.payload = row; return this }
  update(patch: Row): this { this.op = 'update'; this.payload = patch; return this }
  delete(): this { this.op = 'delete'; return this }
  eq(col: string, val: unknown): this { this.filters.push([col, val]); return this }
  order(col: string, opts?: { ascending?: boolean }): this { this._order = { col, ascending: opts?.ascending ?? true }; return this }
  limit(n: number): this { this._limit = n; return this }

  then<R1 = Result, R2 = never>(
    onFulfilled?: ((v: Result) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((e: unknown) => R2 | PromiseLike<R2>) | null
  ): Promise<R1 | R2> {
    return this.run().then(onFulfilled as never, onRejected as never)
  }

  private matches(row: Row): boolean {
    return this.filters.every(([c, v]) => row[c] === v)
  }

  private async run(): Promise<Result> {
    try {
      const db = await openDb()
      if (this.op === 'select') {
        let rows = (await reqP(db.transaction(this.store, 'readonly').objectStore(this.store).getAll())) as Row[]
        if (this.filters.length) rows = rows.filter((r) => this.matches(r))
        if (this._order) {
          const { col, ascending } = this._order
          const dir = ascending ? 1 : -1
          rows.sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * dir)
        }
        if (this._limit != null) rows = rows.slice(0, this._limit)
        return { data: rows, error: null }
      }
      if (this.op === 'insert') {
        const now = new Date().toISOString()
        const row: Row = { id: genId(), created: now, updated: now, ...this.payload }
        if (this.payload?.id) row.id = this.payload.id
        const t = db.transaction(this.store, 'readwrite')
        t.objectStore(this.store).add(row)
        await txDone(t)
        return { data: [row], error: null }
      }
      // update / delete: read matches (readonly), then apply in one readwrite tx.
      const all = (await reqP(db.transaction(this.store, 'readonly').objectStore(this.store).getAll())) as Row[]
      const hits = all.filter((r) => this.matches(r))
      const t = db.transaction(this.store, 'readwrite')
      const st = t.objectStore(this.store)
      if (this.op === 'update') {
        const now = new Date().toISOString()
        const updated = hits.map((r) => { const m = { ...r, ...this.payload, updated: now }; st.put(m); return m })
        await txDone(t)
        return { data: updated, error: null }
      }
      // delete
      for (const r of hits) st.delete(r.id)
      await txDone(t)
      return { data: hits, error: null }
    } catch (e) {
      return { data: null, error: e as Error }
    }
  }
}

export function makeLocalClient() {
  return {
    from(table: StoreName) { return new LocalQuery(table) },
    _pb: null as unknown
  }
}
