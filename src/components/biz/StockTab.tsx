import { useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import type { Product, StockMove } from '../../types'
import { stockCol, stockLogCol } from '../../lib/paths'
import { allByDate, patchItem, removeItem, useLiveQuery } from '../../hooks/useData'
import { rs, shortDate, sum, today } from '../../lib/format'
import { STOCK_CATEGORIES, STOCK_UNITS } from '../../lib/catalog'
import { addStock, batchesOf, deleteBatch, isLow, takeStock } from '../../lib/stock'
import { SellSheet } from './SellSheet'
import { Card, Chips, Fab, Field, FormSheet, Hero, HeroStat, List, MoneyInput, Row, Segmented, num } from '../ui/kit'
import { Sheet } from '../ui/Sheet'

const REASON_LABEL: Record<StockMove['reason'], string> = {
  opening: 'Opening stock',
  purchase: 'Stock added',
  sale: 'Sold',
  adjust: 'Removed / adjusted',
}

export function StockTab({ uid }: { uid: string }) {
  const products = useLiveQuery<Product>(stockCol(uid), `stock-${uid}`)
  const log = useLiveQuery<StockMove>(allByDate(stockLogCol(uid)), `stocklog-${uid}`)
  const [cat, setCat] = useState('All')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [selling, setSelling] = useState(false)

  const all = [...products.items].sort((a, b) => a.name.localeCompare(b.name))
  const cats = ['All', ...new Set(all.map((p) => p.category))]
  const shown = all.filter(
    (p) => (cat === 'All' || p.category === cat) && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())),
  )
  const low = all.filter(isLow)
  const costValue = sum(all, (p) => Math.max(0, p.qty) * p.costPrice)
  const saleValue = sum(all, (p) => Math.max(0, p.qty) * p.salePrice)
  const current = all.find((p) => p.id === open) ?? null

  return (
    <>
      {(products.error || log.error) && <div className="errorBanner">{products.error || log.error}</div>}
      <Hero label="Stock value (at cost)" value={costValue}>
        <HeroStat label="Value at sale price" value={saleValue} />
        <HeroStat label="Products" value={String(all.length)} />
        <HeroStat label="Low stock" value={String(low.length)} />
      </Hero>

      {low.length > 0 && (
        <Card title={`⚠️ Running low (${low.length})`}>
          <List empty="">
            {low.map((p) => (
              <Row
                key={p.id}
                icon={String(Math.max(0, p.qty))}
                title={p.name}
                sub={`Alert at ${p.minQty} ${p.unit} · tap to add stock`}
                amount={`${p.qty} ${p.unit}`}
                tone="out"
                onClick={() => setOpen(p.id)}
              />
            ))}
          </List>
        </Card>
      )}

      <button className="sellBig" onClick={() => setSelling(true)} disabled={!all.length}>
        🛒 Sell items
      </button>

      <Card title="All products">
        <div className="stockTools">
          <input className="stockSearch" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" />
          {cats.length > 2 && <Chips options={cats} value={cat} onChange={setCat} />}
        </div>
        <List empty={all.length ? 'No products match.' : 'No products yet. Tap “+ Add product” to start your stock.'}>
          {shown.map((p) => (
            <Row
              key={p.id}
              icon={String(Math.max(0, p.qty))}
              title={p.name}
              sub={`${p.category} · cost ${rs(p.costPrice)}${batchesOf(p).length > 1 ? ` (+${batchesOf(p).length - 1} newer)` : ''} · sale ${rs(p.salePrice)}`}
              amount={`${p.qty} ${p.unit}`}
              amountSub={rs(Math.max(0, p.qty) * p.costPrice)}
              tone={isLow(p) ? 'out' : 'in'}
              onClick={() => setOpen(p.id)}
            />
          ))}
        </List>
      </Card>

      <Fab label="Add product" onClick={() => setAdding(true)} />
      {selling && <SellSheet uid={uid} products={all} date={today()} onClose={() => setSelling(false)} />}
      {adding && <ProductForm uid={uid} onClose={() => setAdding(false)} />}
      {current && (
        <ProductSheet uid={uid} p={current} log={log.items.filter((m) => m.productId === current.id)} onClose={() => setOpen(null)} />
      )}
    </>
  )
}

function ProductForm({ uid, edit, onClose }: { uid: string; edit?: Product; onClose: () => void }) {
  const [name, setName] = useState(edit?.name ?? '')
  const [category, setCategory] = useState(edit?.category ?? STOCK_CATEGORIES[0])
  const [unit, setUnit] = useState(edit?.unit ?? STOCK_UNITS[0])
  const [cost, setCost] = useState(edit ? String(edit.costPrice) : '')
  const [sale, setSale] = useState(edit ? String(edit.salePrice) : '')
  const [qty, setQty] = useState('')
  const [minQty, setMinQty] = useState(edit ? String(edit.minQty) : '2')

  return (
    <FormSheet
      title={edit ? `Edit ${edit.name}` : 'Add product'}
      onClose={onClose}
      canSave={!!name.trim()}
      onSave={async () => {
        const data = {
          name: name.trim(),
          category,
          unit,
          costPrice: num(cost),
          salePrice: num(sale),
          minQty: num(minQty),
        }
        if (edit) {
          // Cost comes from the stock batches once stock has been bought.
          const { costPrice, ...rest } = data
          await patchItem(stockCol(uid), edit.id, edit.batches?.length ? rest : { ...rest, costPrice })
          return
        }
        // Create the id locally so this also works offline.
        const ref = doc(stockCol(uid))
        setDoc(ref, { ...data, qty: 0, createdAt: Date.now() }).catch(() => {})
        if (num(qty) > 0) await addStock(uid, { id: ref.id, name: data.name }, num(qty), num(cost), { reason: 'opening', sale: num(sale) })
      }}
    >
      <Field label="Product name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Samsung charger 25W" autoFocus />
      </Field>
      <Field label="Category">
        <Chips options={STOCK_CATEGORIES} value={category} onChange={setCategory} />
      </Field>
      <Field label="Unit">
        <Chips options={STOCK_UNITS} value={unit} onChange={setUnit} />
      </Field>
      <div className="twoFields">
        {!edit?.batches?.length && (
          <Field label="Cost price (each)">
            <MoneyInput value={cost} onChange={setCost} />
          </Field>
        )}
        <Field label="Sale price (each)">
          <MoneyInput value={sale} onChange={setSale} />
        </Field>
      </div>
      <div className="twoFields">
        {!edit && (
          <Field label="Quantity in stock now">
            <MoneyInput value={qty} onChange={setQty} />
          </Field>
        )}
        <Field label="Alert when this many left">
          <MoneyInput value={minQty} onChange={setMinQty} />
        </Field>
      </div>
    </FormSheet>
  )
}

function ProductSheet({ uid, p, log, onClose }: { uid: string; p: Product; log: StockMove[]; onClose: () => void }) {
  const [mode, setMode] = useState<'view' | 'add' | 'remove' | 'edit' | 'sell'>('view')
  const [qty, setQty] = useState('')
  const batches = batchesOf(p)
  const [cost, setCost] = useState(String(batches.length ? batches[batches.length - 1].cost : p.costPrice))
  const [sale, setSale] = useState(String(batches.length ? (batches[batches.length - 1].sale ?? p.salePrice) : p.salePrice))
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const [confirmDel, setConfirmDel] = useState(false)
  const [delBatch, setDelBatch] = useState<number | null>(null)

  if (mode === 'edit') return <ProductForm uid={uid} edit={p} onClose={() => setMode('view')} />
  if (mode === 'sell') return <SellSheet uid={uid} products={[p]} date={today()} onClose={() => setMode('view')} />

  if (mode === 'add' || mode === 'remove') {
    const adding = mode === 'add'
    return (
      <FormSheet
        title={adding ? `Add stock — ${p.name}` : `Remove stock — ${p.name}`}
        onClose={() => setMode('view')}
        canSave={num(qty) > 0}
        onSave={async () => {
          if (adding) await addStock(uid, p, num(qty), num(cost), { note: note.trim(), date, sale: num(sale) })
          else await takeStock(uid, p, num(qty), 'adjust', { note: note.trim(), date })
        }}
      >
        <Segmented
          options={[
            { id: 'add', label: 'Add (bought)' },
            { id: 'remove', label: 'Remove (damaged / lost)' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <div className="twoFields">
          <Field label={`Quantity (${p.unit})`}>
            <MoneyInput value={qty} onChange={setQty} autoFocus />
          </Field>
          {adding && (
            <Field label="Cost price of this new stock (each)">
              <MoneyInput value={cost} onChange={setCost} />
            </Field>
          )}
        </div>
        {adding && (
          <div className="twoFields">
            <Field label="Selling price of this new stock (each)">
              <MoneyInput value={sale} onChange={setSale} />
            </Field>
            <div className="field">
              <label>Profit each</label>
              <div className={`profitEach ${num(sale) - num(cost) < 0 ? 'neg' : ''}`}>{rs(num(sale) - num(cost))}</div>
            </div>
          </div>
        )}
        {adding && <div className="statHint">New stock is kept separately at its own cost and selling price, and is sold after the older stock runs out.</div>}
        <Field label="Note (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={adding ? 'e.g. from Hall Road supplier' : 'e.g. broken'} />
        </Field>
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </FormSheet>
    )
  }

  return (
    <Sheet title={p.name} onClose={onClose}>
      <div className="productStats">
        <div>
          <span>In stock</span>
          <b className={isLow(p) ? 'lowTxt' : ''}>
            {p.qty} {p.unit}
          </b>
        </div>
        <div>
          <span>Cost / sale</span>
          <b>
            {rs(p.costPrice)} / {rs(p.salePrice)}
          </b>
        </div>
        <div>
          <span>Profit each (now)</span>
          <b>{rs(p.salePrice - p.costPrice)}</b>
        </div>
      </div>
      {batches.length > 0 && (
        <div className="batchList">
          {batches.map((b, i) => (
            <div key={i} className={i === 0 ? 'cur' : ''}>
              <span>{i === 0 ? 'Selling now (old stock)' : `New stock ${batches.length > 2 ? i : ''}`.trim()}</span>
              <b>
                {b.qty} {p.unit} · cost {rs(b.cost)} · sell {rs(b.sale ?? p.salePrice)}
              </b>
              <span className="statHint">{b.date ? shortDate(b.date) : ''}</span>
              {delBatch === i ? (
                <span className="batchDel">
                  <button
                    className="btnDanger"
                    onClick={async () => {
                      await deleteBatch(uid, p, i)
                      setDelBatch(null)
                    }}
                  >
                    Delete {b.qty} {p.unit}?
                  </button>
                  <button className="btnGhost" onClick={() => setDelBatch(null)}>
                    No
                  </button>
                </span>
              ) : (
                <button className="batchTrash" title="Delete this stock" onClick={() => setDelBatch(i)}>
                  🗑️
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <button className="sellBig" onClick={() => setMode('sell')}>
        🛒 Sell this
      </button>
      <div className="quickAdd">
        <button className="quickBtn" onClick={() => setMode('add')}>
          <span className="qIc">+</span> Add stock
        </button>
        <button className="quickBtn secondary" onClick={() => setMode('remove')}>
          <span className="qIc">−</span> Remove
        </button>
      </div>
      <div className="settingsHead">History</div>
      <List empty="No stock movements yet.">
        {log.slice(0, 25).map((m) => (
          <Row
            key={m.id}
            icon={m.change > 0 ? '⬆️' : '⬇️'}
            title={REASON_LABEL[m.reason]}
            sub={[m.unitCost ? `@ ${rs(m.unitCost)}` : '', m.note].filter(Boolean).join(' · ') || undefined}
            amount={`${m.change > 0 ? '+' : ''}${m.change} ${p.unit}`}
            amountSub={shortDate(m.date)}
            tone={m.change > 0 ? 'in' : 'out'}
          />
        ))}
      </List>
      <div className="sheetBtns">
        <button className="btnGhost" onClick={() => setMode('edit')}>
          Edit
        </button>
        {confirmDel ? (
          <button
            className="btnDanger"
            onClick={async () => {
              await removeItem(stockCol(uid), p.id)
              onClose()
            }}
          >
            Tap again to delete
          </button>
        ) : (
          <button className="btnGhost" onClick={() => setConfirmDel(true)}>
            Delete product
          </button>
        )}
        <button className="btnPrimary" onClick={onClose}>
          Done
        </button>
      </div>
    </Sheet>
  )
}
