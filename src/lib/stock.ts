import { doc, runTransaction } from 'firebase/firestore'
import type { Product, StockBatch, StockReason } from '../types'
import { stockCol, stockLogCol } from './paths'
import { db } from './firebase'
import { addItem } from '../hooks/useData'
import { today } from './format'

export const isLow = (p: Product) => p.qty <= (p.minQty ?? 0)

/** Batches oldest-first; products saved before batches existed count as one batch. */
export function batchesOf(p: Pick<Product, 'qty' | 'costPrice' | 'batches'>): StockBatch[] {
  if (p.batches?.length) return p.batches.filter((b) => b.qty > 0)
  return p.qty > 0 ? [{ qty: p.qty, cost: p.costPrice, date: '' }] : []
}

/** Takes `qty` out of the oldest batches first and returns what that stock cost. */
export function takeFifo(batches: StockBatch[], qty: number, fallbackCost: number) {
  const left = batches.map((b) => ({ ...b }))
  let need = qty
  let cost = 0
  while (need > 0 && left.length) {
    const b = left[0]
    const used = Math.min(b.qty, need)
    cost += used * b.cost
    b.qty -= used
    need -= used
    if (b.qty <= 0) left.shift()
  }
  // Selling more than is recorded: price the rest at the last known cost.
  if (need > 0) cost += need * fallbackCost
  return { cost, left }
}

async function log(
  uid: string,
  p: { id: string; name: string },
  change: number,
  reason: StockReason,
  extra: { unitCost?: number; note?: string; date?: string },
) {
  await addItem(stockLogCol(uid), {
    productId: p.id,
    name: p.name,
    change,
    reason,
    ...(extra.unitCost !== undefined ? { unitCost: Math.round(extra.unitCost * 100) / 100 } : {}),
    note: extra.note ?? '',
    date: extra.date ?? today(),
  })
}

/** Adds a delivery as its own batch at its own cost. */
export async function addStock(
  uid: string,
  p: { id: string; name: string },
  qty: number,
  cost: number,
  extra: { note?: string; date?: string; reason?: StockReason; sale?: number } = {},
) {
  if (qty <= 0) return
  const ref = doc(stockCol(uid), p.id)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const cur = snap.data() as Product
    const batches = batchesOf(cur).map((b) => ({ ...b, sale: b.sale ?? cur.salePrice }))
    batches.push({ qty, cost, sale: extra.sale && extra.sale > 0 ? extra.sale : cur.salePrice, date: extra.date ?? today() })
    // costPrice/salePrice always show the stock that will be sold next (the oldest batch).
    tx.update(ref, { batches, qty: (cur.qty ?? 0) + qty, costPrice: batches[0].cost, salePrice: batches[0].sale ?? cur.salePrice })
  })
  await log(uid, p, qty, extra.reason ?? 'purchase', { unitCost: cost, ...extra })
}

/** Removes stock oldest-first (sale or damage) and returns the total cost of what left. */
export async function takeStock(uid: string, p: { id: string; name: string }, qty: number, reason: StockReason, extra: { note?: string; date?: string } = {}) {
  if (qty <= 0) return 0
  const ref = doc(stockCol(uid), p.id)
  const cost = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const cur = snap.data() as Product
    const batches = batchesOf(cur)
    const lastCost = batches.length ? batches[batches.length - 1].cost : cur.costPrice
    const { cost, left } = takeFifo(batches, qty, lastCost)
    // When the old batch runs out, the next batch's cost and selling price take over.
    tx.update(ref, {
      batches: left,
      qty: (cur.qty ?? 0) - qty,
      costPrice: left[0]?.cost ?? lastCost,
      salePrice: left[0]?.sale ?? cur.salePrice,
    })
    return cost
  })
  await log(uid, p, -qty, reason, { unitCost: cost / qty, ...extra })
  return cost
}

/** Deletes one stock batch (e.g. entered by mistake) and takes its quantity out of stock. */
export async function deleteBatch(uid: string, p: { id: string; name: string }, index: number) {
  const ref = doc(stockCol(uid), p.id)
  const removed = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const cur = snap.data() as Product
    const batches = batchesOf(cur).map((b) => ({ ...b, sale: b.sale ?? cur.salePrice }))
    const [gone] = batches.splice(index, 1)
    if (!gone) return null
    tx.update(ref, {
      batches,
      qty: Math.max(0, (cur.qty ?? 0) - gone.qty),
      costPrice: batches[0]?.cost ?? cur.costPrice,
      salePrice: batches[0]?.sale ?? cur.salePrice,
    })
    return gone
  })
  if (removed) await log(uid, p, -removed.qty, 'adjust', { unitCost: removed.cost, note: 'Stock batch deleted' })
}
