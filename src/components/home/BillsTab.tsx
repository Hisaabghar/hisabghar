import { useState } from 'react'
import type { Bill, Settings } from '../../types'
import { homeCol, settingsDoc } from '../../lib/paths'
import { addItem, mergeDoc } from '../../hooks/useData'
import { rs, shortDate, today } from '../../lib/format'
import { HOME_EXPENSE } from '../../lib/catalog'
import { billStatus, dueText, notifyOn, setNotify } from '../../lib/bills'
import { Card, Chips, ConfirmDelete, Field, FormSheet, List, MoneyInput, Row, cleanNumber, num } from '../ui/kit'
import { withExtra } from './HomeForm'

const nowTime = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function BillsTab({ uid, settings, accounts }: { uid: string; settings: Settings; accounts: string[] }) {
  const bills = settings.bills ?? []
  const [editing, setEditing] = useState<Bill | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Bill | null>(null)
  const [notify, setNotifyState] = useState(notifyOn())
  const [msg, setMsg] = useState<string | null>(null)
  const save = (next: Bill[]) => mergeDoc(settingsDoc(uid), { bills: next })
  const rows = bills.map((b) => ({ b, s: billStatus(b) })).sort((x, y) => x.s.daysLeft - y.s.daysLeft)

  async function markPaid(b: Bill, month: string) {
    await addItem(homeCol(uid), {
      type: 'expense',
      category: b.category || 'Bills',
      amount: b.amount,
      note: b.name,
      date: today(),
      time: nowTime(),
      account: b.account || accounts[0],
    })
    await save(bills.map((x) => (x.id === b.id ? { ...x, paid: [...(x.paid ?? []).filter((p) => p >= month.slice(0, 4)), month] } : x)))
  }

  return (
    <>
      <Card title="🔔 Reminders">
        <label className="checkRow soundRow">
          <input
            type="checkbox"
            checked={notify}
            onChange={async (e) => {
              const on = e.target.checked
              const ok = await setNotify(on)
              if (!ok) return setMsg('Notifications are blocked. Allow them for this site in your phone’s browser settings, then try again.')
              setMsg(null)
              setNotifyState(on)
            }}
          />
          Phone notifications for bills (this device)
        </label>
        {msg && <div className="errorBanner">{msg}</div>}
        <div className="statHint">
          You get a notification when you open the app, or while it is open, from the day the reminder starts until the bill is
          paid. Install the app (Add to Home screen) for the best chance of reminders even when it is closed.
        </div>
      </Card>
      <Card
        title="Monthly bills"
        action={
          <button className="linkBtn" onClick={() => setEditing('new')}>
            ＋ Add bill
          </button>
        }
      >
        <List empty="No bills yet. Add rent, internet, electricity… and get a reminder before each one is due.">
          {rows.map(({ b, s }) => (
            <Row
              key={b.id}
              icon={s.daysLeft < 0 ? '⚠️' : s.remind ? '⏰' : '📅'}
              title={b.name}
              sub={`Every month on day ${b.day} · ${shortDate(s.due)} · ${dueText(s.daysLeft)}`}
              amount={rs(b.amount)}
              amountSub={b.account}
              tone={s.daysLeft < 0 ? 'out' : undefined}
              onClick={() => setEditing(b)}
              extra={
                <button
                  className="statusPill done"
                  onClick={(e) => {
                    e.stopPropagation()
                    void markPaid(b, s.month)
                  }}
                >
                  ✓ Paid
                </button>
              }
            />
          ))}
        </List>
        {rows.length > 0 && <div className="statHint">“Paid” adds the bill as an expense today and moves the reminder to next month.</div>}
      </Card>
      {editing && (
        <BillSheet
          bill={editing === 'new' ? null : editing}
          accounts={accounts}
          cats={withExtra(HOME_EXPENSE, settings.expenseCats)}
          onClose={() => setEditing(null)}
          onDelete={editing === 'new' ? undefined : () => setDeleting(editing)}
          onSave={(b) => save(editing === 'new' ? [...bills, b] : bills.map((x) => (x.id === b.id ? b : x)))}
        />
      )}
      {deleting && (
        <ConfirmDelete
          what={`Delete the bill “${deleting.name}”? Expenses you already recorded for it stay.`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await save(bills.filter((x) => x.id !== deleting.id))
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

function BillSheet({
  bill,
  accounts,
  cats,
  onClose,
  onSave,
  onDelete,
}: {
  bill: Bill | null
  accounts: string[]
  cats: string[]
  onClose: () => void
  onSave: (b: Bill) => Promise<void>
  onDelete?: () => void
}) {
  const [name, setName] = useState(bill?.name ?? '')
  const [amount, setAmount] = useState(bill ? String(bill.amount) : '')
  const [day, setDay] = useState(bill ? String(bill.day) : '')
  const [remind, setRemind] = useState(String(bill?.remindDays ?? 2))
  const [account, setAccount] = useState(bill?.account ?? accounts[0])
  const [category, setCategory] = useState(bill?.category ?? 'Bills')
  const d = num(day)
  const ok = name.trim() && num(amount) > 0 && d >= 1 && d <= 31

  return (
    <FormSheet
      title={bill ? 'Edit bill' : 'Add a monthly bill'}
      onClose={onClose}
      canSave={!!ok}
      onSave={() =>
        onSave({
          id: bill?.id ?? `b${Date.now().toString(36)}`,
          name: name.trim(),
          amount: num(amount),
          day: Math.round(d),
          remindDays: Math.max(0, Math.round(num(remind))),
          account,
          category,
          paid: bill?.paid ?? [],
        })
      }
    >
      <Field label="Bill name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. House rent, Internet, Electricity" maxLength={40} autoFocus />
      </Field>
      <Field label="Amount">
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>
      <div className="twoFields">
        <Field label="Due on day of month">
          <input inputMode="numeric" value={day} onChange={(e) => setDay(cleanNumber(e.target.value))} placeholder="e.g. 10" />
        </Field>
        <Field label="Remind days before">
          <input inputMode="numeric" value={remind} onChange={(e) => setRemind(cleanNumber(e.target.value))} placeholder="2" />
        </Field>
      </div>
      <Field label="Usually paid from">
        <Chips options={accounts} value={account} onChange={setAccount} />
      </Field>
      <Field label="Expense category">
        <Chips options={cats} value={category} onChange={setCategory} />
      </Field>
      {onDelete && (
        <button className="btnDanger full" onClick={onDelete}>
          Delete this bill
        </button>
      )}
    </FormSheet>
  )
}
