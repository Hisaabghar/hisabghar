import { useState } from 'react'
import { rs } from '../../lib/format'

/** Single-series bar chart with a hover/tap tooltip. */
export function BarChart({
  data,
  height = 160,
  tone = 'brand',
}: {
  data: { label: string; tip: string; value: number }[]
  height?: number
  tone?: 'brand' | 'out'
}) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  const W = 100 / Math.max(1, data.length)
  const labelEvery = Math.ceil(data.length / 8)
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <div className="empty">Is waqt ka data abhi nahi</div>
  return (
    <div className="chart" onMouseLeave={() => setHover(null)}>
      <div className="chartPlot" style={{ height }}>
        <div className="chartGrid">
          {[1, 0.5, 0].map((f) => (
            <div key={f} className="chartGridLine">
              <span>{rs(max * f).replace('Rs ', '')}</span>
            </div>
          ))}
        </div>
        <div className="chartBars">
          {data.map((d, i) => (
            <div
              key={i}
              className="chartCol"
              style={{ width: `${W}%` }}
              onMouseEnter={() => setHover(i)}
              onClick={() => setHover(i)}
            >
              <div
                className={`chartBar ${tone} ${hover === i ? 'hot' : ''}`}
                style={{ height: `${(d.value / max) * 100}%` }}
              />
            </div>
          ))}
        </div>
        {hover !== null && (
          <div className="chartTip" style={{ left: `${(hover + 0.5) * W}%` }}>
            <div className="chartTipLabel">{data[hover].tip}</div>
            <div className="chartTipVal">{rs(data[hover].value)}</div>
          </div>
        )}
      </div>
      <div className="chartAxis">
        {data.map((d, i) => (
          <span key={i} style={{ width: `${W}%` }}>
            {i % labelEvery === 0 ? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}
