import { useState } from 'react'
import type { LoanEntry, LoanKind } from '../../types'
import { loansCol } from '../../lib/paths'
import { addItem, removeItem } from '../../hooks/useData'
import { rs, shortDate, sum, today } from '../../lib/format'
import { Card, ConfirmDelete, Fab, Field, FormSheet, List, MoneyInput, Row, Stat, StatGrid, num } from '../ui/kit'

const KIND_LABEL: Record<LoanKind, string> = {
  diya: 'Maine udhaar diya',
  liya: 'Maine udhaar liya',
  wapasMila: 'Mujhe wapas mila',
  wapasKiya: 'Maine wapas kiya',
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
          ‹ Sab log
        </button>
        <div className="hero">
          <div className="heroLabel">{person}</div>
          <div className="heroAmt">{rs(Math.abs(net))}</div>
          <div className="heroRow">
            <span className="heroChip">{net > 0 ? 'Is se lena hai' : net < 0 ? 'Is ko dena hai' : 'Hisab barabar ✓'}</span>
          </div>
        </div>
        <div className="quickAdd">
          <button className="quickBtn" onClick={() => setAdding({ person, kind: net < 0 ? 'wapasKiya' : 'wapasMila' })}>
            <span className="qIc">↩</span> Wapsi likhein
          </button>
          <button className="quickBtn plain" onClick={() => setAdding({ person, kind: 'diya' })}>
            <span className="qIc">+</span> Naya udhaar
          </button>
        </div>
        <Card title="Poori history">
          <List empty="Koi entry nahi">
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
          <ConfirmDelete
            what={`${KIND_LABEL[deleting.kind]} — ${rs(deleting.amount)}`}
            onClose={() => setDeleting(null)}
            onConfirm={() => removeItem(loansCol(uid), deleting.id)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <StatGrid>
        <Stat label="Mujhe lena hai" value={lena} tone="in" />
        <Stat label="Mujhe dena hai" value={dena} tone="out" />
      </StatGrid>
      <div className="quickAdd">
        <button className="quickBtn" onClick={() => setAdding({ kind: 'diya' })}>
          <span className="qIc">↑</span> Udhaar diya
        </button>
        <button className="quickBtn secondary" onClick={() => setAdding({ kind: 'liya' })}>
          <span className="qIc">↓</span> Udhaar liya
        </button>
      </div>
      <Card title="Log">
        <List empty="Abhi koi udhaar nahi">
          {balances.map((b) => (
            <Row
              key={b.name}
              icon={b.name.slice(0, 1).toUpperCase()}
              title={b.name}
              sub={b.net > 0 ? 'Is se lena hai' : b.net < 0 ? 'Is ko dena hai' : 'Hisab barabar'}
              amount={rs(Math.abs(b.net))}
              amountSub={b.last ? shortDate(b.last) : undefined}
              tone={b.net > 0 ? 'in' : b.net < 0 ? 'out' : undefined}
              onClick={() => setPerson(b.name)}
            />
          ))}
        </List>
      </Card>
      <Fab label="Udhaar" onClick={() => setAdding({ kind: 'diya' })} />
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
      title="Udhaar ki entry"
      onClose={onClose}
      canSave={num(amount) > 0 && person.trim().length > 0}
      onSave={() => addItem(loansCol(uid), { person: person.trim(), kind, amount: num(amount), note: note.trim(), date })}
    >
      <Field label="Kis ke sath">
        <input list="loanPeople" value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Naam likhein" autoFocus={!initial.person} />
        <datalist id="loanPeople">
          {people.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Field>
      <Field label="Kya hua">
        <div className="kindGrid">
          {(Object.keys(KIND_LABEL) as LoanKind[]).map((k) => (
            <button key={k} type="button" className={`kindBtn ${k === kind ? 'active' : ''}`} onClick={() => setKind(k)}>
              {KIND_ICON[k]} {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Raqam (Rs)">
        <MoneyInput value={amount} onChange={setAmount} autoFocus={!!initial.person} />
      </Field>
      <Field label="Detail (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Jaise: mahine ke aakhir tak wapas karega" />
      </Field>
      <Field label="Tareekh">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
    </FormSheet>
  )
}
