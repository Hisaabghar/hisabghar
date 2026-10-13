import { useState } from 'react'
import { arrayRemove, arrayUnion, deleteField, getDocs, query, where } from 'firebase/firestore'
import type { ShopExpense, Till } from '../../types'
import { settingsDoc, shopExpCol } from '../../lib/paths'
import { addItem, mergeDoc, removeItem, patchItem } from '../../hooks/useData'
import { HeadPicker } from '../home/HomeForm'
import { MultiItems, filledLines, linesTotal, newLine, type ItemLine } from '../ui/MultiItems'
import { HeadSheet, HeadsCard, NewHeadSheet, NO_HEAD, headOptions, headResolver, type HeadMap } from '../ui/Heads'
import { groupSum, rs, shortDate, sum } from '../../lib/format'
import { SHOP_EXPENSES, SHOP_EXPENSE_ICONS } from '../../lib/catalog'
import { Breakdown, Card, Chips, EditEntry, Fab, Field, FormSheet, Hero, HeroStat, List, MoneyInput, Row, Segmented, num } from '../ui/kit'
import { TillPicker } from './TillPicker'

const TILL_LABEL: Record<Till, string> = { cash: 'cash', easypaisa: 'Easypaisa', jazzcash: 'JazzCash' }

export function ExpensesTab({
  uid,
  expenses,
  grossProfit,
  isDay,
  date,
  heads,
  headMap,
}: {
  uid: string
  heads: string[]
  headMap: HeadMap
  expenses: ShopExpense[]
  grossProfit: number
  isDay: boolean
  date: string
}) {
  const [adding, setAdding] = useState<false | { head: string }>(false)
  const [deleting, setDeleting] = useState<ShopExpense | null>(null)
  const [headView, setHeadView] = useState<string | null>(null)
  const [newHead, setNewHead] = useState(false)
  const headOf = headResolver(headMap)
  const linkedTo = (head: string) => Object.keys(headMap).filter((c) => headMap[c] === head)
  const withHead = async (name: string) => (await getDocs(query(shopExpCol(uid), where('head', '==', name)))).docs
  const total = sum(expenses, (e) => e.amount)
  const list = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  const row = (e: ShopExpense) => (
    <Row
      key={e.id}
      icon={SHOP_EXPENSE_ICONS[e.category] ?? '📝'}
      title={e.category}
      sub={[`paid from ${TILL_LABEL[e.paidFrom ?? 'cash']}`, headOf(e) !== NO_HEAD ? `📂 ${headOf(e)}` : '', e.note].filter(Boolean).join(' · ')}
      amount={`−${rs(e.amount)}`}
      amountSub={isDay ? undefined : shortDate(e.date)}
      tone="out"
      onClick={() => setDeleting(e)}
    />
  )
  return (
    <>
      <Hero label={isDay ? 'Shop expenses today' : 'Shop expenses this month'} value={total}>
        <HeroStat label="Profit from sales" value={grossProfit} />
        <HeroStat label="Net profit (after expenses)" value={grossProfit - total} />
      </Hero>
      <HeadsCard heads={heads} entries={expenses} resolve={headOf} onOpen={setHeadView} onNew={() => setNewHead(true)} />
      <div className="twoCol">
        <Card title="Where it went">
          <Breakdown rows={groupSum(expenses, (e) => e.category, (e) => e.amount)} tone="out" icons={SHOP_EXPENSE_ICONS} />
        </Card>
        <Card title="Expenses">
          <List empty="No shop expenses. Tap “+ Add expense” for rent, bills, salary…">
            {list.map(row)}
          </List>
        </Card>
      </div>
      <Fab label="Add expense" onClick={() => setAdding({ head: '' })} />
      {adding && <ExpenseForm uid={uid} date={date} heads={heads} initialHead={adding.head} onClose={() => setAdding(false)} />}
      {newHead && (
        <NewHeadSheet
          existing={heads}
          onClose={() => setNewHead(false)}
          cats={SHOP_EXPENSES}
          map={headMap}
          onSave={(name, cats) => mergeDoc(settingsDoc(uid), { shopExpenseHeads: arrayUnion(name), shopHeadCats: Object.fromEntries(cats.map((c) => [c, name])) })}
        />
      )}
      {headView && (
        <HeadSheet
          name={headView}
          entries={list.filter((e) => headOf(e) === headView)}
          row={row}
          cats={SHOP_EXPENSES}
          map={headMap}
          onLink={(c, on) => mergeDoc(settingsDoc(uid), { shopHeadCats: { [c]: on ? headView : deleteField() } })}
          onClose={() => setHeadView(null)}
          onAdd={() => {
            setAdding({ head: headView === NO_HEAD ? '' : headView })
            setHeadView(null)
          }}
          onRename={
            headView === NO_HEAD
              ? undefined
              : async (to) => {
                  await mergeDoc(settingsDoc(uid), { shopExpenseHeads: arrayUnion(to), shopHeadCats: Object.fromEntries(linkedTo(headView).map((c) => [c, to])) })
                  await mergeDoc(settingsDoc(uid), { shopExpenseHeads: arrayRemove(headView) })
                  await Promise.all((await withHead(headView)).map((d) => patchItem(shopExpCol(uid), d.id, { head: to })))
                }
          }
          onDelete={
            headView === NO_HEAD
              ? undefined
              : async () => {
                  await mergeDoc(settingsDoc(uid), {
                    shopExpenseHeads: arrayRemove(headView),
                    shopHeadCats: Object.fromEntries(linkedTo(headView).map((c) => [c, deleteField()])),
                  })
                  await Promise.all((await withHead(headView)).map((d) => patchItem(shopExpCol(uid), d.id, { head: deleteField() })))
                }
          }
        />
      )}
      {deleting && (
        <EditEntry
          title={deleting.category}
          subtitle={`Paid from ${TILL_LABEL[deleting.paidFrom ?? 'cash']}`}
          fields={[
            { key: 'amount', label: 'Amount (Rs)', kind: 'money' },
            { key: 'head', label: 'Main account', kind: 'select', options: headOptions(heads, headMap[deleting.category]) },
            { key: 'date', label: 'Date', kind: 'date' },
            { key: 'note', label: 'Note', kind: 'text' },
          ]}
          initial={{ ...deleting, head: deleting.head ?? '' }}
          onSave={(v) => {
            const { head, ...rest } = v
            return patchItem(shopExpCol(uid), deleting.id, { ...rest, head: head ? head : deleteField() })
          }}
          onDelete={() => removeItem(shopExpCol(uid), deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  )
}

export function ExpenseForm({
  uid,
  date: d0,
  heads = [],
  initialHead = '',
  onClose,
}: {
  uid: string
  date: string
  heads?: string[]
  initialHead?: string
  onClose: () => void
}) {
  const [head, setHead] = useState(initialHead)
  const [many, setMany] = useState(false)
  const [lines, setLines] = useState<ItemLine[]>(() => [newLine(SHOP_EXPENSES[0])])
  const [category, setCategory] = useState(SHOP_EXPENSES[0])
  const [amount, setAmount] = useState('')
  const [paidFrom, setPaidFrom] = useState<Till>('cash')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(d0)
  return (
    <FormSheet
      title="Shop expense"
      onClose={onClose}
      canSave={many ? linesTotal(lines) > 0 : num(amount) > 0}
      onSave={async () => {
        const base = { paidFrom, date, ...(head ? { head } : {}) }
        if (!many) return addItem(shopExpCol(uid), { ...base, category, amount: num(amount), note: note.trim() })
        for (const l of filledLines(lines))
          await addItem(shopExpCol(uid), { ...base, category: l.cat, amount: num(l.amount), note: [l.name.trim(), note.trim()].filter(Boolean).join(' · ') })
      }}
    >
      <Segmented
        options={[
          { id: 'one', label: 'One item' },
          { id: 'many', label: 'Many items + subtotal' },
        ]}
        value={many ? 'many' : 'one'}
        onChange={(v) => setMany(v === 'many')}
      />
      {many ? (
        <MultiItems lines={lines} setLines={setLines} cats={SHOP_EXPENSES} />
      ) : (
        <>
          <Field label="Amount (Rs)">
            <MoneyInput value={amount} onChange={setAmount} autoFocus />
          </Field>
          <Field label="For">
            <Chips options={SHOP_EXPENSES} value={category} onChange={setCategory} />
          </Field>
        </>
      )}
      <Field label="Paid from">
        <TillPicker value={paidFrom} onChange={setPaidFrom} />
      </Field>
      <Field label="Main account — Automatic (by category) or choose yourself">
        <HeadPicker uid={uid} field="shopExpenseHeads" heads={heads} value={head} onChange={setHead} />
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
