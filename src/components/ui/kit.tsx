import { useState, type ReactNode } from 'react'
import type { Period } from '../../types'
import { periodLabel, rs, shiftPeriod, today } from '../../lib/format'
import { Sheet } from './Sheet'

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="subTabs">
      {tabs.map((t) => (
        <button key={t.id} className={`subTab ${t.id === value ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.id} type="button" className={`segBtn ${o.id === value ? 'active' : ''}`} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function PeriodBar({
  period,
  onChange,
  allowDay = true,
}: {
  period: Period
  onChange: (p: Period) => void
  allowDay?: boolean
}) {
  return (
    <div className="periodBar">
      {allowDay && (
        <Segmented
          options={[
            { id: 'day', label: 'Day' },
            { id: 'month', label: 'Month' },
          ]}
          value={period.mode}
          onChange={(mode) => onChange({ mode, date: period.date })}
        />
      )}
      <div className="periodNav">
        <button className="navBtn" onClick={() => onChange(shiftPeriod(period, -1))} aria-label="Previous">
          ‹
        </button>
        <label className="periodLabel">
          {periodLabel(period)}
          <input
            type={period.mode === 'day' ? 'date' : 'month'}
            value={period.mode === 'day' ? period.date : period.date.slice(0, 7)}
            onChange={(e) => {
              const v = e.target.value
              if (!v) return
              onChange({ ...period, date: period.mode === 'day' ? v : `${v}-01` })
            }}
          />
        </label>
        <button className="navBtn" onClick={() => onChange(shiftPeriod(period, 1))} aria-label="Next">
          ›
        </button>
        {period.date !== today() && (
          <button className="todayBtn" onClick={() => onChange({ ...period, date: today() })}>
            Today
          </button>
        )}
      </div>
    </div>
  )
}

export function Hero({ label, value, children }: { label: string; value: number; children?: ReactNode }) {
  return (
    <div className="hero">
      <div className="heroLabel">{label}</div>
      <div className={`heroAmt ${value < 0 ? 'neg' : ''}`}>{rs(value)}</div>
      {children && <div className="heroRow">{children}</div>}
    </div>
  )
}

/** Numbers are shown as rupees; pass a string for counts. */
export function HeroStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="heroStat">
      <div className="heroStatLabel">{label}</div>
      <div className="heroStatVal">{typeof value === 'number' ? rs(value) : value}</div>
    </div>
  )
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="statGrid">{children}</div>
}

export function Stat({
  label,
  value,
  tone,
  hint,
  accent,
  onClick,
}: {
  label: string
  value: number | string
  tone?: 'in' | 'out'
  hint?: string
  accent?: string
  onClick?: () => void
}) {
  return (
    <div className={`stat ${onClick ? 'clickable' : ''}`} style={accent ? { borderLeftColor: accent } : undefined} onClick={onClick}>
      <div className="statLabel">{label}</div>
      <div className={`statVal ${tone ?? ''}`}>{typeof value === 'number' ? rs(value) : value}</div>
      {hint && <div className="statHint">{hint}</div>}
    </div>
  )
}

export function Card({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="card">
      {(title || action) && (
        <div className="cardHead">
          {title && <div className="cardTitle">{title}</div>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export function Breakdown({ rows, tone }: { rows: [string, number][]; tone?: 'in' | 'out' }) {
  const max = Math.max(1, ...rows.map((r) => r[1]))
  if (rows.length === 0) return <div className="empty">Nothing recorded for this period yet</div>
  return (
    <div className="breakdown">
      {rows.map(([label, v]) => (
        <div key={label} className="bdRow">
          <div className="bdTop">
            <span>{label}</span>
            <span className="bdVal">{rs(v)}</span>
          </div>
          <div className="bdTrack">
            <div className={`bdBar ${tone ?? ''}`} style={{ width: `${(v / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function Row({
  icon,
  title,
  sub,
  amount,
  amountSub,
  tone,
  onClick,
  extra,
}: {
  icon: string
  title: string
  sub?: string
  amount: string
  amountSub?: string
  tone?: 'in' | 'out'
  onClick?: () => void
  extra?: ReactNode
}) {
  return (
    <div className="row" onClick={onClick}>
      <div className={`rowIcon ${tone ?? ''}`}>{icon}</div>
      <div className="rowBody">
        <div className="rowTitle">{title}</div>
        {sub && <div className="rowSub">{sub}</div>}
      </div>
      {extra}
      <div className="rowRight">
        <div className={`rowAmt ${tone ?? ''}`}>{amount}</div>
        {amountSub && <div className="rowSub">{amountSub}</div>}
      </div>
    </div>
  )
}

export function List({ empty, children }: { empty: string; children: ReactNode[] }) {
  if (children.length === 0) return <div className="empty">{empty}</div>
  return <div className="list">{children}</div>
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  )
}

export function MoneyInput({
  value,
  onChange,
  autoFocus,
  placeholder = '0',
}: {
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
  placeholder?: string
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      className="money"
      value={value}
      autoFocus={autoFocus}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o} type="button" className={`chip ${o === value ? 'active' : ''}`} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  )
}

/** Bottom sheet with Save/Cancel that runs an async save and closes on success. */
export function FormSheet({
  title,
  onClose,
  onSave,
  canSave,
  children,
}: {
  title: string
  onClose: () => void
  onSave: () => Promise<void>
  canSave: boolean
  children: ReactNode
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function save() {
    setSaving(true)
    setError(null)
    try {
      await onSave()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Sheet title={title} onClose={onClose}>
      {error && <div className="errorBanner">{error}</div>}
      {children}
      <div className="sheetBtns">
        <button className="btnGhost" onClick={onClose}>
          Cancel
        </button>
        <button className="btnPrimary" disabled={!canSave || saving} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Sheet>
  )
}

export function ConfirmDelete({ what, onClose, onConfirm }: { what: string; onClose: () => void; onConfirm: () => Promise<void> }) {
  return (
    <Sheet title="Delete this entry?" onClose={onClose}>
      <p className="sheetText">{what}</p>
      <div className="sheetBtns">
        <button className="btnGhost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btnDanger"
          onClick={async () => {
            await onConfirm()
            onClose()
          }}
        >
          Delete
        </button>
      </div>
    </Sheet>
  )
}

export function QuickActions({ items }: { items: { icon: string; label: string; hint?: string; onClick: () => void }[] }) {
  return (
    <div className="quickGrid">
      {items.map((it) => (
        <button key={it.label} className="quickTile" onClick={it.onClick}>
          <span className="quickTileIc">{it.icon}</span>
          <span className="quickTileLabel">{it.label}</span>
          {it.hint && <span className="quickTileHint">{it.hint}</span>}
        </button>
      ))}
    </div>
  )
}

export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="fab" onClick={onClick}>
      <span className="plus">+</span> {label}
    </button>
  )
}

export const num = (v: string) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
