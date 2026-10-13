import { doc, getDoc, getDocs, writeBatch, type CollectionReference, type DocumentData } from 'firebase/firestore'
import { db } from './firebase'
import {
  bizCol,
  creditCol,
  daysCol,
  homeCol,
  investCol,
  invoiceCol,
  loansCol,
  notesCol,
  settingsDoc,
  shopExpCol,
  stockCol,
  stockLogCol,
} from './paths'
import { saveBlob } from './saveFile'
import { today } from './format'

/** Every collection in a user's account, with the sheet name used in Excel. */
const COLLECTIONS: { key: string; sheet: string; col: (uid: string) => CollectionReference; first: string[] }[] = [
  { key: 'home', sheet: 'Home income & expenses', col: homeCol, first: ['date', 'time', 'type', 'category', 'amount', 'account', 'toAccount', 'owner', 'note'] },
  { key: 'loans', sheet: 'Loans', col: loansCol, first: ['date', 'person', 'kind', 'amount', 'note'] },
  { key: 'biz', sheet: 'Shop entries', col: bizCol, first: ['date', 'kind', 'item', 'qty', 'price', 'amount', 'profit', 'note'] },
  { key: 'stock', sheet: 'Stock', col: stockCol, first: ['name', 'category', 'qty', 'unit', 'costPrice', 'salePrice', 'minQty'] },
  { key: 'stockLog', sheet: 'Stock history', col: stockLogCol, first: ['date', 'name', 'reason', 'qty'] },
  { key: 'shopExp', sheet: 'Shop expenses', col: shopExpCol, first: ['date', 'category', 'amount', 'note'] },
  { key: 'credit', sheet: 'Customer khata', col: creditCol, first: ['date', 'customer', 'phone', 'kind', 'amount', 'note'] },
  { key: 'invest', sheet: 'Investment', col: investCol, first: ['date', 'category', 'amount', 'note'] },
  { key: 'invoices', sheet: 'Bills made', col: invoiceCol, first: ['no', 'date', 'customer', 'phone', 'items', 'discount', 'paid'] },
  { key: 'notes', sheet: 'Notes', col: notesCol, first: ['title', 'text', 'remindAt', 'repeat', 'pinned'] },
  { key: 'days', sheet: 'Day openings', col: daysCol, first: [] },
]
const SKIP = new Set(['id', 'batches', 'logo', 'signature', 'stamp', 'pinHash'])
const TIME_KEYS = new Set(['createdAt', 'updatedAt', 'remindAt'])

const label = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())

function cellOf(k: string, v: unknown): string | number | boolean | null {
  if (v === undefined || v === null) return null
  if (TIME_KEYS.has(k) && typeof v === 'number') return new Date(v).toLocaleString('en-GB')
  if (k === 'items' && Array.isArray(v))
    return v.map((i: { name: string; qty: number; price: number }) => `${i.name}${i.qty ? ` ×${i.qty}` : ''} @ ${i.price}`).join('; ')
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v
  return JSON.stringify(v)
}

type Dump = { key: string; docs: (DocumentData & { id: string })[] }

async function readAll(uid: string) {
  const data: Dump[] = await Promise.all(
    COLLECTIONS.map(async (c) => {
      const snap = await getDocs(c.col(uid))
      return { key: c.key, docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }
    }),
  )
  const s = await getDoc(settingsDoc(uid))
  return { data, settings: s.exists() ? s.data() : {} }
}

/** All data as an Excel file, one sheet per section. */
export async function exportExcel(uid: string) {
  const { data } = await readAll(uid)
  const { default: writeXlsxFile } = await import('write-excel-file/universal')
  const sheets = COLLECTIONS.map((c) => {
    const docs = data.find((d) => d.key === c.key)?.docs ?? []
    const keys = [...new Set([...c.first.filter((k) => docs.some((d) => k in d)), ...docs.flatMap((d) => Object.keys(d))])].filter((k) => !SKIP.has(k))
    const sorted = [...docs].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')) || (b.createdAt ?? 0) - (a.createdAt ?? 0))
    const rows = [
      keys.map((k) => ({ value: label(k), fontWeight: 'bold' as const, backgroundColor: '#E6F4F1' })),
      ...sorted.map((d) => keys.map((k) => cellOf(k, d[k]))),
    ]
    return { sheet: c.sheet, data: rows.length > 1 ? rows : [[{ value: 'No entries', fontWeight: 'bold' as const }]], columns: keys.map((k) => ({ width: k === 'note' || k === 'text' || k === 'items' ? 40 : 16 })) }
  })
  const blob = await writeXlsxFile(sheets).toBlob()
  await saveBlob(blob, `Mera-Khata-${today()}.xlsx`)
}

/** Full backup that can be restored later (includes settings, logo, notes…). */
export async function exportBackup(uid: string) {
  const { data, settings } = await readAll(uid)
  const backup = { app: 'mera-khata', version: 1, exportedAt: new Date().toISOString(), settings, collections: Object.fromEntries(data.map((d) => [d.key, d.docs])) }
  await saveBlob(new Blob([JSON.stringify(backup)], { type: 'application/json' }), `Mera-Khata-backup-${today()}.json`)
}

/** Puts a backup file's entries back. Entries with the same id are replaced; nothing else is deleted. */
export async function restoreBackup(uid: string, file: File) {
  const json = JSON.parse(await file.text())
  if (json?.app !== 'mera-khata' || !json.collections) throw new Error('This is not a Mera Khata backup file')
  let count = 0
  let batch = writeBatch(db)
  let inBatch = 0
  const flush = async () => {
    if (inBatch) await batch.commit()
    batch = writeBatch(db)
    inBatch = 0
  }
  for (const c of COLLECTIONS) {
    for (const { id, ...rest } of (json.collections[c.key] ?? []) as (DocumentData & { id: string })[]) {
      batch.set(doc(c.col(uid), id), rest)
      count++
      if (++inBatch >= 400) await flush()
    }
  }
  if (json.settings) batch.set(settingsDoc(uid), json.settings, { merge: true })
  inBatch++
  await flush()
  return count
}
