import { useState } from 'react'
import type { ShopExpense, Till } from '../../types'
import { shopExpCol } from '../../lib/paths'
import { addItem, removeItem, patchItem } from '../../hooks/useData'
import { groupSum, rs, shortDate, sum } from '../../lib/format'
import { SHOP_EXPENSES, SHOP_EXPENSE_ICONS } from '../../lib/catalog'
import { Breakdown, Card, Chips, EditEntry, Fab, Field, FormSheet, Hero, HeroStat, List, MoneyInput, Row, num } from '../ui/kit'
import { TillPicker } from './TillPicker'

const TILL_LABEL: Record<Till, string> = { cash: 'cash', easypaisa: 'Easypaisa', jazzcash: 'JazzCash' }

export function ExpensesTab({
  uid,
  expenses,
  grossProfit,
  isDay,
  date,
}: {
  uid: string
  expenses: ShopExpense[]
  grossProfit: number
  isDay: boolean
  date: string
}) {
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<ShopExpense | null>(null)
  const total = sum(expenses, (e) => e.amount)
  const list = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  return (
    <>
      <Hero label={isDay ? 'Shop expenses today' : 'Shop expenses this month'} value={total}>
        <HeroStat label="Profit from sales" value={grossProfit} />
        <HeroStat label="Net profit (after expenses)" value={grossProfit - total} />
      </Hero>
      <div className="twoCol">
        <Card title="Where it went">
          <Breakdown rows={groupSum(expenses, (e) => e.category, (e) => e.amount)} tone="out" icons={SHOP_EXPENSE_ICONS} />
        </Card>
        <Card title="Expenses">
          <List empty="No shop expenses. Tap “+ Add expense” for rent, bills, salary…">
            {list.map((e) => (
              <Row
                key={e.id}
                icon={SHOP_EXPENSE_ICONS[e.category] ?? '📝'}
                title={e.category}
                sub={[`paid from ${TILL_LABEL[e.paidFrom ?? 'cash']}`, e.note].filter(Boolean).join(' · ')}
                amount={`−${rs(e.amount)}`}
                amountSub={isDay ? undefined : shortDate(e.date)}
                tone="out"
                onClick={() => setDeleting(e)}
              />
            ))}
          </List>
        </Card>
      </div>
      <Fab label="Add expense" onClick={() => setAdding(true)} />
      {adding && <ExpenseForm uid={uid} date={date} onClose={() => setAdding(false)} />}
      {deleting && (
        <EditEntry
          title={deleting.category}
          subtitle={`Paid from ${TILL_LABEL[deleting.paidFrom ?? 'cash']}`}
          fields={[
            { key: 'amount', label: 'Amount (Rs)', kind: 'money' },
            { key: 'date', label: 'Date', kind: 'date' },
            { key: 'note', label: 'Note', kind: 'text' },
          ]}
          initial={deleting}
          onSave={(v) => patchItem(shopExpCol(uid), deleting.id, v)}
          onDelete={() => removeItem(shopExpCol(uid), deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  )
}

export function ExpenseForm({ uid, date: d0, onClose }: { uid: string; date: string; onClose: () => void }) {
  const [category, setCategory] = useState(SHOP_EXPENSES[0])
  const [amount, setAmount] = useState('')
  const [paidFrom, setPaidFrom] = useState<Till>('cash')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(d0)
  return (
    <FormSheet
      title="Shop expense"
      onClose={onClose}
      canSave={num(amount) > 0}
      onSave={() => addItem(shopExpCol(uid), { category, amount: num(amount), paidFrom, note: note.trim(), date })}
    >
      <Field label="Amount (Rs)">
        <MoneyInput value={amount} onChange={setAmount} autoFocus />
      </Field>
      <Field label="For">
        <Chips options={SHOP_EXPENSES} value={category} onChange={setCategory} />
      </Field>
      <Field label="Paid from">
        <TillPicker value={paidFrom} onChange={setPaidFrom} />
      </Field>
      <div className="twoFields">
        <Field label="Note (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. October rent" />
        </Field>
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
    </FormSheet>
  )
}
