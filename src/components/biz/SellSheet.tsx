import { useRef, useState } from 'react'
import type { Product, Settings } from '../../types'
import { bizCol, creditCol, settingsDoc } from '../../lib/paths'
import { addItem, useLiveDoc } from '../../hooks/useData'
import { PdfReady, makeInvoice } from './DocsTab'
import { rsRaw } from '../../lib/format'
import { batchesOf, takeFifo, takeStock } from '../../lib/stock'
import { Field, FormSheet, MoneyInput, Segmented, num } from '../ui/kit'

interface Line {
  key: number
  productId: string // '' = item not kept in stock
  name: string
  qty: string
  price: string
  cost: string // only used for items not in stock
}

let nextKey = 1
const newSaleId = () => `${Date.now()}-${nextKey++}`
const blank = (): Line => ({ key: nextKey++, productId: '', name: '', qty: '1', price: '', cost: '' })

/** Point-of-sale: one or more items, optional discount, stock taken oldest-first. */
export function SellSheet({ uid, products, date: initialDate, onClose }: { uid: string; products: Product[]; date: string; onClose: () => void }) {
  const [lines, setLines] = useState<Line[]>([blank()])
  const [discMode, setDiscMode] = useState<'rs' | 'pct'>('rs')
  const [disc, setDisc] = useState('')
  const [customer, setCustomer] = useState('')
  const [phone, setPhone] = useState('')
  const [pay, setPay] = useState<'now' | 'credit'>('now')
  const onCredit = pay === 'credit'
  const [date, setDate] = useState(initialDate)
  const [makeBill, setMakeBill] = useState(false)
  const settings = useLiveDoc<Settings>(settingsDoc(uid), `settings-${uid}`).data
  const [ready, setReady] = useState<Awaited<ReturnType<typeof makeInvoice>> | null>(null)
  const billMade = useRef(false)
  const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name))

  const set = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const lineTotal = (l: Line) => Math.max(1, num(l.qty)) * num(l.price)
  const valid = lines.filter((l) => (l.productId || l.name.trim()) && num(l.price) > 0)
  const subtotal = valid.reduce((s, l) => s + lineTotal(l), 0)
  const discount = Math.min(subtotal, Math.max(0, discMode === 'rs' ? num(disc) : (subtotal * num(disc)) / 100))
  const total = subtotal - discount

  // Profit preview using the oldest stock first, as the save will.
  const costOf = (l: Line) => {
    const q = Math.max(1, num(l.qty))
    const p = products.find((x) => x.id === l.productId)
    if (!p) return q * num(l.cost)
    const b = batchesOf(p)
    return takeFifo(b, q, b.length ? b[b.length - 1].cost : p.costPrice).cost
  }
  const totalCost = valid.reduce((s, l) => s + costOf(l), 0)

  if (ready) return <PdfReady ready={ready} onClose={onClose} />

  return (
    <FormSheet
      title="🛒 New sale"
      onClose={() => {
        if (!billMade.current) onClose()
      }}
      canSave={valid.length > 0 && (!onCredit || !!customer.trim())}
      onSave={async () => {
        const saleId = newSaleId()
        const itemsText = valid.map((l) => `${products.find((x) => x.id === l.productId)?.name ?? l.name.trim()} ×${Math.max(1, num(l.qty))}`).join(', ')
        for (const l of valid) {
          const q = Math.max(1, num(l.qty))
          const p = products.find((x) => x.id === l.productId)
          const gross = lineTotal(l)
          // Share the discount across lines by value.
          const share = subtotal ? (discount * gross) / subtotal : 0
          const amount = gross - share
          const cost = p ? await takeStock(uid, p, q, 'sale', { date, note: customer.trim() }) : q * num(l.cost)
          await addItem(bizCol(uid), {
            kind: 'acc',
            date,
            note: customer.trim(),
            item: p ? p.name : l.name.trim(),
            qty: q,
            price: num(l.price),
            discount: Math.round(share),
            cost: Math.round((cost / q) * 100) / 100,
            amount: Math.round(amount),
            profit: Math.round(amount - cost),
            saleId,
            ...(p ? { productId: p.id } : {}),
            ...(onCredit ? { onCredit: true } : {}),
            ...(phone.trim() ? { phone: phone.trim() } : {}),
          })
        }
        // Udhaar sale: the customer owes the total in their khata.
        if (onCredit)
          await addItem(creditCol(uid), {
            customer: customer.trim(),
            ...(phone.trim() ? { phone: phone.trim() } : {}),
            kind: 'credit',
            amount: Math.round(total),
            note: itemsText,
            date,
          })
        if (makeBill) {
          billMade.current = true
          setReady(
            await makeInvoice(uid, { rates: {}, ...settings }, {
              customer: customer.trim(),
              ...(phone.trim() ? { phone: phone.trim() } : {}),
              date,
              items: valid.map((l) => ({
                name: products.find((x) => x.id === l.productId)?.name ?? l.name.trim(),
                qty: Math.max(1, num(l.qty)),
                price: num(l.price),
              })),
              discount: Math.round(discount),
              paid: onCredit ? 0 : Math.round(total),
            }),
          )
        }
      }}
    >
      {lines.map((l, i) => {
        const p = products.find((x) => x.id === l.productId)
        const batches = p ? batchesOf(p) : []
        return (
          <div key={l.key} className="saleLine">
            <div className="saleLineHead">
              <span>Item {i + 1}</span>
              {lines.length > 1 && (
                <button type="button" className="splitDel" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                  ×
                </button>
              )}
            </div>
            <select
              value={l.productId}
              onChange={(e) => {
                const np = products.find((x) => x.id === e.target.value)
                set(l.key, { productId: e.target.value, price: np ? String(np.salePrice) : l.price, name: np ? np.name : l.name })
              }}
            >
              <option value="">— Item not in stock —</option>
              {sorted.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} ({x.qty} {x.unit})
                </option>
              ))}
            </select>
            {!l.productId && (
              <input className="saleName" value={l.name} onChange={(e) => set(l.key, { name: e.target.value })} placeholder="Item name" />
            )}
            <div className={l.productId ? 'twoFields' : 'threeFields'}>
              <Field label="Qty">
                <MoneyInput value={l.qty} onChange={(v) => set(l.key, { qty: v })} placeholder="1" />
              </Field>
              <Field label="Price each">
                <MoneyInput value={l.price} onChange={(v) => set(l.key, { price: v })} />
              </Field>
              {!l.productId && (
                <Field label="Cost each">
                  <MoneyInput value={l.cost} onChange={(v) => set(l.key, { cost: v })} />
                </Field>
              )}
            </div>
            {p && batches.length > 1 && (
              <div className="statHint">
                Selling oldest stock first: {batches.map((b) => `${b.qty} @ ${rsRaw(b.cost)}`).join(' → ')}
              </div>
            )}
            {p && Math.max(1, num(l.qty)) > p.qty && (
              <div className="errorBanner">Only {p.qty} {p.unit} in stock.</div>
            )}
          </div>
        )
      })}
      <button type="button" className="linkBtn" onClick={() => setLines((ls) => [...ls, blank()])}>
        + Add another item
      </button>

      <Field label="Discount">
        <div className="discRow">
          <Segmented
            options={[
              { id: 'rs', label: 'Rs' },
              { id: 'pct', label: '%' },
            ]}
            value={discMode}
            onChange={setDiscMode}
          />
          <MoneyInput value={disc} onChange={setDisc} placeholder="0" />
        </div>
      </Field>

      <div className="receipt">
        <div>
          <span>Subtotal</span>
          <b>{rsRaw(subtotal)}</b>
        </div>
        {discount > 0 && (
          <div className="disc">
            <span>Discount</span>
            <b>− {rsRaw(discount)}</b>
          </div>
        )}
        <div className="grand">
          <span>{onCredit ? 'Total (on udhaar)' : 'Total to collect'}</span>
          <b>{rsRaw(total)}</b>
        </div>
        <div className="muted">
          <span>Your profit</span>
          <b className={total - totalCost < 0 ? 'neg' : ''}>{rsRaw(total - totalCost)}</b>
        </div>
      </div>

      <Field label="Payment">
        <Segmented
          options={[
            { id: 'now', label: '💵 Paid now' },
            { id: 'credit', label: '📒 On udhaar' },
          ]}
          value={pay}
          onChange={setPay}
        />
      </Field>
      <div className="twoFields">
        <Field label={onCredit ? 'Customer name (required)' : 'Customer (optional)'}>
          <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Name" />
        </Field>
        <Field label="Phone (optional)">
          <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+\- ]/g, ''))} placeholder="03xx-xxxxxxx" maxLength={16} />
        </Field>
      </div>
      {onCredit && <div className="statHint">The total goes into this customer’s khata (Shop → Customer khata); no cash is added to the drawer.</div>}
      <Field label="Date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <label className="checkRow soundRow">
        <input type="checkbox" checked={makeBill} onChange={(e) => setMakeBill(e.target.checked)} />
        📄 Make a bill (PDF) for the customer
      </label>
    </FormSheet>
  )
}

