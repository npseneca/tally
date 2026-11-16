import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { db, getRunning, getSettings, DEFAULT_SETTINGS, type Activity, type Entry, type Settings } from './db'
import { toSpans, type Span } from './stats'
import { DAY } from './time'

/** Current time, refreshed on an interval and whenever the app returns to the foreground. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [intervalMs])
  return now
}

/** All activities that are not deleted, in display order (archived ones included). */
export function useActivities(): Activity[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.activities.filter((a) => !a.deleted).toArray()
    return all.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  }, [])
}

/** The running entry, `null` when nothing is running, `undefined` while loading. */
export function useRunning(): Entry | null | undefined {
  return useLiveQuery(async () => (await getRunning()) ?? null, [])
}

export function useSettings(): Settings {
  return useLiveQuery(() => getSettings(), []) ?? DEFAULT_SETTINGS
}

/**
 * Time spans that may overlap [from, to). Entries are looked up by start
 * time, reaching two days before `from` to catch ones that run across it.
 */
export function useSpans(from: number, to: number, now: number): Span[] | undefined {
  const entries = useLiveQuery(
    () =>
      db.entries
        .where('started_at')
        .between(new Date(from - 2 * DAY).toISOString(), new Date(to).toISOString())
        .filter((e) => !e.deleted)
        .toArray(),
    [from, to],
  )
  return useMemo(() => (entries ? toSpans(entries, now) : undefined), [entries, now])
}
