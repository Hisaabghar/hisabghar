import { doc, increment, updateDoc } from 'firebase/firestore'
import type { Product, StockReason } from '../types'
import { stockCol, stockLogCol } from './paths'
import { addItem } from '../hooks/useData'
import { today } from './format'

export const isLow = (p: Product) => p.qty <= (p.minQty ?? 0)

/** Changes a product's quantity and records why in the stock log. */
export async function moveStock(
  uid: string,
  p: { id: string; name: string },
  change: number,
  reason: StockReason,
  extra: { unitCost?: number; note?: string; date?: string } = {},
) {
  if (!change) return
  await updateDoc(doc(stockCol(uid), p.id), { qty: increment(change) })
  await addItem(stockLogCol(uid), {
    productId: p.id,
    name: p.name,
    change,
    reason,
    ...(extra.unitCost !== undefined ? { unitCost: extra.unitCost } : {}),
    note: extra.note ?? '',
    date: extra.date ?? today(),
  })
}
