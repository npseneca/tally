import { createClient } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { SUPABASE_KEY, SUPABASE_URL } from './config'
import {
  clearLocalData,
  db,
  getMeta,
  getSettings,
  nowIso,
  onLocalChange,
  setMeta,
  type Activity,
  type Entry,
} from './db'

/**
 * Background sync between the local database and Supabase.
 *
 * Each sync pulls remote changes, then pushes local ones. Conflicts resolve
 * as "last edit wins" using each row's `updated_at`. Pulls page through rows
 * by `server_at`, a stamp the database sets on every write.
 */

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export interface SyncState {
  /** False until the saved session has been checked on startup. */
  ready: boolean
  user: { id: string; email: string } | null
  status: 'idle' | 'syncing' | 'error'
  lastSynced: number | null
  error: string | null
}

let state: SyncState = { ready: false, user: null, status: 'idle', lastSynced: null, error: null }
const subscribers = new Set<() => void>()

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  subscribers.forEach((fn) => fn())
}

export function useSync(): SyncState {
  return useSyncExternalStore(
    (fn) => {
      subscribers.add(fn)
      return () => subscribers.delete(fn)
    },
    () => state,
  )
}

const PAGE = 1000
const PUSH_CHUNK = 500
/** Re-read a little before the cursor so a write that committed late is not missed. */
const CURSOR_OVERLAP_MS = 5000
const EPOCH = '1970-01-01T00:00:00.000Z'

const iso = (s: string) => new Date(s).toISOString()

type Remote = Record<string, unknown> & { id: string; updated_at: string; server_at: string }

function activityFromRemote(r: Remote): Activity {
  return {
    id: r.id,
    name: r.name as string,
    color: r.color as string,
    sort_order: r.sort_order as number,
    archived: r.archived as boolean,
    deleted: r.deleted as boolean,
    updated_at: iso(r.updated_at),
    dirty: 0,
  }
}

function entryFromRemote(r: Remote): Entry {
  const ended = r.ended_at ? iso(r.ended_at as string) : null
  const deleted = r.deleted as boolean
  return {
    id: r.id,
    activity_id: r.activity_id as string,
    started_at: iso(r.started_at as string),
    ended_at: ended,
    note: (r.note as string) ?? '',
    deleted,
    updated_at: iso(r.updated_at),
    dirty: 0,
    running: !ended && !deleted ? 1 : 0,
  }
}

const activityToRemote = ({ dirty: _d, ...rest }: Activity) => rest
const entryToRemote = ({ dirty: _d, running: _r, ...rest }: Entry) => rest

async function pullTable<T extends { id: string; updated_at: string; dirty: number }>(
  name: 'activities' | 'entries',
  fromRemote: (r: Remote) => T,
) {
  const table = db.table<T, string>(name)
  const cursorKey = `cursor:${name}`
  let cursor = (await getMeta<string>(cursorKey)) ?? EPOCH
  let first = true
  for (;;) {
    let q = supabase.from(name).select('*').order('server_at').limit(PAGE)
    q = first
      ? q.gte('server_at', new Date(Math.max(0, Date.parse(cursor) - CURSOR_OVERLAP_MS)).toISOString())
      : q.gt('server_at', cursor)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Remote[]
    if (rows.length > 0) {
      await db.transaction('rw', table, async () => {
        for (const r of rows) {
          const remote = fromRemote(r)
          const local = await table.get(remote.id)
          // Keep an unsynced local edit only if it is at least as recent.
          const keepLocal = local && local.dirty === 1 && local.updated_at >= remote.updated_at
          if (!keepLocal) await table.put(remote)
        }
      })
      cursor = rows[rows.length - 1].server_at
      await setMeta(cursorKey, cursor)
    }
    first = false
    if (rows.length < PAGE) break
  }
}

async function pushTable<T extends { id: string; updated_at: string; dirty: number }>(
  name: 'activities' | 'entries',
  toRemote: (row: T) => object,
) {
  const table = db.table<T, string>(name)
  const dirty = await table.where('dirty').equals(1).toArray()
  for (let i = 0; i < dirty.length; i += PUSH_CHUNK) {
    const chunk = dirty.slice(i, i + PUSH_CHUNK)
    const { error } = await supabase.from(name).upsert(chunk.map(toRemote))
    if (error) throw new Error(error.message)
    await db.transaction('rw', table, async () => {
      for (const row of chunk) {
        // Leave the row dirty if it was edited again while the push was in flight.
        await table
          .where('id')
          .equals(row.id)
          .and((r) => r.updated_at === row.updated_at)
          .modify((r) => {
            r.dirty = 0
          })
      }
    })
  }
}

async function syncSettings(userId: string) {
  const { data, error } = await supabase.from('settings').select('data, updated_at').maybeSingle()
  if (error) throw new Error(error.message)
  const local = await getSettings()
  const remoteAt = data ? iso(data.updated_at as string) : null
  if (remoteAt && remoteAt > local.updated_at) {
    const guardHours = Number((data!.data as { guardHours?: number }).guardHours)
    await setMeta('settings', {
      guardHours: guardHours > 0 ? guardHours : local.guardHours,
      updated_at: remoteAt,
      dirty: 0,
    })
  } else if (local.dirty === 1) {
    const { error: e2 } = await supabase
      .from('settings')
      .upsert({ user_id: userId, data: { guardHours: local.guardHours }, updated_at: local.updated_at })
    if (e2) throw new Error(e2.message)
    const again = await getSettings()
    if (again.updated_at === local.updated_at) await setMeta('settings', { ...again, dirty: 0 })
  }
}

/** Two devices can each start a timer while offline; keep only the most recent one running. */
async function keepOneTimerRunning() {
  await db.transaction('rw', db.entries, async () => {
    const running = await db.entries.where('running').equals(1).sortBy('started_at')
    if (running.length < 2) return
    const latest = running[running.length - 1]
    for (const e of running.slice(0, -1)) {
      await db.entries.update(e.id, {
        ended_at: latest.started_at,
        running: 0,
        updated_at: nowIso(),
        dirty: 1,
      })
    }
  })
}

let syncing = false
let again = false

export async function syncNow() {
  const user = state.user
  if (!user) return
  if (syncing) {
    again = true
    return
  }
  syncing = true
  setState({ status: 'syncing' })
  try {
    await pullTable('activities', activityFromRemote)
    await pullTable('entries', entryFromRemote)
    await keepOneTimerRunning()
    await pushTable('activities', activityToRemote)
    await pushTable('entries', entryToRemote)
    await syncSettings(user.id)
    setState({ status: 'idle', lastSynced: Date.now(), error: null })
  } catch (err) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    setState({ status: 'error', error: offline ? 'Offline' : err instanceof Error ? err.message : String(err) })
  } finally {
    syncing = false
    if (again) {
      again = false
      void syncNow()
    }
  }
}

let debounce: ReturnType<typeof setTimeout> | undefined
function scheduleSync() {
  clearTimeout(debounce)
  debounce = setTimeout(() => void syncNow(), 800)
}

async function onSession(user: { id: string; email: string } | null) {
  if (user) {
    // Local data from a different account must never be uploaded to this one.
    const previous = await getMeta<string>('uid')
    if (previous && previous !== user.id) await clearLocalData()
    await setMeta('uid', user.id)
  }
  const changedUser = state.user?.id !== user?.id
  setState({ ready: true, user })
  if (user && changedUser) void syncNow()
}

let started = false
export function startSync() {
  if (started) return
  started = true
  onLocalChange(scheduleSync)
  supabase.auth.onAuthStateChange((_event, session) => {
    const u = session?.user
    // Deferred: Supabase calls made inside this callback can deadlock.
    setTimeout(() => void onSession(u ? { id: u.id, email: u.email ?? '' } : null), 0)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
  window.addEventListener('online', () => void syncNow())
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow()
  }, 30_000)
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  return error ? error.message : null
}

export async function signUp(email: string, password: string): Promise<string | null> {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
  if (error) return error.message
  if (!data.session) return 'Account created. Check your email to confirm it, then sign in.'
  return null
}

/** Signs out and removes this device's copy of the data (it stays in the account). */
export async function signOut() {
  await supabase.auth.signOut()
  await clearLocalData()
  setState({ user: null, lastSynced: null, error: null, status: 'idle' })
}
