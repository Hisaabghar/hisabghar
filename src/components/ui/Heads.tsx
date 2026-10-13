import { useState, type ReactNode } from 'react'
import { rs } from '../../lib/format'
import { Card, Field, FormSheet } from './kit'
import { Sheet } from './Sheet'

/** Bucket for expenses that aren't in any main account. */
export const NO_HEAD = 'No main account'
export const headOf = (e: { head?: string }) => e.head || NO_HEAD

export const HEAD_ICONS = ['🏠', '🏍️', '🚗', '👨‍👩‍👧', '🍽️', '💡', '📚', '🏥', '🎉', '🕌', '🏪', '👷', '📦', '🧾']
const iconFor = (name: string, i: number) => (name === NO_HEAD ? '📄' : HEAD_ICONS[i % HEAD_ICONS.length])

/** Each main account's total for the period, in the user's order, then unassigned. */
export function headTotals(heads: string[], entries: { head?: string; amount: number }[]) {
  const names = [...heads, ...new Set(entries.map((e) => e.head).filter((h): h is string => !!h && !heads.includes(h)))]
  const rows = names.map((name) => {
    const list = entries.filter((e) => e.head === name)
    return { name, total: list.reduce((s, e) => s + e.amount, 0), count: list.length }
  })
  const none = entries.filter((e) => !e.head)
  if (none.length) rows.push({ name: NO_HEAD, total: none.reduce((s, e) => s + e.amount, 0), count: none.length })
  return rows
}

/** Tiles for the main expense accounts with their totals. */
export function HeadsCard({
  heads,
  entries,
  onOpen,
  onNew,
}: {
  heads: string[]
  entries: { head?: string; amount: number }[]
  onOpen: (name: string) => void
  onNew: () => void
}) {
  const rows = headTotals(heads, entries)
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
          Make main accounts like “House”, “Bike”, “Kids school” or “Shop rent”, put expenses in them, and see each one’s total here.
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

export function NewHeadSheet({ existing, onClose, onSave }: { existing: string[]; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const clean = name.trim()
  const taken = existing.some((h) => h.toLowerCase() === clean.toLowerCase()) || clean.toLowerCase() === NO_HEAD.toLowerCase()
  return (
    <FormSheet title="📂 New main account" onClose={onClose} canSave={!!clean && !taken} onSave={() => onSave(clean)}>
      <p className="sheetText">A main account groups expenses together, e.g. everything for the bike — fuel, repair, tyres — so you see its total.</p>
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bike, House, Kids school" maxLength={28} autoFocus />
      </Field>
      {taken && <div className="errorBanner">This name already exists.</div>}
    </FormSheet>
  )
}

/** One main account: its entries, add more, rename or delete. */
export function HeadSheet({
  name,
  total,
  children,
  onClose,
  onAdd,
  onRename,
  onDelete,
}: {
  name: string
  total: number
  children: ReactNode
  onClose: () => void
  onAdd: () => void
  onRename?: (to: string) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [mode, setMode] = useState<'view' | 'rename' | 'delete'>('view')
  const [to, setTo] = useState(name)
  return (
    <Sheet title={`📂 ${name}`} onClose={onClose}>
      <div className="headTotal">
        Total <b>{rs(total)}</b>
      </div>
      <button className="btnPrimary full" onClick={onAdd}>
        ＋ Add expense to {name === NO_HEAD ? 'expenses' : name}
      </button>
      <div className="headList">{children}</div>
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
          Delete “{name}”? Its expenses are kept and move to “{NO_HEAD}”.
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
