import { useState, type ReactNode } from 'react'
import { rs } from '../../lib/format'
import { Card, Field, FormSheet } from './kit'
import { Sheet } from './Sheet'

/** Bucket for expenses that aren't in any main account. */
export const NO_HEAD = 'No main account'
/** Saved on an entry the user deliberately kept out of every main account. */
export const OUT_OF_HEADS = '-'

type HeadEntry = { id: string; head?: string; category: string; amount: number }
/** Category → main account, so e.g. every "Fuel" expense goes into "Bike" by itself. */
export type HeadMap = Record<string, string>
export type Resolve = (e: { head?: string; category: string }) => string
export const headResolver =
  (map: HeadMap = {}): Resolve =>
  (e) =>
    e.head === OUT_OF_HEADS ? NO_HEAD : e.head || map[e.category] || NO_HEAD

/** Choices for an entry's main account: automatic (by category), a chosen account, or none. */
export function headOptions(heads: string[], autoHead?: string) {
  return [
    { value: '', label: autoHead ? `Automatic (${autoHead})` : 'Automatic (by category)' },
    ...heads.map((h) => ({ value: h, label: h })),
    { value: OUT_OF_HEADS, label: 'Not in any account' },
  ]
}

export const HEAD_ICONS = ['🏠', '🏍️', '🚗', '👨‍👩‍👧', '🍽️', '💡', '📚', '🏥', '🎉', '🕌', '🏪', '👷', '📦', '🧾']
const iconFor = (name: string, i: number) => (name === NO_HEAD ? '📄' : HEAD_ICONS[i % HEAD_ICONS.length])

/** Each main account's total for the period, in the user's order, then unassigned. */
export function headTotals(heads: string[], entries: HeadEntry[], resolve: Resolve) {
  const used = entries.map(resolve)
  const names = [...heads, ...new Set(used.filter((h) => h !== NO_HEAD && !heads.includes(h)))]
  const rows = names.map((name) => {
    const list = entries.filter((_e, i) => used[i] === name)
    return { name, total: list.reduce((s, e) => s + e.amount, 0), count: list.length }
  })
  const none = entries.filter((_e, i) => used[i] === NO_HEAD)
  if (none.length) rows.push({ name: NO_HEAD, total: none.reduce((s, e) => s + e.amount, 0), count: none.length })
  return rows
}

/** Pick several categories. */
function MultiChips({ options, value, onToggle }: { options: string[]; value: string[]; onToggle: (c: string) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o} type="button" className={`chip ${value.includes(o) ? 'active' : ''}`} onClick={() => onToggle(o)}>
          {value.includes(o) ? '✓ ' : ''}
          {o}
        </button>
      ))}
    </div>
  )
}

/** Tiles for the main expense accounts with their totals. */
export function HeadsCard({
  heads,
  entries,
  resolve,
  onOpen,
  onNew,
}: {
  heads: string[]
  entries: HeadEntry[]
  resolve: Resolve
  onOpen: (name: string) => void
  onNew: () => void
}) {
  const rows = headTotals(heads, entries, resolve)
  const all = rows.reduce((s, r) => s + r.total, 0)
  return (
    <Card
      title="📂 Main expense accounts"
      action={
        <button className="linkBtn" onClick={onNew}>
          ＋ New account
        </button>
      }
    >
      {rows.length === 0 ? (
        <div className="empty">
          Make a main account like “Bike”, link its categories (Fuel, Bike maintenance…) and every such expense goes into it by itself. See each account’s total here.
        </div>
      ) : (
        <div className="headGrid">
          {rows.map((r, i) => (
            <button key={r.name} className={`headTile ${r.name === NO_HEAD ? 'none' : ''}`} onClick={() => onOpen(r.name)}>
              <span className="headIc">{iconFor(r.name, i)}</span>
              <span className="headName">{r.name}</span>
              <span className="headAmt">{rs(r.total)}</span>
              <span className="headSub">
                {r.count} {r.count === 1 ? 'entry' : 'entries'}
                {all > 0 ? ` · ${Math.round((r.total / all) * 100)}%` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}

export function NewHeadSheet({
  existing,
  cats,
  map,
  onClose,
  onSave,
}: {
  existing: string[]
  cats: string[]
  map: HeadMap
  onClose: () => void
  onSave: (name: string, cats: string[]) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const clean = name.trim()
  const taken = existing.some((h) => h.toLowerCase() === clean.toLowerCase()) || clean.toLowerCase() === NO_HEAD.toLowerCase()
  return (
    <FormSheet title="📂 New main account" onClose={onClose} canSave={!!clean && !taken} onSave={() => onSave(clean, picked)}>
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bike expenses, House, Kids school" maxLength={28} autoFocus />
      </Field>
      {taken && <div className="errorBanner">This name already exists.</div>}
      <Field label="Which expenses go into it? (tap to pick)">
        <MultiChips options={cats} value={picked} onToggle={(c) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))} />
      </Field>
      <div className="statHint">
        Every expense with these categories — old and new — is counted in this account by itself. Need a new one like “Bike maintenance”? Add it
        as a category when you add an expense, then link it here.
        {picked.some((c) => map[c]) && ` Picked categories already in another account move to this one.`}
      </div>
    </FormSheet>
  )
}

/** Entries grouped by their name (category), each group with its subtotal. */
function Grouped<T extends HeadEntry>({ entries, row }: { entries: T[]; row: (e: T) => ReactNode }) {
  const groups = new Map<string, T[]>()
  for (const e of entries) groups.set(e.category, [...(groups.get(e.category) ?? []), e])
  const list = [...groups.entries()].sort((a, b) => b[1].reduce((s, e) => s + e.amount, 0) - a[1].reduce((s, e) => s + e.amount, 0))
  const [closed, setClosed] = useState<string[]>([])
  if (!list.length) return <div className="empty">No expenses in this account for this period.</div>
  return (
    <div className="groupList">
      {list.map(([name, items]) => {
        const shut = closed.includes(name)
        return (
          <div key={name} className="group">
            <button className="groupHead" onClick={() => setClosed((c) => (shut ? c.filter((x) => x !== name) : [...c, name]))}>
              <span className="groupChev">{shut ? '▸' : '▾'}</span>
              <span className="groupName">
                {name}
                <small>
                  {items.length} {items.length === 1 ? 'entry' : 'entries'}
                </small>
              </span>
              <b>{rs(items.reduce((s, e) => s + e.amount, 0))}</b>
            </button>
            {!shut && <div className="list">{items.map(row)}</div>}
          </div>
        )
      })}
    </div>
  )
}

/** One main account: its entries, add more, rename or delete. */
export function HeadSheet<T extends HeadEntry>({
  name,
  entries,
  row,
  cats,
  map,
  onLink,
  onClose,
  onAdd,
  onRename,
  onDelete,
}: {
  name: string
  entries: T[]
  row: (e: T) => ReactNode
  cats: string[]
  map: HeadMap
  onLink: (cat: string, on: boolean) => Promise<void>
  onClose: () => void
  onAdd: () => void
  onRename?: (to: string) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [mode, setMode] = useState<'view' | 'rename' | 'delete' | 'link'>('view')
  const [to, setTo] = useState(name)
  const total = entries.reduce((s, e) => s + e.amount, 0)
  const linked = cats.filter((c) => map[c] === name)
  return (
    <Sheet title={`📂 ${name}`} onClose={onClose}>
      <div className="headTotal">
        Total <b>{rs(total)}</b>
      </div>
      <button className="btnPrimary full" onClick={onAdd}>
        ＋ Add expense to {name === NO_HEAD ? 'expenses' : name}
      </button>
      {name !== NO_HEAD && (
        <div className="linkedCats">
          <span>Goes in automatically: </span>
          {linked.length ? linked.map((c) => <span key={c} className="chip mini">{c}</span>) : <i>nothing linked yet</i>}
          <button className="linkBtn" onClick={() => setMode(mode === 'link' ? 'view' : 'link')}>
            {mode === 'link' ? 'Done' : '🔗 Choose'}
          </button>
        </div>
      )}
      {mode === 'link' && (
        <MultiChips options={cats} value={linked} onToggle={(c) => void onLink(c, !linked.includes(c))} />
      )}
      <div className="statHint">Tap any entry to edit it, move it to another main account, or delete it.</div>
      <div className="headList">
        <Grouped entries={entries} row={row} />
      </div>
      {mode === 'rename' && onRename && (
        <div className="inlineAdd">
          <input autoFocus value={to} onChange={(e) => setTo(e.target.value)} maxLength={28} />
          <button
            className="btnPrimary"
            disabled={!to.trim() || to.trim() === name}
            onClick={async () => {
              await onRename(to.trim())
              onClose()
            }}
          >
            Save
          </button>
        </div>
      )}
      {mode === 'delete' && onDelete && (
        <div className="errorBanner">
          Delete “{name}”? Its expenses are kept; they just won’t be grouped in it any more.
          <div className="sheetBtns">
            <button className="btnGhost" onClick={() => setMode('view')}>
              Cancel
            </button>
            <button
              className="btnDanger"
              onClick={async () => {
                await onDelete()
                onClose()
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
      {name !== NO_HEAD && mode === 'view' && (
        <div className="sheetBtns">
          {onRename && (
            <button className="btnGhost" onClick={() => setMode('rename')}>
              ✏️ Rename
            </button>
          )}
          {onDelete && (
            <button className="btnGhost danger" onClick={() => setMode('delete')}>
              🗑️ Delete account
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}
