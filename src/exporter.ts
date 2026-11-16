import { db, nowIso, type Activity, type Entry } from './db'

interface Backup {
  app: 'tally'
  version: 1
  exported_at: string
  activities: Omit<Activity, 'dirty'>[]
  entries: Omit<Entry, 'dirty' | 'running'>[]
}

async function deliver(filename: string, mime: string, text: string) {
  const file = new File([text], filename, { type: mime })
  // The share sheet is the reliable way to save a file from an installed iPhone web app.
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

const stamp = () => new Date().toISOString().slice(0, 10)

export async function exportJson() {
  const backup: Backup = {
    app: 'tally',
    version: 1,
    exported_at: nowIso(),
    activities: (await db.activities.filter((a) => !a.deleted).toArray()).map(({ dirty: _d, ...a }) => a),
    entries: (await db.entries.filter((e) => !e.deleted).toArray()).map(({ dirty: _d, running: _r, ...e }) => e),
  }
  await deliver(`tally-backup-${stamp()}.json`, 'application/json', JSON.stringify(backup, null, 2))
}

const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

export async function exportCsv() {
  const names = new Map((await db.activities.toArray()).map((a) => [a.id, a.name]))
  const entries = await db.entries
    .orderBy('started_at')
    .filter((e) => !e.deleted)
    .toArray()
  const lines = ['activity,start,end,minutes,note']
  for (const e of entries) {
    const minutes = e.ended_at ? Math.round((Date.parse(e.ended_at) - Date.parse(e.started_at)) / 60_000) : ''
    lines.push(
      [names.get(e.activity_id) ?? 'Deleted activity', e.started_at, e.ended_at ?? '', String(minutes), e.note]
        .map(csvCell)
        .join(','),
    )
  }
  await deliver(`tally-entries-${stamp()}.csv`, 'text/csv', lines.join('\n') + '\n')
}

/** Merges a backup into this device's data. Returns how many rows were imported. */
export async function importJson(text: string): Promise<{ activities: number; entries: number }> {
  const data = JSON.parse(text) as Partial<Backup>
  if (data.app !== 'tally' || !Array.isArray(data.activities) || !Array.isArray(data.entries)) {
    throw new Error('This file is not a Tally backup.')
  }
  const t = nowIso()
  const str = (v: unknown, name: string): string => {
    if (typeof v !== 'string' || !v) throw new Error(`The backup has an invalid ${name}.`)
    return v
  }
  const time = (v: unknown, name: string): string => {
    const d = new Date(str(v, name))
    if (isNaN(d.getTime())) throw new Error(`The backup has an invalid ${name}.`)
    return d.toISOString()
  }
  const activities: Activity[] = data.activities.map((a, i) => ({
    id: str(a.id, 'activity id'),
    name: str(a.name, 'activity name'),
    color: str(a.color, 'activity color'),
    sort_order: Number.isFinite(a.sort_order) ? a.sort_order : i,
    archived: !!a.archived,
    deleted: false,
    updated_at: t,
    dirty: 1,
  }))
  const running = await db.entries.where('running').equals(1).count()
  const entries: Entry[] = data.entries.map((e) => {
    // An entry still running in the backup is only kept running if nothing is running here.
    const ended = e.ended_at ? time(e.ended_at, 'end time') : running > 0 ? time(e.started_at, 'start time') : null
    return {
      id: str(e.id, 'entry id'),
      activity_id: str(e.activity_id, 'entry activity'),
      started_at: time(e.started_at, 'start time'),
      ended_at: ended,
      note: typeof e.note === 'string' ? e.note : '',
      deleted: false,
      updated_at: t,
      dirty: 1,
      running: ended ? 0 : 1,
    }
  })
  await db.transaction('rw', db.activities, db.entries, async () => {
    await db.activities.bulkPut(activities)
    await db.entries.bulkPut(entries)
  })
  return { activities: activities.length, entries: entries.length }
}
