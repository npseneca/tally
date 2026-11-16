import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { ActivitySheet } from '../components/ActivitySheet'
import { EntrySheet } from '../components/EntrySheet'
import { Icon } from '../components/ui'
import { db, setEntryNote, startTimer, stopTimer, type Entry } from '../db'
import { useActivities, useNow, useRunning, useSpans } from '../hooks'
import { totalsByActivity } from '../stats'
import { addDays, fmtClock, fmtDayShort, fmtDuration, fmtTime, startOfDay, startOfWeek } from '../time'

const RECENT = 30

function dayLabel(day: Date, today: Date): string {
  if (day.getTime() === today.getTime()) return 'Today'
  if (day.getTime() === addDays(today, -1).getTime()) return 'Yesterday'
  return fmtDayShort(day)
}

/** One activity: start or stop its timer, add time by hand, and see its recent entries. */
export function ActivityPage({ activityId, onBack }: { activityId: string; onBack: () => void }) {
  const all = useActivities()
  const running = useRunning()
  const now = useNow(running ? 1000 : 30_000)
  const [sheet, setSheet] = useState<'edit' | 'add' | Entry | null>(null)

  const today = startOfDay(new Date(now))
  const weekStart = startOfWeek(today)
  const weekEnd = addDays(weekStart, 7)
  const spans = useSpans(weekStart.getTime(), weekEnd.getTime(), now)
  const entries = useLiveQuery(async () => {
    const mine = await db.entries
      .where('activity_id')
      .equals(activityId)
      .filter((e) => !e.deleted)
      .toArray()
    return mine.sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
  }, [activityId])

  if (!all || running === undefined || !entries) return null
  const activity = all.find((a) => a.id === activityId)
  if (!activity) {
    return (
      <div className="screen">
        <section className="empty">
          <h2>Activity not found</h2>
          <button className="btn primary" onClick={onBack}>
            Back to Today
          </button>
        </section>
      </div>
    )
  }

  const mine = running?.activity_id === activity.id ? running : null
  const other = running && !mine ? all.find((a) => a.id === running.activity_id) : undefined
  const todayMs = totalsByActivity(spans ?? [], today.getTime(), addDays(today, 1).getTime()).get(activity.id) ?? 0
  const weekMs = totalsByActivity(spans ?? [], weekStart.getTime(), weekEnd.getTime()).get(activity.id) ?? 0

  return (
    <div className="screen" style={{ '--c': activity.color } as React.CSSProperties}>
      <header className="top">
        <button className="back-btn" onClick={onBack}>
          <Icon name="left" size={20} /> Today
        </button>
        <button className="icon-btn" onClick={() => setSheet('edit')} aria-label="Edit activity">
          <Icon name="edit" />
        </button>
      </header>

      <h1 className="activity-title">
        <i className="dot" />
        {activity.name}
      </h1>

      <section className={'timer-card' + (mine ? ' on' : '')} aria-label="Timer">
        <p className="timer-clock" role="timer">
          {fmtClock(mine ? now - Date.parse(mine.started_at) : 0)}
        </p>
        <p className="timer-status">{mine ? `Running since ${fmtTime(new Date(mine.started_at))}` : 'Not running'}</p>
        {mine ? (
          <button className="play-btn" onClick={() => void stopTimer()} aria-label="Stop timer">
            <Icon name="stop" size={38} />
          </button>
        ) : (
          <button className="play-btn" onClick={() => void startTimer(activity.id)} aria-label="Start timer">
            <Icon name="play" size={38} />
          </button>
        )}
        {mine && (
          <input
            key={mine.id}
            className="now-note"
            defaultValue={mine.note}
            placeholder="Add a note…"
            maxLength={200}
            enterKeyHint="done"
            onBlur={(e) => {
              if (e.target.value.trim() !== mine.note) void setEntryNote(mine.id, e.target.value)
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        )}
        {other && (
          <p className="hint center">
            {other.name} is running. Starting {activity.name} will stop it.
          </p>
        )}
      </section>

      <section className="stat-pair">
        <div className="card stat">
          <p className="stat-value">{fmtDuration(todayMs)}</p>
          <p className="hint">today</p>
        </div>
        <div className="card stat">
          <p className="stat-value">{fmtDuration(weekMs)}</p>
          <p className="hint">this week</p>
        </div>
      </section>

      <button className="btn add-entry" onClick={() => setSheet('add')}>
        <Icon name="plus" size={18} /> Add time entry
      </button>

      <p className="section-label">Recent entries</p>
      {entries.length === 0 ? (
        <p className="hint">Nothing logged for {activity.name} yet.</p>
      ) : (
        <div className="card list">
          {entries.slice(0, RECENT).map((e) => {
            const start = new Date(e.started_at)
            const end = e.ended_at ? new Date(e.ended_at) : null
            return (
              <button key={e.id} className="entry" onClick={() => setSheet(e)}>
                <i className="bar" />
                <span className="entry-main">
                  <span className="entry-name">{dayLabel(startOfDay(start), today)}</span>
                  <span className="entry-sub">
                    {fmtTime(start)} – {end ? fmtTime(end) : 'now'}
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
      )}
      {entries.length > RECENT && <p className="hint center">Older entries are on the Entries tab.</p>}

      {sheet === 'edit' && (
        <ActivitySheet activity={activity} usedColors={all.map((a) => a.color)} onClose={() => setSheet(null)} />
      )}
      {sheet === 'add' && <EntrySheet activities={all} defaultActivityId={activity.id} onClose={() => setSheet(null)} />}
      {sheet && typeof sheet === 'object' && <EntrySheet entry={sheet} activities={all} onClose={() => setSheet(null)} />}
    </div>
  )
}
