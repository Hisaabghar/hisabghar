import { useState } from 'react'
import type { LoanEntry, LoanKind } from '../../types'
import { loansCol } from '../../lib/paths'
import { addItem, removeItem, patchItem } from '../../hooks/useData'
import { rs, shortDate, sum, today } from '../../lib/format'
import { Card, EditEntry, Fab, Field, FormSheet, List, MoneyInput, Row, Stat, StatGrid, num } from '../ui/kit'

const KIND_LABEL: Record<LoanKind, string> = {
  diya: 'I lent money',
  liya: 'I borrowed money',
  wapasMila: 'I got paid back',
  wapasKiya: 'I paid back',
}
const KIND_ICON: Record<LoanKind, string> = { diya: '📤', liya: '📥', wapasMila: '✅', wapasKiya: '✔️' }
/** +1 means the other person owes me more after this entry. */
const SIGN: Record<LoanKind, number> = { diya: 1, wapasKiya: 1, liya: -1, wapasMila: -1 }

export function LoansTab({ uid, loans }: { uid: string; loans: LoanEntry[] }) {
  const [person, setPerson] = useState<string | null>(null)
  const [adding, setAdding] = useState<{ person?: string; kind?: LoanKind } | null>(null)
  const [deleting, setDeleting] = useState<LoanEntry | null>(null)

  const people = new Map<string, LoanEntry[]>()
  for (const l of loans) people.set(l.person, [...(people.get(l.person) ?? []), l])
  const balances = [...people.entries()]
    .map(([name, list]) => ({ name, net: sum(list, (l) => SIGN[l.kind] * l.amount), last: list[0]?.date ?? '' }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))

  const lena = sum(balances.filter((b) => b.net > 0), (b) => b.net)
  const dena = -sum(balances.filter((b) => b.net < 0), (b) => b.net)

  if (person) {
    const list = [...(people.get(person) ?? [])].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    const net = sum(list, (l) => SIGN[l.kind] * l.amount)
    return (
      <>
        <button className="backLink" onClick={() => setPerson(null)}>
          ‹ All people
        </button>
        <div className="hero">
          <div className="heroLabel">{person}</div>
          <div className="heroAmt">{rs(Math.abs(net))}</div>
          <div className="heroRow">
            <span className="heroChip">{net > 0 ? 'Owes me' : net < 0 ? 'I owe them' : 'Settled ✓'}</span>
          </div>
        </div>
        <div className="quickAdd">
          <button className="quickBtn" onClick={() => setAdding({ person, kind: net < 0 ? 'wapasKiya' : 'wapasMila' })}>
            <span className="qIc">↩</span> Record repayment
          </button>
          <button className="quickBtn plain" onClick={() => setAdding({ person, kind: 'diya' })}>
            <span className="qIc">+</span> New loan
          </button>
        </div>
        <Card title="History">
          <List empty="No entries">
            {list.map((l) => (
              <Row
                key={l.id}
                icon={KIND_ICON[l.kind]}
                title={KIND_LABEL[l.kind]}
                sub={l.note || undefined}
                amount={rs(l.amount)}
                amountSub={shortDate(l.date)}
                tone={SIGN[l.kind] > 0 ? 'in' : 'out'}
                onClick={() => setDeleting(l)}
              />
            ))}
          </List>
        </Card>
        {adding && <LoanForm uid={uid} initial={adding} people={[...people.keys()]} onClose={() => setAdding(null)} />}
        {deleting && (
          <EditEntry
            title={KIND_LABEL[deleting.kind]}
            subtitle={deleting.person}
            fields={[
              { key: 'amount', label: 'Amount (Rs)', kind: 'money' },
              { key: 'date', label: 'Date', kind: 'date' },
              { key: 'note', label: 'Note', kind: 'text' },
            ]}
            initial={deleting}
            onSave={(v) => patchItem(loansCol(uid), deleting.id, v)}
            onDelete={() => removeItem(loansCol(uid), deleting.id)}
            onClose={() => setDeleting(null)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <StatGrid>
        <Stat label="Others owe me" value={lena} tone="in" />
        <Stat label="I owe others" value={dena} tone="out" />
      </StatGrid>
      <div className="quickAdd">
        <button className="quickBtn" onClick={() => setAdding({ kind: 'diya' })}>
          <span className="qIc">↑</span> I lent
        </button>
        <button className="quickBtn secondary" onClick={() => setAdding({ kind: 'liya' })}>
          <span className="qIc">↓</span> I borrowed
        </button>
      </div>
      <Card title="People">
        <List empty="No loans yet. Use “I lent” or “I borrowed” to add one.">
          {balances.map((b) => (
            <Row
              key={b.name}
              icon={b.name.slice(0, 1).toUpperCase()}
              title={b.name}
              sub={b.net > 0 ? 'Owes me' : b.net < 0 ? 'I owe them' : 'Settled'}
              amount={rs(Math.abs(b.net))}
              amountSub={b.last ? shortDate(b.last) : undefined}
              tone={b.net > 0 ? 'in' : b.net < 0 ? 'out' : undefined}
              onClick={() => setPerson(b.name)}
            />
          ))}
        </List>
      </Card>
      <Fab label="Loan" onClick={() => setAdding({ kind: 'diya' })} />
      {adding && <LoanForm uid={uid} initial={adding} people={[...people.keys()]} onClose={() => setAdding(null)} />}
    </>
  )
}

function LoanForm({
  uid,
  initial,
  people,
  onClose,
}: {
  uid: string
  initial: { person?: string; kind?: LoanKind }
  people: string[]
  onClose: () => void
}) {
  const [person, setPerson] = useState(initial.person ?? '')
  const [kind, setKind] = useState<LoanKind>(initial.kind ?? 'diya')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())

  return (
    <FormSheet
      title="Loan entry"
      onClose={onClose}
      canSave={num(amount) > 0 && person.trim().length > 0}
      onSave={() => addItem(loansCol(uid), { person: person.trim(), kind, amount: num(amount), note: note.trim(), date })}
    >
      <Field label="Person">
        <input list="loanPeople" value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Name" autoFocus={!initial.person} />
        <datalist id="loanPeople">
          {people.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Field>
      <Field label="Type">
        <div className="kindGrid">
          {(Object.keys(KIND_LABEL) as LoanKind[]).map((k) => (
            <button key={k} type="button" className={`kindBtn ${k === kind ? 'active' : ''}`} onClick={() => setKind(k)}>
              {KIND_ICON[k]} {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Amount (Rs)">
        <MoneyInput value={amount} onChange={setAmount} autoFocus={!!initial.person} />
      </Field>
      <Field label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. will return by end of month" />
      </Field>
      <Field label="Date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
    </FormSheet>
  )
}
