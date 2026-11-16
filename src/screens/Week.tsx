import { useState } from 'react'
import { ActivityBars, type BarRow } from '../components/ActivityBars'
import { PeriodNav, useSwipe } from '../components/ui'
import { useActivities, useNow, useSpans } from '../hooks'
import { FALLBACK_COLOR } from '../palette'
import { dailyTotals, sum, totalsByActivity } from '../stats'
import { addDays, fmtDuration, fmtHoursShort, fmtRange, MIN, startOfDay, startOfWeek } from '../time'

const TREND_WEEKS = 8
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function Week() {
  const activities = useActivities()
  const now = useNow(30_000)
  const [offset, setOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const weekStart = addDays(startOfWeek(new Date(now)), offset * 7)
  const weekEnd = addDays(weekStart, 7)
  const trendStart = addDays(weekStart, -7 * (TREND_WEEKS - 1))
  const spans = useSpans(trendStart.getTime(), weekEnd.getTime(), now)

  const go = (dir: -1 | 1) => {
    if (dir === 1 && offset >= 0) return
    setOffset(offset + dir)
    setSelectedDay(null)
  }
  const swipe = useSwipe(go)

  if (!activities || !spans) return null

  const isCurrent = offset === 0
  const days = dailyTotals(spans, weekStart, 7)
  const dayTotals = days.map(sum)
  const maxDay = Math.max(...dayTotals, 1)
  const weekTotals = totalsByActivity(spans, weekStart.getTime(), weekEnd.getTime())
  const weekTotal = sum(weekTotals)

  // For the week in progress, compare against the same point in last week
  // rather than the whole of it, so the change is like for like.
  const prevStart = addDays(weekStart, -7)
  const prevEnd = isCurrent ? prevStart.getTime() + (now - weekStart.getTime()) : weekStart.getTime()
  const prevTotals = totalsByActivity(spans, prevStart.getTime(), prevEnd)
  const prevTotal = sum(prevTotals)

  const trend = Array.from({ length: TREND_WEEKS }, (_, i) => {
    const s = addDays(weekStart, -7 * (TREND_WEEKS - 1 - i))
    return totalsByActivity(spans, s.getTime(), addDays(s, 7).getTime())
  })

  const todayIndex = isCurrent ? Math.round((startOfDay(new Date(now)).getTime() - weekStart.getTime()) / 86_400_000) : -1
  const source = selectedDay === null ? weekTotals : days[selectedDay]
  const known = new Set(activities.map((a) => a.id))
  const rows: BarRow[] = activities.map((a) => ({
    id: a.id,
    name: a.name,
    color: a.color,
    ms: source.get(a.id) ?? 0,
    previous: selectedDay === null ? (prevTotals.get(a.id) ?? 0) : undefined,
    trend: selectedDay === null ? trend.map((t) => t.get(a.id) ?? 0) : undefined,
  }))
  // Time logged against an activity that no longer exists still counts.
  let orphan = 0
  for (const [id, ms] of source) if (!known.has(id)) orphan += ms
  if (orphan > 0) rows.push({ id: '_orphan', name: 'Deleted activity', color: FALLBACK_COLOR, ms: orphan })

  const diff = weekTotal - prevTotal

  return (
    <div className="screen" {...swipe}>
      <header className="top">
        <h1>Week</h1>
      </header>
      <PeriodNav
        label={isCurrent ? 'This week' : offset === -1 ? 'Last week' : fmtRange(weekStart, addDays(weekStart, 6))}
        sub={isCurrent || offset === -1 ? fmtRange(weekStart, addDays(weekStart, 6)) : undefined}
        onPrev={() => go(-1)}
        onNext={() => go(1)}
        canNext={offset < 0}
        onReset={
          isCurrent
            ? undefined
            : () => {
                setOffset(0)
                setSelectedDay(null)
              }
        }
      />

      <section className="card summary">
        <div>
          <p className="big">{fmtDuration(weekTotal)}</p>
          <p className="hint">tracked {isCurrent ? 'so far' : 'this week'}</p>
        </div>
        {prevTotal >= MIN && Math.abs(diff) >= MIN && (
          <p className="summary-change">
            {diff > 0 ? '▲' : '▼'} {fmtDuration(Math.abs(diff))}
            <small>{isCurrent ? 'vs. this point last week' : 'vs. the week before'}</small>
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">Day by day</h2>
        <div className="daychart" role="group" aria-label="Hours per day">
          {days.map((d, i) => {
            const date = addDays(weekStart, i)
            return (
              <button
                key={i}
                className={
                  'daycol' + (selectedDay === i ? ' selected' : '') + (selectedDay !== null && selectedDay !== i ? ' dim' : '')
                }
                aria-pressed={selectedDay === i}
                aria-label={`${date.toLocaleDateString([], { weekday: 'long' })}: ${fmtDuration(dayTotals[i])}`}
                onClick={() => setSelectedDay(selectedDay === i ? null : i)}
              >
                <span className="daycol-value">{fmtHoursShort(dayTotals[i])}</span>
                <span className="daycol-bar">
                  <span className="stack" style={{ height: `${(dayTotals[i] / maxDay) * 100}%` }}>
                    {activities
                      .filter((a) => (d.get(a.id) ?? 0) > 0)
                      .map((a) => (
                        <i key={a.id} style={{ flexGrow: d.get(a.id), background: a.color }} />
                      ))}
                  </span>
                </span>
                <span className={'daycol-name' + (i === todayIndex ? ' today' : '')}>{DAY_NAMES[i]}</span>
              </button>
            )
          })}
        </div>
        <p className="hint center">Hours per day. Tap a day to see just that day.</p>
      </section>

      <section className="card">
        <h2 className="card-title">
          {selectedDay === null
            ? 'By activity'
            : addDays(weekStart, selectedDay).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
        </h2>
        <ActivityBars
          rows={rows}
          changeLabel={
            selectedDay === null
              ? `Change is ${isCurrent ? 'vs. this point last week' : 'vs. the week before'}. Small bars show the last ${TREND_WEEKS} weeks.`
              : undefined
          }
        />
      </section>
    </div>
  )
}
