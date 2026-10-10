import { useState } from 'react'
import type { jsPDF } from 'jspdf'
import { increment } from 'firebase/firestore'
import type { Invoice, Product, Settings } from '../../types'
import { invoiceCol, settingsDoc } from '../../lib/paths'
import { addItem, mergeDoc, removeItem, useLiveQuery } from '../../hooks/useData'
import { rs, rsRaw, shortDate, today } from '../../lib/format'
import { downloadPdf, invoicePdf, invoiceTotals, letterPdf, sharePdf, type Profile } from '../../lib/pdf'
import { Card, ConfirmDelete, Field, FormSheet, List, MoneyInput, QuickActions, Row, Segmented, cleanNumber, num } from '../ui/kit'
import { Sheet } from '../ui/Sheet'

export const profileOf = (s: Settings): Profile => ({
  businessName: s.businessName?.trim() || 'My Shop',
  logo: s.logo,
  ownerName: s.ownerName,
  phone: s.phone,
  address: s.address,
})

type Ready = { doc: jsPDF; name: string; text?: string }

/** Makes a bill as a PDF, saves it in the list and bumps the bill number. */
export async function makeInvoice(uid: string, settings: Settings, data: Omit<Invoice, 'id' | 'no' | 'createdAt'>): Promise<Ready> {
  const no = (settings.invoiceNo ?? 0) + 1
  void mergeDoc(settingsDoc(uid), { invoiceNo: increment(1) })
  void addItem(invoiceCol(uid), { ...data, no })
  const inv: Invoice = { ...data, no, id: '', createdAt: Date.now() }
  return readyOf(settings, inv)
}

async function readyOf(settings: Settings, inv: Invoice): Promise<Ready> {
  const { total, due } = invoiceTotals(inv)
  const shop = settings.businessName?.trim() || 'My Shop'
  return {
    doc: await invoicePdf(profileOf(settings), inv),
    name: `Bill-${inv.no}-${(inv.customer || 'customer').replace(/[^\w]+/g, '-')}.pdf`,
    text: `${shop} — Bill No ${inv.no}: Total ${rsRaw(total)}${due > 0 ? `, balance due ${rsRaw(due)}` : ' (paid)'}. Thank you!`,
  }
}

export function DocsTab({ uid, settings, products }: { uid: string; settings: Settings; products: Product[] }) {
  const invoices = useLiveQuery<Invoice>(invoiceCol(uid), `invoices-${uid}`)
  const [making, setMaking] = useState<'bill' | 'letter' | null>(null)
  const [ready, setReady] = useState<Ready | null>(null)
  const [open, setOpen] = useState<Invoice | null>(null)
  const [deleting, setDeleting] = useState<Invoice | null>(null)
  const list = [...invoices.items].sort((a, b) => b.no - a.no)
  const noProfile = !settings.ownerName || !settings.phone

  return (
    <>
      {noProfile && (
        <div className="billBanner">
          <span>ℹ️</span>
          <span>
            Add your <b>name, phone & logo</b> in ⚙️ Settings → Shop profile. They are printed on every bill and on your letter pad.
          </span>
        </div>
      )}
      <Card title="Make">
        <QuickActions
          items={[
            { icon: '🧾', label: 'New bill', hint: 'Invoice / receipt PDF', onClick: () => setMaking('bill') },
            { icon: '✉️', label: 'Write a letter', hint: 'On your letter pad', onClick: () => setMaking('letter') },
            {
              icon: '📄',
              label: 'Blank letter pad',
              hint: 'Print & write by hand',
              onClick: async () => setReady({ doc: await letterPdf(profileOf(settings), { date: today(), body: '' }), name: 'Letter-pad.pdf' }),
            },
          ]}
        />
      </Card>
      <Card title="Bills made">
        <List empty="No bills yet. Tap “New bill”, or tick “Make a bill (PDF)” when you record a sale.">
          {list.map((inv) => {
            const t = invoiceTotals(inv)
            return (
              <Row
                key={inv.id}
                icon="🧾"
                title={`#${inv.no} · ${inv.customer || 'Walk-in customer'}`}
                sub={inv.items.map((i) => `${i.name} ×${i.qty}`).join(', ')}
                amount={rs(t.total)}
                amountSub={`${shortDate(inv.date)} · ${t.due > 0 ? 'Unpaid ' + rs(t.due) : 'Paid'}`}
                tone={t.due > 0 ? 'out' : 'in'}
                onClick={() => setOpen(inv)}
              />
            )
          })}
        </List>
      </Card>

      {making === 'bill' && (
        <InvoiceSheet
          products={products}
          onClose={() => setMaking(null)}
          onSave={async (data) => setReady(await makeInvoice(uid, settings, data))}
        />
      )}
      {making === 'letter' && (
        <LetterSheet
          onClose={() => setMaking(null)}
          onSave={async (l) => setReady({ doc: await letterPdf(profileOf(settings), l), name: `Letter-${l.date}.pdf` })}
        />
      )}
      {open && (
        <Sheet title={`Bill #${open.no} · ${open.customer || 'Walk-in customer'}`} onClose={() => setOpen(null)}>
          <p className="sheetText">
            {open.items.map((i) => `${i.name} ×${i.qty}`).join(', ')} — total {rs(invoiceTotals(open).total)}
          </p>
          <div className="sheetBtns">
            <button className="btnDanger" onClick={() => setDeleting(open)}>
              Delete
            </button>
            <button
              className="btnPrimary"
              onClick={async () => {
                const r = await readyOf(settings, open)
                setOpen(null)
                setReady(r)
              }}
            >
              Open PDF
            </button>
          </div>
        </Sheet>
      )}
      {deleting && (
        <ConfirmDelete
          what={`Delete bill #${deleting.no} for ${deleting.customer || 'walk-in customer'}? Sales entries are not changed.`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await removeItem(invoiceCol(uid), deleting.id)
            setOpen(null)
          }}
        />
      )}
      {ready && <PdfReady ready={ready} onClose={() => setReady(null)} />}
    </>
  )
}

/** The PDF is made: share it (WhatsApp…) or save it to the phone. */
export function PdfReady({ ready, onClose }: { ready: Ready; onClose: () => void }) {
  return (
    <Sheet title="✅ PDF ready" onClose={onClose}>
      <p className="sheetText">{ready.name}</p>
      <div className="pdfBtns">
        <button className="btnPrimary full" onClick={() => void sharePdf(ready.doc, ready.name, ready.text)}>
          📤 Share (WhatsApp…)
        </button>
        <button className="btnGhost full" onClick={() => downloadPdf(ready.doc, ready.name)}>
          ⬇️ Download / Print
        </button>
        <button className="btnGhost full" onClick={onClose}>
          Close
        </button>
      </div>
    </Sheet>
  )
}

interface Line {
  key: number
  name: string
  qty: string
  price: string
}
let nextKey = 1
const blank = (): Line => ({ key: nextKey++, name: '', qty: '1', price: '' })

function InvoiceSheet({
  products,
  onClose,
  onSave,
}: {
  products: Product[]
  onClose: () => void
  onSave: (d: Omit<Invoice, 'id' | 'no' | 'createdAt'>) => Promise<void>
}) {
  const [customer, setCustomer] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState(today())
  const [lines, setLines] = useState<Line[]>([blank()])
  const [disc, setDisc] = useState('')
  const [pay, setPay] = useState<'paid' | 'unpaid' | 'part'>('paid')
  const [paidAmt, setPaidAmt] = useState('')
  const [note, setNote] = useState('')
  const set = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const items = lines.filter((l) => l.name.trim() && num(l.price) > 0).map((l) => ({ name: l.name.trim(), qty: Math.max(1, num(l.qty)), price: num(l.price) }))
  const { subtotal, total } = invoiceTotals({ items, discount: num(disc), paid: 0 })
  const paid = pay === 'paid' ? total : pay === 'unpaid' ? 0 : Math.min(total, num(paidAmt))

  return (
    <FormSheet
      title="🧾 New bill"
      onClose={onClose}
      canSave={items.length > 0}
      onSave={() =>
        onSave({
          customer: customer.trim(),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          date,
          items,
          discount: Math.min(subtotal, num(disc)),
          paid,
          ...(note.trim() ? { note: note.trim() } : {}),
        })
      }
    >
      <div className="twoFields">
        <Field label="Customer name">
          <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Walk-in customer" maxLength={50} />
        </Field>
        <Field label="Phone (optional)">
          <input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xx xxxxxxx" maxLength={30} />
        </Field>
      </div>
      <Field label="Date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
      </Field>
      <datalist id="billProducts">
        {products.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
      {lines.map((l, i) => (
        <div key={l.key} className="billLine">
          <Field label={`Item ${i + 1}`}>
            <input
              list="billProducts"
              value={l.name}
              onChange={(e) => {
                const p = products.find((x) => x.name === e.target.value)
                set(l.key, { name: e.target.value, ...(p && !l.price ? { price: String(p.salePrice) } : {}) })
              }}
              placeholder="Item or service"
              maxLength={80}
            />
          </Field>
          <div className="twoFields">
            <Field label="Qty">
              <input inputMode="numeric" value={l.qty} onChange={(e) => set(l.key, { qty: cleanNumber(e.target.value) })} />
            </Field>
            <Field label="Rate">
              <MoneyInput value={l.price} onChange={(v) => set(l.key, { price: v })} />
            </Field>
          </div>
          {lines.length > 1 && (
            <button className="linkBtn" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
              Remove item
            </button>
          )}
        </div>
      ))}
      <button className="btnGhost full" onClick={() => setLines((ls) => [...ls, blank()])}>
        ＋ Add another item
      </button>
      <Field label="Discount (Rs)">
        <MoneyInput value={disc} onChange={setDisc} />
      </Field>
      <Field label="Payment">
        <Segmented
          options={[
            { id: 'paid', label: 'Paid' },
            { id: 'part', label: 'Part paid' },
            { id: 'unpaid', label: 'Unpaid' },
          ]}
          value={pay}
          onChange={setPay}
        />
      </Field>
      {pay === 'part' && (
        <Field label="Amount paid">
          <MoneyInput value={paidAmt} onChange={setPaidAmt} />
        </Field>
      )}
      <Field label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 6 months warranty" maxLength={120} />
      </Field>
      <div className="saleTotal">
        Total <b>{rsRaw(total)}</b>
        {paid < total && <span> · due {rsRaw(total - paid)}</span>}
      </div>
    </FormSheet>
  )
}

function LetterSheet({ onClose, onSave }: { onClose: () => void; onSave: (l: { date: string; to?: string; subject?: string; body: string }) => Promise<void> }) {
  const [date, setDate] = useState(today())
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  return (
    <FormSheet
      title="✉️ Letter on your letter pad"
      onClose={onClose}
      canSave={!!body.trim()}
      onSave={() => onSave({ date, to: to.trim() || undefined, subject: subject.trim() || undefined, body: body.trim() })}
    >
      <Field label="Date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
      </Field>
      <Field label="To (optional)">
        <textarea rows={2} value={to} onChange={(e) => setTo(e.target.value)} placeholder={'The Manager,\nABC Company, Lahore'} />
      </Field>
      <Field label="Subject (optional)">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Quotation for mobile accessories" maxLength={120} />
      </Field>
      <Field label="Letter">
        <textarea rows={9} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Dear Sir, …" />
      </Field>
      <div className="statHint">Your name, phone, address and logo from Settings are printed at the top and under the signature.</div>
    </FormSheet>
  )
}
