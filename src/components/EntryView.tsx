import { useState } from 'react'
import type { Activity, Entry } from '../db'
import { useNow } from '../hooks'
import { FALLBACK_COLOR } from '../palette'
import { fmtClock, fmtDayLong, fmtDayShort, fmtDuration, fmtTime, startOfDay } from '../time'
import { EntrySheet } from './EntrySheet'
import { Sheet } from './ui'

/** Read-only view of one entry, with the full note. Editing is one tap away. */
export function EntryView({
  entry,
  activities,
  onClose,
}: {
  entry: Entry
  activities: Activity[]
  onClose: () => void
}) {
  const [editing, setEditing] = useState(false)
  const running = !entry.ended_at
  const now = useNow(running ? 1000 : 60_000)

  if (editing) return <EntrySheet entry={entry} activities={activities} onClose={onClose} />

  const activity = activities.find((a) => a.id === entry.activity_id)
  const start = new Date(entry.started_at)
  const end = entry.ended_at ? new Date(entry.ended_at) : null
  const crossesDay = end && startOfDay(end).getTime() !== startOfDay(start).getTime()

  return (
    <Sheet title={activity?.name ?? 'Deleted activity'} onClose={onClose}>
      <div className="entry-view" style={{ '--c': activity?.color ?? FALLBACK_COLOR } as React.CSSProperties}>
        <div className="entry-view-head">
          <i className="bar" />
          <div>
            <p className={'entry-view-duration' + (running ? ' live' : '')}>
              {end ? fmtDuration(end.getTime() - start.getTime()) : fmtClock(now - start.getTime())}
            </p>
            <p className="entry-view-when">{fmtDayLong(start)}</p>
            <p className="entry-view-when">
              {fmtTime(start)} – {end ? (crossesDay ? `${fmtDayShort(end)}, ` : '') + fmtTime(end) : 'still running'}
            </p>
          </div>
        </div>

        <p className="field-label">Note</p>
        {entry.note ? <p className="entry-view-note">{entry.note}</p> : <p className="hint">No note on this entry.</p>}

        <button className="btn primary" onClick={() => setEditing(true)}>
          Edit entry
        </button>
      </div>
    </Sheet>
  )
}
