import { useState } from 'react'
import { deleteEntry, saveEntry, type Activity, type Entry } from '../db'
import { fmtDuration, fromLocalInput, MIN, toLocalInput } from '../time'
import { Sheet } from './ui'

function roundTo5(d: Date): Date {
  return new Date(Math.round(d.getTime() / (5 * MIN)) * 5 * MIN)
}

/** Add a manual entry, or edit an existing one when `entry` is given. */
export function EntrySheet({
  entry,
  activities,
  onClose,
}: {
  entry?: Entry
  activities: Activity[]
  onClose: () => void
}) {
  const isRunning = !!entry && !entry.ended_at
  const [activityId, setActivityId] = useState(entry?.activity_id ?? '')
  const [start, setStart] = useState(() =>
    toLocalInput(entry ? new Date(entry.started_at) : roundTo5(new Date(Date.now() - 30 * MIN))),
  )
  const [end, setEnd] = useState(() =>
    entry ? (entry.ended_at ? toLocalInput(new Date(entry.ended_at)) : '') : toLocalInput(roundTo5(new Date())),
  )
  const [note, setNote] = useState(entry?.note ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Archived activities are only offered when the entry already uses one.
  const choices = activities.filter((a) => !a.archived || a.id === entry?.activity_id)

  const startDate = fromLocalInput(start)
  const endDate = fromLocalInput(end)
  const keepRunning = isRunning && !end

  let problem: string | null = null
  if (!activityId) problem = 'Choose an activity.'
  else if (!startDate) problem = 'Set a start time.'
  else if (keepRunning && startDate.getTime() > Date.now()) problem = 'A running timer cannot start in the future.'
  else if (!keepRunning && !endDate) problem = 'Set an end time.'
  else if (!keepRunning && endDate!.getTime() <= startDate.getTime()) problem = 'The end must be after the start.'

  const duration = startDate && endDate && endDate > startDate ? endDate.getTime() - startDate.getTime() : null

  const save = async () => {
    if (problem || !startDate) return
    // Keep the original seconds when the minute was not changed, so an
    // untouched time is not silently rounded down.
    const keepExact = (original: string | null | undefined, picked: Date) =>
      original && toLocalInput(new Date(original)) === toLocalInput(picked) ? original : picked.toISOString()
    await saveEntry({
      id: entry?.id,
      activity_id: activityId,
      started_at: keepExact(entry?.started_at, startDate),
      ended_at: keepRunning ? null : keepExact(entry?.ended_at, endDate!),
      note,
    })
    onClose()
  }

  return (
    <Sheet title={entry ? 'Edit entry' : 'Add entry'} onClose={onClose}>
      <div className="field">
        <span>Activity</span>
        <div className="chips">
          {choices.map((a) => (
            <button
              key={a.id}
              type="button"
              className={'chip' + (a.id === activityId ? ' on' : '')}
              style={{ '--c': a.color } as React.CSSProperties}
              onClick={() => setActivityId(a.id)}
            >
              <i className="dot" />
              {a.name}
            </button>
          ))}
          {choices.length === 0 && <p className="hint">Add an activity on the Today screen first.</p>}
        </div>
      </div>
      <label className="field">
        <span>Start</span>
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      <label className="field">
        <span>
          End{isRunning && !end ? ' (still running)' : ''}
          {duration !== null && <em> · {fmtDuration(duration)}</em>}
        </span>
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
      </label>
      {isRunning && !end && <p className="hint">Leave the end empty to keep the timer running.</p>}
      <label className="field">
        <span>Note</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" maxLength={200} />
      </label>
      {problem && activityId && <p className="error">{problem}</p>}
      <button className="btn primary" onClick={() => void save()} disabled={!!problem}>
        Save
      </button>
      {entry &&
        (confirmDelete ? (
          <button
            className="btn danger"
            onClick={async () => {
              await deleteEntry(entry.id)
              onClose()
            }}
          >
            Tap again to delete
          </button>
        ) : (
          <button className="btn quiet danger-text" onClick={() => setConfirmDelete(true)}>
            Delete entry
          </button>
        ))}
    </Sheet>
  )
}
