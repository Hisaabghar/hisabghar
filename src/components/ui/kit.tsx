import { useState, type CSSProperties, type ReactNode } from 'react'
import type { Period } from '../../types'
import { periodLabel, rs, shiftPeriod, today } from '../../lib/format'
import { Sheet } from './Sheet'
import { Sparkline } from './Sparkline'
import { useCountUp } from '../../hooks/useCountUp'

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

export function Hero({
  label,
  value,
  children,
  delta,
  spark,
}: {
  label: string
  value: number
  children?: ReactNode
  /** Change versus the previous period, e.g. { now: 1200, before: 1000, vs: 'yesterday' }. */
  delta?: { now: number; before: number; vs: string; goodWhenUp?: boolean }
  spark?: number[]
}) {
  const shown = useCountUp(value)
  let deltaEl: ReactNode = null
  if (delta) {
    const diff = delta.now - delta.before
    const up = diff >= 0
    const good = (delta.goodWhenUp ?? true) ? up : !up
    const pct = delta.before !== 0 ? Math.round((Math.abs(diff) / Math.abs(delta.before)) * 100) : null
    deltaEl = (
      <span className={`deltaChip ${diff === 0 ? '' : good ? 'good' : 'bad'}`}>
        {diff === 0 ? '•' : up ? '▲' : '▼'} {pct !== null ? `${pct}%` : rs(Math.abs(diff))} vs {delta.vs}
      </span>
    )
  }
  return (
    <div className="hero">
      {spark && <Sparkline values={spark} />}
      <div className="heroTop">
        <div className="heroLabel">{label}</div>
        {deltaEl}
      </div>
      <div className={`heroAmt ${value < 0 ? 'neg' : ''}`}>{rs(shown)}</div>
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

export function StatGrid({ children, cols }: { children: ReactNode; cols?: number }) {
  return (
    <div className={`statGrid ${cols ? 'fixedCols' : ''}`} style={cols ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : undefined}>
      {children}
    </div>
  )
}

export function Stat({
  label,
  value,
  tone,
  hint,
  accent,
  onClick,
  icon,
}: {
  icon?: string
  label: string
  value: number | string
  tone?: 'in' | 'out'
  hint?: string
  accent?: string
  onClick?: () => void
}) {
  return (
    <div className={`stat ${onClick ? 'clickable' : ''}`} style={accent ? ({ borderLeftColor: accent, '--accent-line': accent } as CSSProperties) : undefined} onClick={onClick}>
      {icon ? (
        <div className="statHead">
          <span className="statIc">{icon}</span>
          <span className="statLabel">{label}</span>
        </div>
      ) : (
        <div className="statLabel">{label}</div>
      )}
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

export function Breakdown({
  rows,
  tone,
  icons,
}: {
  rows: [string, number][]
  tone?: 'in' | 'out'
  icons?: Record<string, string>
}) {
  const max = Math.max(1, ...rows.map((r) => r[1]))
  if (rows.length === 0) return <div className="empty">Nothing recorded for this period yet</div>
  return (
    <div className="breakdown">
      {rows.map(([label, v]) => (
        <div key={label} className="bdRow">
          <div className="bdTop">
            <span>
              {icons?.[label] && <span className="bdIc">{icons[label]}</span>}
              {label}
            </span>
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
  // A text field (not type="number"), so the mouse wheel and arrow spinners
  // can't change the amount by accident; only digits and one dot are kept.
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className="money"
      value={value}
      autoFocus={autoFocus}
      placeholder={placeholder}
      onChange={(e) => onChange(cleanNumber(e.target.value))}
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

export interface EditField {
  key: string
  label: string
  kind: 'money' | 'text' | 'date' | 'time' | 'select'
  placeholder?: string
  /** For kind 'select': value/label pairs. */
  options?: { value: string; label: string }[]
}

/** Tap an entry → edit its fields or delete it (with a confirm step). */
export function EditEntry({
  title,
  subtitle,
  fields,
  initial,
  onSave,
  onDelete,
  onClose,
  deleteNote,
}: {
  title: string
  subtitle?: string
  fields: EditField[]
  initial: object
  onSave: (values: Record<string, string | number>) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
  deleteNote?: string
}) {
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(
      fields.map((f) => {
        const v = (initial as Record<string, unknown>)[f.key]
        return [f.key, v === undefined || v === null ? '' : String(v)]
      }),
    ),
  )
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: string, v: string) => setVals((x) => ({ ...x, [k]: v }))
  const moneyOk = fields.filter((f) => f.kind === 'money').every((f) => vals[f.key] === '' || Number.isFinite(parseFloat(vals[f.key])))

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={confirm ? 'Delete this entry?' : title} onClose={onClose}>
      {subtitle && !confirm && <p className="sheetText">{subtitle}</p>}
      {error && <div className="errorBanner">{error}</div>}
      {confirm ? (
        <>
          <p className="sheetText">This can’t be undone.{deleteNote ? ` ${deleteNote}` : ''}</p>
          <div className="sheetBtns">
            <button className="btnGhost" onClick={() => setConfirm(false)}>
              Back
            </button>
            <button className="btnDanger" disabled={busy} onClick={() => run(onDelete)}>
              Yes, delete
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="editGrid">
            {fields.map((f) => (
              <Field key={f.key} label={f.label}>
                {f.kind === 'money' ? (
                  <MoneyInput value={vals[f.key]} onChange={(v) => set(f.key, v)} />
                ) : f.kind === 'select' ? (
                  <select value={vals[f.key]} onChange={(e) => set(f.key, e.target.value)}>
                    {(f.options ?? []).some((o) => o.value === vals[f.key]) || !vals[f.key] ? null : (
                      <option value={vals[f.key]}>{vals[f.key]}</option>
                    )}
                    {(f.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.kind === 'date' ? 'date' : f.kind === 'time' ? 'time' : 'text'}
                    value={vals[f.key]}
                    placeholder={f.placeholder}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                )}
              </Field>
            ))}
          </div>
          <div className="sheetBtns">
            <button className="btnGhost delOutline" onClick={() => setConfirm(true)}>
              🗑️ Delete
            </button>
            <button
              className="btnPrimary"
              disabled={busy || !moneyOk}
              onClick={() =>
                run(() =>
                  onSave(
                    Object.fromEntries(
                      fields.map((f) => [f.key, f.kind === 'money' ? num(vals[f.key]) : vals[f.key].trim()]),
                    ),
                  ),
                )
              }
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </>
      )}
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

/** Keeps digits and a single decimal point (also accepts Urdu/Arabic digits). */
export const cleanNumber = (v: string) => {
  const western = v.replace(/[٠-٩۰-۹]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d) >= 0 ? '٠١٢٣٤٥٦٧٨٩'.indexOf(d) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  const only = western.replace(/,/g, '').replace(/[^\d.]/g, '')
  const i = only.indexOf('.')
  return i < 0 ? only : only.slice(0, i + 1) + only.slice(i + 1).replace(/\./g, '')
}

export const num = (v: string) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
