import { useState } from 'react'
import { rs } from '../../lib/format'

export interface Slice {
  label: string
  value: number
  /** CSS colour (a var(--series-n) token). */
  color: string
}

/** Donut with a centre total and a legend that carries every label and value. */
export function Donut({ slices, centerLabel }: { slices: Slice[]; centerLabel: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0)
  const R = 42
  const C = 2 * Math.PI * R
  // 2px surface gap between neighbouring slices.
  const gap = slices.filter((s) => s.value > 0).length > 1 ? 1.2 : 0
  let offset = 0
  const shown = hover !== null ? slices[hover] : null

  return (
    <div className="donutWrap">
      <div className="donut">
        <svg viewBox="0 0 100 100" role="img" aria-label={centerLabel}>
          <circle cx="50" cy="50" r={R} className="donutTrack" />
          {total > 0 &&
            slices.map((s, i) => {
              const len = (Math.max(0, s.value) / total) * C
              const dash = Math.max(0, len - gap)
              const el =
                len > 0 ? (
                  <circle
                    key={s.label}
                    cx="50"
                    cy="50"
                    r={R}
                    className={`donutArc ${hover === i ? 'hot' : ''}`}
                    stroke={s.color}
                    strokeDasharray={`${dash} ${C - dash}`}
                    strokeDashoffset={-offset}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                ) : null
              offset += len
              return el
            })}
        </svg>
        <div className="donutCenter">
          <div className="donutCenterLabel">{shown ? shown.label : centerLabel}</div>
          <div className="donutCenterVal">{rs(shown ? shown.value : total)}</div>
        </div>
      </div>
      <div className="legend">
        {slices.map((s, i) => (
          <div
            key={s.label}
            className={`legendRow ${hover === i ? 'hot' : ''}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="legendDot" style={{ background: s.color }} />
            <span className="legendLabel">{s.label}</span>
            <span className="legendVal">{rs(s.value)}</span>
            <span className="legendPct">{total > 0 ? Math.round((Math.max(0, s.value) / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
