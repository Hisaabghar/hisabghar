import { rsRaw } from '../../lib/format'
import { cleanNumber, num } from './kit'

export interface ItemLine {
  key: number
  name: string
  cat: string
  amount: string
}
let nextKey = 1
export const newLine = (cat: string): ItemLine => ({ key: nextKey++, name: '', cat, amount: '' })
export const linesTotal = (lines: ItemLine[]) => lines.reduce((s, l) => s + num(l.amount), 0)
export const filledLines = (lines: ItemLine[]) => lines.filter((l) => num(l.amount) > 0)

/** Several items (each with its own title, category and amount) entered together, with a subtotal. */
export function MultiItems({ lines, setLines, cats }: { lines: ItemLine[]; setLines: (f: (l: ItemLine[]) => ItemLine[]) => void; cats: string[] }) {
  const set = (key: number, patch: Partial<ItemLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const total = linesTotal(lines)
  return (
    <div className="multiBox">
      {lines.map((l, i) => (
        <div key={l.key} className="multiRow">
          <span className="multiNo">{i + 1}</span>
          <input className="multiName" value={l.name} onChange={(e) => set(l.key, { name: e.target.value })} placeholder="Title, e.g. Milk" maxLength={60} />
          <input
            className="multiAmt"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={l.amount}
            onChange={(e) => set(l.key, { amount: cleanNumber(e.target.value) })}
            placeholder="Rs"
          />
          <select className="multiCat" value={l.cat} onChange={(e) => set(l.key, { cat: e.target.value })}>
            {cats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {lines.length > 1 && (
            <button type="button" className="splitDel" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Remove">
              ×
            </button>
          )}
        </div>
      ))}
      <button type="button" className="linkBtn" onClick={() => setLines((ls) => [...ls, newLine(ls[ls.length - 1]?.cat ?? cats[0])])}>
        ＋ Add another item
      </button>
      <div className="totalLine subTotal">
        <span>
          Subtotal · {filledLines(lines).length} {filledLines(lines).length === 1 ? 'item' : 'items'}
        </span>
        <b>{rsRaw(total)}</b>
      </div>
    </div>
  )
}
