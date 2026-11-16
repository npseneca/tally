export const MIN = 60_000
export const HOUR = 3_600_000
export const DAY = 86_400_000

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Calendar-day arithmetic (safe across daylight saving changes). */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

/** Weeks run Monday to Sunday. */
export function startOfWeek(d: Date): Date {
  const s = startOfDay(d)
  return addDays(s, -((s.getDay() + 6) % 7))
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

/** "0m", "45m", "3h", "3h 20m" */
export function fmtDuration(ms: number): string {
  const mins = Math.round(Math.max(0, ms) / MIN)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** "4:05" or "1:04:05" for a live timer. */
export function fmtClock(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

/** Compact hours for chart labels: "", "0.5", "3.2", "12" */
export function fmtHoursShort(ms: number): string {
  if (ms < MIN) return ''
  const h = ms / HOUR
  if (h >= 10) return String(Math.round(h))
  return (Math.round(h * 10) / 10).toString()
}

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function fmtDayLong(d: Date): string {
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}

export function fmtDayShort(d: Date): string {
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

export function fmtRange(from: Date, toInclusive: Date): string {
  const sameMonth = from.getMonth() === toInclusive.getMonth()
  const a = from.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const b = toInclusive.toLocaleDateString(
    [],
    sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' },
  )
  return `${a} – ${b}`
}

/** Value for <input type="datetime-local">, in local time. */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInput(s: string): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}
