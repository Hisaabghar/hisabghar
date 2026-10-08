import { useState } from 'react'
import type { CreditEntry, Till } from '../../types'
import { creditCol } from '../../lib/paths'
import { addItem, removeItem } from '../../hooks/useData'
import { rs, rsRaw, shortDate, sum, today } from '../../lib/format'
import { whatsappLink } from '../../lib/whatsapp'
import { Card, ConfirmDelete, Fab, Field, FormSheet, Hero, HeroStat, List, MoneyInput, Row, Segmented, num } from '../ui/kit'
import { TillPicker } from './TillPicker'

/** Positive = the customer owes the shop. */
export function khataBalances(entries: CreditEntry[]) {
  const m = new Map<string, { due: number; phone?: string; last: string; entries: CreditEntry[] }>()
  for (const e of entries) {
    const key = e.customer.trim()
    const cur = m.get(key) ?? { due: 0, last: '', entries: [] }
    cur.due += e.kind === 'credit' ? e.amount : -e.amount
    if (e.phone) cur.phone = e.phone
    if (e.date > cur.last) cur.last = e.date
    cur.entries.push(e)
    m.set(key, cur)
  }
  return [...m.entries()].map(([name, v]) => ({ name, ...v }))
}

export function KhataTab({ uid, entries, shopName }: { uid: string; entries: CreditEntry[]; shopName: string }) {
  const [person, setPerson] = useState<string | null>(null)
  const [adding, setAdding] = useState<{ customer?: string; phone?: string; kind: CreditEntry['kind'] } | null>(null)
  const [deleting, setDeleting] = useState<CreditEntry | null>(null)
  const [showSettled, setShowSettled] = useState(false)

  const people = khataBalances(entries).sort((a, b) => b.due - a.due)
  const owing = people.filter((p) => Math.round(p.due) > 0)
  const totalDue = sum(owing, (p) => p.due)
  const shown = showSettled ? people : owing
  const names = people.map((p) => p.name)

  const reminder = (name: string, due: number) =>
    `Assalam o Alaikum ${name}, ${shopName} ki taraf se yaad dihani: aap ke zimme ${rsRaw(due)} baqi hain. Meharbani farma kar jald ada kar dein. Shukriya!`

  const form = adding && <CreditForm uid={uid} initial={adding} names={names} onClose={() => setAdding(null)} />

  if (person) {
    const p = people.find((x) => x.name === person)
    const list = [...(p?.entries ?? [])].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    const due = p?.due ?? 0
    return (
      <>
        <button className="backLink" onClick={() => setPerson(null)}>
          ‹ All customers
        </button>
        <Hero label={person} value={Math.max(0, due)}>
          <HeroStat label={due > 0 ? 'Still to pay you' : due < 0 ? 'You owe them (advance)' : 'Settled'} value={Math.abs(due)} />
          {p?.phone && <HeroStat label="Phone" value={p.phone} />}
        </Hero>
        <div className="quickAdd">
          <button className="quickBtn" onClick={() => setAdding({ customer: person, phone: p?.phone, kind: 'payment' })}>
            <span className="qIc">↩</span> Received payment
          </button>
          <button className="quickBtn secondary" onClick={() => setAdding({ customer: person, phone: p?.phone, kind: 'credit' })}>
            <span className="qIc">+</span> New udhaar
          </button>
          {due > 0 && (
            <a className="quickBtn plain span2 waBtn" href={whatsappLink(reminder(person, due), p?.phone)} target="_blank" rel="noreferrer">
              <span className="qIc">💬</span> Send WhatsApp reminder
            </a>
          )}
        </div>
        <Card title="History">
          <List empty="No entries">
            {list.map((e) => (
              <Row
                key={e.id}
                icon={e.kind === 'credit' ? '📤' : '✅'}
                title={e.kind === 'credit' ? 'Took on udhaar' : `Paid back${e.paidTo && e.paidTo !== 'cash' ? ` (${e.paidTo})` : ''}`}
                sub={e.note || undefined}
                amount={rs(e.amount)}
                amountSub={shortDate(e.date)}
                tone={e.kind === 'credit' ? 'out' : 'in'}
                onClick={() => setDeleting(e)}
              />
            ))}
          </List>
        </Card>
        {form}
        {deleting && (
          <ConfirmDelete
            what={`${deleting.kind === 'credit' ? 'Udhaar' : 'Payment'} — ${rs(deleting.amount)}`}
            onClose={() => setDeleting(null)}
            onConfirm={() => removeItem(creditCol(uid), deleting.id)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <Hero label="Customers owe you" value={totalDue}>
        <HeroStat label="Customers with udhaar" value={String(owing.length)} />
      </Hero>
      <div className="quickAdd">
        <button className="quickBtn secondary" onClick={() => setAdding({ kind: 'credit' })}>
          <span className="qIc">+</span> Give on udhaar
        </button>
        <button className="quickBtn" onClick={() => setAdding({ kind: 'payment' })}>
          <span className="qIc">↩</span> Received payment
        </button>
      </div>
      <Card
        title={showSettled ? 'All customers' : 'Customers who owe you'}
        action={
          <button className="linkBtn" onClick={() => setShowSettled((v) => !v)}>
            {showSettled ? 'Only owing' : 'Show all'}
          </button>
        }
      >
        <List empty="No udhaar. When a customer takes something on credit, tap “Give on udhaar” — or choose “On udhaar” in a sale.">
          {shown.map((p) => (
            <Row
              key={p.name}
              icon={p.name.slice(0, 1).toUpperCase()}
              title={p.name}
              sub={[p.phone, p.last ? `last ${shortDate(p.last)}` : ''].filter(Boolean).join(' · ')}
              amount={rs(Math.abs(p.due))}
              amountSub={p.due > 0 ? 'owes you' : p.due < 0 ? 'advance' : 'settled'}
              tone={p.due > 0 ? 'out' : 'in'}
              onClick={() => setPerson(p.name)}
            />
          ))}
        </List>
      </Card>
      <Fab label="Udhaar" onClick={() => setAdding({ kind: 'credit' })} />
      {form}
    </>
  )
}

export function CreditForm({
  uid,
  initial,
  names,
  onClose,
}: {
  uid: string
  initial: { customer?: string; phone?: string; kind: CreditEntry['kind'] }
  names: string[]
  onClose: () => void
}) {
  const [kind, setKind] = useState(initial.kind)
  const [customer, setCustomer] = useState(initial.customer ?? '')
  const [phone, setPhone] = useState(initial.phone ?? '')
  const [amount, setAmount] = useState('')
  const [paidTo, setPaidTo] = useState<Till>('cash')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  return (
    <FormSheet
      title={kind === 'credit' ? 'Give on udhaar' : 'Payment received'}
      onClose={onClose}
      canSave={num(amount) > 0 && !!customer.trim()}
      onSave={() =>
        addItem(creditCol(uid), {
          customer: customer.trim(),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          kind,
          amount: num(amount),
          ...(kind === 'payment' ? { paidTo } : {}),
          note: note.trim(),
          date,
        })
      }
    >
      <Segmented
        options={[
          { id: 'credit', label: 'Gave on udhaar' },
          { id: 'payment', label: 'Received payment' },
        ]}
        value={kind}
        onChange={setKind}
      />
      <div className="twoFields">
        <Field label="Customer name">
          <input list="khataNames" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Name" autoFocus={!initial.customer} />
          <datalist id="khataNames">
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </Field>
        <Field label="Phone (optional)">
          <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+\- ]/g, ''))} placeholder="03xx-xxxxxxx" maxLength={16} />
        </Field>
      </div>
      <Field label="Amount (Rs)">
        <MoneyInput value={amount} onChange={setAmount} autoFocus={!!initial.customer} />
      </Field>
      {kind === 'payment' && (
        <Field label="Received in">
          <TillPicker value={paidTo} onChange={setPaidTo} />
        </Field>
      )}
      <div className="twoFields">
        <Field label="Note (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === 'credit' ? 'e.g. charger + 100 load' : ''} />
        </Field>
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
    </FormSheet>
  )
}
