import { useState } from 'react'
import { ActivityBars, type BarRow } from '../components/ActivityBars'
import { PeriodNav, useSwipe } from '../components/ui'
import { useActivities, useNow, useSpans } from '../hooks'
import { FALLBACK_COLOR } from '../palette'
import { dailyTotals, sum, totalsByActivity } from '../stats'
import { addDays, addMonths, fmtDuration, startOfDay, startOfMonth } from '../time'

const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function Month() {
  const activities = useActivities()
  const now = useNow(60_000)
  const [offset, setOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const monthStart = addMonths(startOfMonth(new Date(now)), offset)
  const monthEnd = addMonths(monthStart, 1)
  const spans = useSpans(monthStart.getTime(), monthEnd.getTime(), now)

  const go = (dir: -1 | 1) => {
    if (dir === 1 && offset >= 0) return
    setOffset(offset + dir)
    setSelectedDay(null)
  }
  const swipe = useSwipe(go)

  if (!activities || !spans) return null

  const isCurrent = offset === 0
  const dayCount = Math.round((monthEnd.getTime() - monthStart.getTime()) / 86_400_000)
  const days = dailyTotals(spans, monthStart, dayCount)
  const dayTotals = days.map(sum)
  const maxDay = Math.max(...dayTotals, 1)
  const monthTotals = totalsByActivity(spans, monthStart.getTime(), monthEnd.getTime())
  const monthTotal = sum(monthTotals)
  const todayIndex = isCurrent ? startOfDay(new Date(now)).getDate() - 1 : -1
  const daysElapsed = isCurrent ? todayIndex + 1 : dayCount
  const leadingBlanks = (monthStart.getDay() + 6) % 7

  const source = selectedDay === null ? monthTotals : days[selectedDay]
  const known = new Set(activities.map((a) => a.id))
  const rows: BarRow[] = activities.map((a) => ({ id: a.id, name: a.name, color: a.color, ms: source.get(a.id) ?? 0 }))
  let orphan = 0
  for (const [id, ms] of source) if (!known.has(id)) orphan += ms
  if (orphan > 0) rows.push({ id: '_orphan', name: 'Deleted activity', color: FALLBACK_COLOR, ms: orphan })

  return (
    <div className="screen" {...swipe}>
      <header className="top">
        <h1>Month</h1>
      </header>
      <PeriodNav
        label={monthStart.toLocaleDateString([], { month: 'long', year: 'numeric' })}
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
          <p className="big">{fmtDuration(monthTotal)}</p>
          <p className="hint">tracked {isCurrent ? 'so far' : 'this month'}</p>
        </div>
        <p className="summary-change">
          {fmtDuration(monthTotal / Math.max(1, daysElapsed))}
          <small>average per day</small>
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">Each day</h2>
        <div className="cal" role="group" aria-label="Time tracked each day">
          {DAY_INITIALS.map((d, i) => (
            <span key={'h' + i} className="cal-head">
              {d}
            </span>
          ))}
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <span key={'b' + i} />
          ))}
          {dayTotals.map((t, i) => {
            const level = t > 0 ? 0.18 + 0.82 * (t / maxDay) : 0
            return (
              <button
                key={i}
                className={
                  'cal-day' +
                  (selectedDay === i ? ' selected' : '') +
                  (i === todayIndex ? ' today' : '') +
                  (level > 0.6 ? ' strong' : '')
                }
                style={{ '--level': level } as React.CSSProperties}
                aria-pressed={selectedDay === i}
                aria-label={`${addDays(monthStart, i).toLocaleDateString([], { month: 'long', day: 'numeric' })}: ${fmtDuration(t)}`}
                onClick={() => setSelectedDay(selectedDay === i ? null : i)}
              >
                {i + 1}
              </button>
            )
          })}
        </div>
        <p className="hint center">Darker days have more time tracked. Tap a day to see it.</p>
      </section>

      <section className="card">
        <h2 className="card-title">
          {selectedDay === null
            ? 'By activity'
            : `${addDays(monthStart, selectedDay).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })} · ${fmtDuration(dayTotals[selectedDay])}`}
        </h2>
        <ActivityBars rows={rows} />
      </section>
    </div>
  )
}
