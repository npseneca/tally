import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { EntrySheet } from '../components/EntrySheet'
import { EntryView } from '../components/EntryView'
import { Icon } from '../components/ui'
import { db, type Entry } from '../db'
import { useActivities, useNow } from '../hooks'
import { FALLBACK_COLOR } from '../palette'
import { addDays, fmtClock, fmtDayShort, fmtDuration, fmtTime, startOfDay } from '../time'

const PAGE = 100

function dayLabel(day: Date, today: Date): string {
  if (day.getTime() === today.getTime()) return 'Today'
  if (day.getTime() === addDays(today, -1).getTime()) return 'Yesterday'
  return fmtDayShort(day)
}

export function Entries() {
  const activities = useActivities()
  const [limit, setLimit] = useState(PAGE)
  const [editing, setEditing] = useState<Entry | 'new' | null>(null)
  const entries = useLiveQuery(
    () =>
      db.entries
        .orderBy('started_at')
        .reverse()
        .filter((e) => !e.deleted)
        .limit(limit + 1)
        .toArray(),
    [limit],
  )
  const hasRunning = !!entries?.some((e) => !e.ended_at)
  const now = useNow(hasRunning ? 1000 : 60_000)

  if (!activities || !entries) return null
  const byId = new Map(activities.map((a) => [a.id, a]))
  const today = startOfDay(new Date(now))

  // Group by the local day each entry started on.
  const groups: { day: Date; items: Entry[]; total: number }[] = []
  for (const e of entries.slice(0, limit)) {
    const day = startOfDay(new Date(e.started_at))
    let g = groups[groups.length - 1]
    if (!g || g.day.getTime() !== day.getTime()) {
      g = { day, items: [], total: 0 }
      groups.push(g)
    }
    g.items.push(e)
    g.total += Math.max(0, (e.ended_at ? Date.parse(e.ended_at) : now) - Date.parse(e.started_at))
  }

  return (
    <div className="screen">
      <header className="top">
        <h1>Entries</h1>
        <button className="btn small primary" onClick={() => setEditing('new')}>
          <Icon name="plus" size={18} /> Add
        </button>
      </header>

      {groups.length === 0 && (
        <section className="empty">
          <h2>No entries yet</h2>
          <p>Start a timer on the Today screen, or add time you already spent.</p>
        </section>
      )}

      {groups.map((g) => (
        <section key={g.day.getTime()} className="day-group">
          <div className="day-head">
            <span>{dayLabel(g.day, today)}</span>
            <span>{fmtDuration(g.total)}</span>
          </div>
          <div className="card list">
            {g.items.map((e) => {
              const a = byId.get(e.activity_id)
              const start = new Date(e.started_at)
              const end = e.ended_at ? new Date(e.ended_at) : null
              const crossesDay = end && startOfDay(end).getTime() !== startOfDay(start).getTime()
              return (
                <button
                  key={e.id}
                  className="entry"
                  style={{ '--c': a?.color ?? FALLBACK_COLOR } as React.CSSProperties}
                  onClick={() => setEditing(e)}
                >
                  <i className="bar" />
                  <span className="entry-main">
                    <span className="entry-name">{a?.name ?? 'Deleted activity'}</span>
                    <span className="entry-sub">
                      {fmtTime(start)} – {end ? fmtTime(end) + (crossesDay ? ' (+1 day)' : '') : 'now'}
                      {e.note && <> · {e.note}</>}
                    </span>
                  </span>
                  <span className={'entry-dur' + (end ? '' : ' live')}>
                    {end ? fmtDuration(end.getTime() - start.getTime()) : fmtClock(now - start.getTime())}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}

      {entries.length > limit && (
        <button className="btn quiet" onClick={() => setLimit(limit + PAGE)}>
          Show older entries
        </button>
      )}

      {editing === 'new' && <EntrySheet activities={activities} onClose={() => setEditing(null)} />}
      {editing && editing !== 'new' && (
        <EntryView entry={editing} activities={activities} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
