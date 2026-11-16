import Dexie, { type Table } from 'dexie'

/**
 * Local-first storage. The app only ever reads and writes this database;
 * sync.ts mirrors it to Supabase in the background. `dirty` marks rows that
 * still need to be pushed, and `running` is a local-only index for the
 * active timer.
 */
export interface Activity {
  id: string
  name: string
  color: string
  sort_order: number
  archived: boolean
  deleted: boolean
  updated_at: string
  dirty: number
}

export interface Entry {
  id: string
  activity_id: string
  started_at: string
  ended_at: string | null
  note: string
  deleted: boolean
  updated_at: string
  dirty: number
  running: number
}

export interface Settings {
  guardHours: number
  updated_at: string
  dirty: number
}

interface Meta {
  key: string
  value: unknown
}

class TallyDB extends Dexie {
  activities!: Table<Activity, string>
  entries!: Table<Entry, string>
  meta!: Table<Meta, string>

  constructor() {
    super('tally')
    this.version(1).stores({
      activities: 'id, dirty',
      entries: 'id, started_at, dirty, running',
      meta: 'key',
    })
  }
}

export const db = new TallyDB()

export const DEFAULT_SETTINGS: Settings = { guardHours: 4, updated_at: '1970-01-01T00:00:00.000Z', dirty: 0 }

/** Timer taps shorter than this are treated as accidental and discarded. */
const MIN_ENTRY_MS = 10_000

export const nowIso = () => new Date().toISOString()

export function uid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

let listener: (() => void) | null = null
/** sync.ts registers here so every local write schedules a background sync. */
export function onLocalChange(fn: () => void) {
  listener = fn
}
const changed = () => listener?.()

// ---- meta / settings ----

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value })
}

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...((await getMeta<Settings>('settings')) ?? {}) }
}

export async function updateSettings(patch: Partial<Pick<Settings, 'guardHours'>>) {
  const s = await getSettings()
  await setMeta('settings', { ...s, ...patch, updated_at: nowIso(), dirty: 1 })
  changed()
}

// ---- activities ----

export async function addActivity(name: string, color: string): Promise<string> {
  const all = await db.activities.toArray()
  const id = uid()
  await db.activities.add({
    id,
    name: name.trim(),
    color,
    sort_order: all.reduce((m, a) => Math.max(m, a.sort_order), -1) + 1,
    archived: false,
    deleted: false,
    updated_at: nowIso(),
    dirty: 1,
  })
  changed()
  return id
}

export async function updateActivity(id: string, patch: Partial<Pick<Activity, 'name' | 'color' | 'archived' | 'sort_order'>>) {
  await db.activities.update(id, { ...patch, updated_at: nowIso(), dirty: 1 })
  changed()
}

export async function swapActivityOrder(a: Activity, b: Activity) {
  await db.transaction('rw', db.activities, async () => {
    const t = nowIso()
    await db.activities.update(a.id, { sort_order: b.sort_order, updated_at: t, dirty: 1 })
    await db.activities.update(b.id, { sort_order: a.sort_order, updated_at: t, dirty: 1 })
  })
  changed()
}

// ---- timer + entries ----

export async function getRunning(): Promise<Entry | undefined> {
  return db.entries
    .where('running')
    .equals(1)
    .filter((e) => !e.deleted)
    .first()
}

/** Ends whatever is running. Must be called inside a transaction on db.entries. */
async function stopRunningAt(at: Date) {
  const running = await db.entries.where('running').equals(1).toArray()
  for (const e of running) {
    const start = Date.parse(e.started_at)
    const end = Math.max(at.getTime(), start)
    await db.entries.update(e.id, {
      ended_at: new Date(end).toISOString(),
      running: 0,
      deleted: e.deleted || end - start < MIN_ENTRY_MS,
      updated_at: nowIso(),
      dirty: 1,
    })
  }
}

export async function stopTimer(at: Date = new Date()) {
  await db.transaction('rw', db.entries, () => stopRunningAt(at))
  changed()
}

/** Starts a timer for the activity, ending any other running timer first. */
export async function startTimer(activityId: string) {
  await db.transaction('rw', db.entries, async () => {
    const now = new Date()
    await stopRunningAt(now)
    await db.entries.add({
      id: uid(),
      activity_id: activityId,
      started_at: now.toISOString(),
      ended_at: null,
      note: '',
      deleted: false,
      updated_at: now.toISOString(),
      dirty: 1,
      running: 1,
    })
  })
  changed()
}

export interface EntryInput {
  id?: string
  activity_id: string
  started_at: string
  ended_at: string | null
  note: string
}

export async function saveEntry(input: EntryInput) {
  const row: Entry = {
    id: input.id ?? uid(),
    activity_id: input.activity_id,
    started_at: input.started_at,
    ended_at: input.ended_at,
    note: input.note.trim(),
    deleted: false,
    updated_at: nowIso(),
    dirty: 1,
    running: input.ended_at ? 0 : 1,
  }
  await db.entries.put(row)
  changed()
}

export async function setEntryNote(id: string, note: string) {
  await db.entries.update(id, { note: note.trim(), updated_at: nowIso(), dirty: 1 })
  changed()
}

export async function deleteEntry(id: string) {
  const e = await db.entries.get(id)
  if (!e) return
  await db.entries.update(id, {
    deleted: true,
    running: 0,
    ended_at: e.ended_at ?? nowIso(),
    updated_at: nowIso(),
    dirty: 1,
  })
  changed()
}

export async function clearLocalData() {
  await db.transaction('rw', db.activities, db.entries, db.meta, async () => {
    await db.activities.clear()
    await db.entries.clear()
    await db.meta.clear()
  })
}
