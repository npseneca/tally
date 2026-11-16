import { useEffect, useRef, type ReactNode } from 'react'
import { PALETTE } from '../palette'

let openSheets = 0

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    // Sheets can stack (Settings > Edit activity), so count them.
    openSheets++
    document.body.classList.add('sheet-open')
    return () => {
      window.removeEventListener('keydown', onKey)
      if (--openSheets === 0) document.body.classList.remove('sheet-open')
    }
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="swatches" role="radiogroup" aria-label="Color">
      {PALETTE.map((p) => (
        <button
          key={p.value}
          type="button"
          role="radio"
          aria-checked={value.toUpperCase() === p.value.toUpperCase()}
          aria-label={p.name}
          className="swatch"
          style={{ background: p.value }}
          onClick={() => onChange(p.value)}
        />
      ))}
    </div>
  )
}

/** Calls back on a mostly-horizontal swipe: -1 for swipe right (back), +1 for swipe left (forward). */
export function useSwipe(onSwipe: (dir: -1 | 1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0]
      start.current = { x: t.clientX, y: t.clientY }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!start.current) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.current.x
      const dy = t.clientY - start.current.y
      start.current = null
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx > 0 ? -1 : 1)
    },
  }
}

export function PeriodNav({
  label,
  sub,
  onPrev,
  onNext,
  canNext,
  onReset,
}: {
  label: string
  sub?: string
  onPrev: () => void
  onNext: () => void
  canNext: boolean
  onReset?: () => void
}) {
  return (
    <div className="period-nav">
      <button className="icon-btn" onClick={onPrev} aria-label="Previous">
        <Icon name="left" />
      </button>
      <button className="period-label" onClick={onReset} disabled={!onReset}>
        <span>{label}</span>
        {sub && <small>{sub}</small>}
      </button>
      <button className="icon-btn" onClick={onNext} disabled={!canNext} aria-label="Next">
        <Icon name="right" />
      </button>
    </div>
  )
}

const PATHS: Record<string, ReactNode> = {
  today: (
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9v4l2.5 2M9.5 2.5h5" />
    </>
  ),
  entries: <path d="M8 6h12M8 12h12M8 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  week: <path d="M5 20V11M12 20V4M19 20v-6" />,
  month: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 2.5v4M16 2.5v4" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  left: <path d="M15 5l-7 7 7 7" />,
  right: <path d="M9 5l7 7-7 7" />,
  up: <path d="M5 15l7-7 7 7" />,
  down: <path d="M5 9l7 7 7-7" />,
  play: <path d="M8.5 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4l-11-6.8a.8.8 0 0 0-1.2.7z" fill="currentColor" stroke="none" />,
  edit: <path d="M4 20h4L19.5 8.5l-4-4L4 16v4zM13.5 6.5l4 4" />,
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor" stroke="none" />,
}

export function Icon({ name, size = 22 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
