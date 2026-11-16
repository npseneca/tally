import { useEffect, useState } from 'react'
import { ActivitySheet } from '../components/ActivitySheet'
import { Icon } from '../components/ui'
import { addActivity, setEntryNote, stopTimer } from '../db'
import { useActivities, useNow, useRunning, useSpans } from '../hooks'
import { nextColor } from '../palette'
import { sum, totalsByActivity } from '../stats'
import { addDays, fmtClock, fmtDayLong, fmtDuration, fmtTime, startOfDay } from '../time'

const SUGGESTIONS = ['Work', 'Exercise', 'Reading', 'Family', 'Chores', 'Learning']

export function Today({
  onOpenSettings,
  onOpenActivity,
}: {
  onOpenSettings: () => void
  onOpenActivity: (id: string) => void
}) {
  const all = useActivities()
  const running = useRunning()
  const now = useNow(running ? 1000 : 30_000)
  const [adding, setAdding] = useState(false)
  // Suggestions stay available after the first one is added, so a new user
  // can tap several in a row. Decided once, when the activities first load.
  const [suggesting, setSuggesting] = useState<boolean | null>(null)
  const loaded = all !== undefined
  const startedEmpty = loaded && all.length === 0
  useEffect(() => {
    if (loaded) setSuggesting((s) => (s === null ? startedEmpty : s))
  }, [loaded, startedEmpty])

  const dayStart = startOfDay(new Date(now))
  const from = dayStart.getTime()
  const to = addDays(dayStart, 1).getTime()
  const spans = useSpans(from, to, now)
  const totals = totalsByActivity(spans ?? [], from, to)

  if (!all || running === undefined) return null
  const activities = all.filter((a) => !a.archived)
  const runningActivity = running ? all.find((a) => a.id === running.activity_id) : undefined
  const usedColors = all.map((a) => a.color)
  const taken = new Set(all.map((a) => a.name.toLowerCase()))
  const suggestions = SUGGESTIONS.filter((s) => !taken.has(s.toLowerCase()))
  const suggestionChips = (
    <div className="chips center">
      {suggestions.map((s) => (
        <button key={s} className="chip" onClick={() => void addActivity(s, nextColor(usedColors))}>
          + {s}
        </button>
      ))}
    </div>
  )

  return (
    <div className="screen">
      <header className="top">
        <div>
          <p className="eyebrow">{fmtDayLong(new Date(now))}</p>
          <h1>
            {fmtDuration(sum(totals))} <small>tracked today</small>
          </h1>
        </div>
        <button className="icon-btn" onClick={onOpenSettings} aria-label="Settings">
          <Icon name="gear" />
        </button>
      </header>

      {running && (
        <section
          className="now-card"
          style={{ '--c': runningActivity?.color ?? 'var(--muted)' } as React.CSSProperties}
          aria-label="Running timer"
        >
          <div className="now-row">
            <button
              className="now-open"
              disabled={!runningActivity}
              onClick={() => runningActivity && onOpenActivity(runningActivity.id)}
              aria-label={`Open ${runningActivity?.name ?? 'activity'}`}
            >
              <span className="now-name">
                <i className="dot pulse" />
                {runningActivity?.name ?? 'Unknown activity'}
              </span>
              <span className="now-clock" role="timer">
                {fmtClock(now - Date.parse(running.started_at))}
              </span>
              <span className="now-since">since {fmtTime(new Date(running.started_at))}</span>
            </button>
            <button className="stop-btn" onClick={() => void stopTimer()} aria-label="Stop timer">
              <Icon name="stop" size={30} />
            </button>
          </div>
          <input
            key={running.id}
            className="now-note"
            defaultValue={running.note}
            placeholder="Add a note…"
            maxLength={2000}
            enterKeyHint="done"
            onBlur={(e) => {
              if (e.target.value.trim() !== running.note) void setEntryNote(running.id, e.target.value)
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </section>
      )}

      {activities.length === 0 ? (
        <section className="empty">
          <h2>What do you want to track?</h2>
          <p>Add a few activities, then open one to start its timer or log time.</p>
          {suggestionChips}
          <button className="btn primary" onClick={() => setAdding(true)}>
            Add your own
          </button>
        </section>
      ) : (
        <>
          <p className="section-label">Activities</p>
          <section className="grid">
            {activities.map((a) => {
              const on = running?.activity_id === a.id
              return (
                <button
                  key={a.id}
                  className={'tile' + (on ? ' on' : '')}
                  style={{ '--c': a.color } as React.CSSProperties}
                  onClick={() => onOpenActivity(a.id)}
                >
                  <i className={'dot' + (on ? ' pulse' : '')} />
                  <span className="tile-name">{a.name}</span>
                  <span className="tile-time">
                    {on ? 'Running · ' : ''}
                    {fmtDuration(totals.get(a.id) ?? 0)} today
                  </span>
                </button>
              )
            })}
            <button className="tile add" onClick={() => setAdding(true)}>
              <Icon name="plus" />
              <span className="tile-time">New activity</span>
            </button>
          </section>
          {suggesting && suggestions.length > 0 && (
            <section className="quick-add">
              <p className="hint center">Quick add</p>
              {suggestionChips}
              <button className="btn quiet" onClick={() => setSuggesting(false)}>
                Done
              </button>
            </section>
          )}
        </>
      )}

      {adding && <ActivitySheet usedColors={usedColors} onClose={() => setAdding(false)} />}
    </div>
  )
}
