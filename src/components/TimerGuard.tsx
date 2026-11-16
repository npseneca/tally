import { useState } from 'react'
import { stopTimer } from '../db'
import { useActivities, useNow, useRunning, useSettings } from '../hooks'
import { fmtDuration, fromLocalInput, HOUR, toLocalInput } from '../time'
import { Sheet } from './ui'

const KEY = 'tally:guard-snooze'

function readSnooze(): { id: string; until: number } | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    return null
  }
}

/** Asks when you actually stopped if a timer has been running suspiciously long. */
export function TimerGuard() {
  const running = useRunning()
  const settings = useSettings()
  const activities = useActivities()
  const now = useNow(30_000)
  const [snooze, setSnooze] = useState(readSnooze)
  const [stoppedAt, setStoppedAt] = useState('')

  if (!running) return null
  const started = Date.parse(running.started_at)
  const elapsed = now - started
  const snoozed = snooze?.id === running.id && now < snooze.until
  if (elapsed < settings.guardHours * HOUR || snoozed) return null

  const name = activities?.find((a) => a.id === running.activity_id)?.name ?? 'Your timer'
  const picked = fromLocalInput(stoppedAt)
  const valid = !!picked && picked.getTime() > started && picked.getTime() <= Date.now()

  const keepGoing = () => {
    const next = { id: running.id, until: Date.now() + settings.guardHours * HOUR }
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* private mode: the reminder simply returns sooner */
    }
    setSnooze(next)
  }

  return (
    <Sheet title="Still going?" onClose={keepGoing}>
      <p className="lead">
        <strong>{name}</strong> has been running for {fmtDuration(elapsed)}. If you forgot to stop it, set when you
        actually finished.
      </p>
      <label className="field">
        <span>I stopped at</span>
        <input
          type="datetime-local"
          value={stoppedAt}
          min={toLocalInput(new Date(started))}
          max={toLocalInput(new Date())}
          onChange={(e) => setStoppedAt(e.target.value)}
        />
      </label>
      {stoppedAt && !valid && <p className="error">Pick a time between the start and now.</p>}
      <button className="btn primary" disabled={!valid} onClick={() => void stopTimer(picked!)}>
        Stop at that time
      </button>
      <button className="btn" onClick={() => void stopTimer()}>
        Stop now
      </button>
      <button className="btn quiet" onClick={keepGoing}>
        Still going
      </button>
    </Sheet>
  )
}
