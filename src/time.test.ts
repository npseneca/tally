import { describe, expect, it } from 'vitest'
import { dailyTotals, sum, toSpans, totalsByActivity } from './stats'
import { addDays, fmtClock, fmtDuration, HOUR, MIN, startOfMonth, startOfWeek, toLocalInput, fromLocalInput } from './time'

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min)

describe('weeks', () => {
  it('start on Monday', () => {
    // 2026-11-15 is a Sunday, so its week began on Monday the 9th.
    expect(startOfWeek(local(2026, 11, 15, 22))).toEqual(local(2026, 11, 9))
    expect(startOfWeek(local(2026, 11, 16, 0))).toEqual(local(2026, 11, 16))
    expect(startOfWeek(local(2026, 11, 18, 9))).toEqual(local(2026, 11, 16))
  })
  it('cross month and year boundaries', () => {
    expect(startOfWeek(local(2027, 1, 1))).toEqual(local(2026, 12, 28))
    expect(startOfMonth(local(2026, 2, 28, 23))).toEqual(local(2026, 2, 1))
    expect(addDays(local(2026, 12, 31), 1)).toEqual(local(2027, 1, 1))
  })
})

describe('formatting', () => {
  it('durations', () => {
    expect(fmtDuration(0)).toBe('0m')
    expect(fmtDuration(45 * MIN)).toBe('45m')
    expect(fmtDuration(3 * HOUR)).toBe('3h')
    expect(fmtDuration(3 * HOUR + 20 * MIN)).toBe('3h 20m')
    expect(fmtDuration(59.6 * MIN)).toBe('1h')
  })
  it('clock', () => {
    expect(fmtClock(65_000)).toBe('1:05')
    expect(fmtClock(HOUR + 4 * MIN + 5000)).toBe('1:04:05')
  })
  it('round-trips datetime-local values', () => {
    const d = local(2026, 3, 7, 9, 5)
    expect(toLocalInput(d)).toBe('2026-03-07T09:05')
    expect(fromLocalInput(toLocalInput(d))).toEqual(d)
    expect(fromLocalInput('')).toBeNull()
  })
})

describe('totals', () => {
  const entries = [
    // 2h on Monday
    { activity_id: 'a', started_at: local(2026, 11, 9, 9).toISOString(), ended_at: local(2026, 11, 9, 11).toISOString() },
    // Crosses midnight Monday -> Tuesday: 1h + 2h
    { activity_id: 'b', started_at: local(2026, 11, 9, 23).toISOString(), ended_at: local(2026, 11, 10, 2).toISOString() },
    // Crosses the week boundary Sunday -> next Monday: 30m + 30m
    { activity_id: 'a', started_at: local(2026, 11, 15, 23, 30).toISOString(), ended_at: local(2026, 11, 16, 0, 30).toISOString() },
    // Still running, started Wednesday 10:00
    { activity_id: 'c', started_at: local(2026, 11, 11, 10).toISOString(), ended_at: null },
  ]
  const now = local(2026, 11, 11, 10, 45).getTime()
  const spans = toSpans(entries, now)
  const weekStart = local(2026, 11, 9)

  it('clips to the period', () => {
    const t = totalsByActivity(spans, weekStart.getTime(), addDays(weekStart, 7).getTime())
    expect(t.get('a')).toBe(2 * HOUR + 30 * MIN)
    expect(t.get('b')).toBe(3 * HOUR)
    expect(t.get('c')).toBe(45 * MIN)
    const next = totalsByActivity(spans, addDays(weekStart, 7).getTime(), addDays(weekStart, 14).getTime())
    expect(next.get('a')).toBe(30 * MIN)
    expect(next.has('b')).toBe(false)
  })

  it('splits entries across days', () => {
    const days = dailyTotals(spans, weekStart, 7)
    expect(days[0].get('a')).toBe(2 * HOUR)
    expect(days[0].get('b')).toBe(1 * HOUR)
    expect(days[1].get('b')).toBe(2 * HOUR)
    expect(days[2].get('c')).toBe(45 * MIN)
    expect(sum(days[6])).toBe(30 * MIN)
    // The days add up to the week.
    const week = sum(totalsByActivity(spans, weekStart.getTime(), addDays(weekStart, 7).getTime()))
    expect(days.reduce((t, d) => t + sum(d), 0)).toBe(week)
  })

  it('ignores entries that end before they start', () => {
    expect(toSpans([{ activity_id: 'a', started_at: '2026-01-02T00:00:00Z', ended_at: '2026-01-01T00:00:00Z' }], now)).toEqual([])
  })
})
