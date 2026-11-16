import { addDays } from './time'

export interface Span {
  activity_id: string
  start: number
  end: number
}

interface EntryLike {
  activity_id: string
  started_at: string
  ended_at: string | null
}

/** Turn entries into millisecond spans; a running entry ends at `now`. */
export function toSpans(entries: EntryLike[], now: number): Span[] {
  const out: Span[] = []
  for (const e of entries) {
    const start = Date.parse(e.started_at)
    const end = e.ended_at ? Date.parse(e.ended_at) : now
    if (end > start) out.push({ activity_id: e.activity_id, start, end })
  }
  return out
}

/** Time per activity inside [from, to), counting only the overlapping part of each span. */
export function totalsByActivity(spans: Span[], from: number, to: number): Map<string, number> {
  const totals = new Map<string, number>()
  for (const s of spans) {
    const overlap = Math.min(s.end, to) - Math.max(s.start, from)
    if (overlap > 0) totals.set(s.activity_id, (totals.get(s.activity_id) ?? 0) + overlap)
  }
  return totals
}

export function sum(totals: Map<string, number>): number {
  let t = 0
  for (const v of totals.values()) t += v
  return t
}

/** Per-activity totals for each of `count` consecutive local days starting at `first`. */
export function dailyTotals(spans: Span[], first: Date, count: number): Map<string, number>[] {
  const days: Map<string, number>[] = []
  for (let i = 0; i < count; i++) {
    days.push(totalsByActivity(spans, addDays(first, i).getTime(), addDays(first, i + 1).getTime()))
  }
  return days
}
