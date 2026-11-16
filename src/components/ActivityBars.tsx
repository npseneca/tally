import { fmtDuration, MIN } from '../time'

export interface BarRow {
  id: string
  name: string
  color: string
  ms: number
  /** Time in the comparison period; omit to hide the change. */
  previous?: number
  /** Totals for consecutive periods ending with this one. */
  trend?: number[]
}

function Change({ ms, previous }: { ms: number; previous: number }) {
  const diff = ms - previous
  if (previous < MIN && ms >= MIN) return <span className="change">new</span>
  if (Math.abs(diff) < MIN) return <span className="change">same</span>
  return (
    <span className="change">
      {diff > 0 ? '▲' : '▼'} {fmtDuration(Math.abs(diff))}
    </span>
  )
}

function Spark({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  const w = 5
  const gap = 2
  const h = 20
  return (
    <svg className="spark" width={values.length * (w + gap) - gap} height={h} aria-hidden="true">
      {values.map((v, i) => {
        const bh = v > 0 ? Math.max(2, (v / max) * h) : 1
        return (
          <rect
            key={i}
            x={i * (w + gap)}
            y={h - bh}
            width={w}
            height={bh}
            rx={1.5}
            fill={i === values.length - 1 ? color : 'var(--line-strong)'}
          />
        )
      })}
    </svg>
  )
}

/** Ranked horizontal bars: one row per activity with its time and share of the total. */
export function ActivityBars({ rows, changeLabel }: { rows: BarRow[]; changeLabel?: string }) {
  const shown = rows.filter((r) => r.ms >= MIN || (r.previous ?? 0) >= MIN).sort((a, b) => b.ms - a.ms)
  const total = shown.reduce((t, r) => t + r.ms, 0)
  const max = Math.max(...shown.map((r) => r.ms), 1)
  if (shown.length === 0) return <p className="hint center">Nothing tracked here.</p>

  return (
    <div className="bars">
      {shown.map((r) => (
        <div key={r.id} className="bar-row" style={{ '--c': r.color } as React.CSSProperties}>
          <div className="bar-top">
            <span className="bar-name">
              <i className="dot" />
              {r.name}
            </span>
            <span className="bar-value">
              {fmtDuration(r.ms)}
              <small>{total > 0 ? Math.round((r.ms / total) * 100) : 0}%</small>
            </span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(r.ms / max) * 100}%` }} />
          </div>
          {(r.previous !== undefined || r.trend) && (
            <div className="bar-foot">
              {r.previous !== undefined && <Change ms={r.ms} previous={r.previous} />}
              {r.trend && <Spark values={r.trend} color={r.color} />}
            </div>
          )}
        </div>
      ))}
      {changeLabel && <p className="hint">{changeLabel}</p>}
    </div>
  )
}
