import { useState } from 'react'
import type { HomeEntry, HomeType, LoanEntry, Period } from '../../types'
import { homeCol, loansCol } from '../../lib/paths'
import { addItem, allByDate, removeItem, useLiveQuery } from '../../hooks/useData'
import { dailySeries, groupSum, inRange, periodRange, rs, shortDate, sum, today } from '../../lib/format'
import { HOME_EXPENSE, HOME_INCOME, ICONS } from '../../lib/catalog'
import {
  QuickActions,
  Breakdown,
  Card,
  Chips,
  ConfirmDelete,
  Fab,
  Field,
  FormSheet,
  Hero,
  HeroStat,
  List,
  MoneyInput,
  PeriodBar,
  Row,
  Segmented,
  Stat,
  StatGrid,
  Tabs,
  num,
} from '../ui/kit'
import { LoansTab } from './LoansTab'
import { BarChart } from '../ui/BarChart'

export type HomeTab = 'summary' | 'entries' | 'udhaar'
export const HOME_TABS: { id: HomeTab; label: string; icon: string }[] = [
  { id: 'summary', label: 'Overview', icon: '📈' },
  { id: 'entries', label: 'Income & Expenses', icon: '🧾' },
  { id: 'udhaar', label: 'Loans', icon: '🤝' },
]

const byNewest = (a: { date: string; createdAt: number }, b: { date: string; createdAt: number }) =>
  b.date.localeCompare(a.date) || b.createdAt - a.createdAt

export function HomeSection({
  uid,
  onLock,
  tab,
  setTab,
}: {
  uid: string
  onLock: () => void
  tab: HomeTab
  setTab: (t: HomeTab) => void
}) {
  const [period, setPeriod] = useState<Period>({ mode: 'month', date: today() })
  const [adding, setAdding] = useState<HomeType | null>(null)
  const [deleting, setDeleting] = useState<HomeEntry | null>(null)

  const home = useLiveQuery<HomeEntry>(allByDate(homeCol(uid)), `home-${uid}`)
  const loans = useLiveQuery<LoanEntry>(allByDate(loansCol(uid)), `loans-${uid}`)

  const range = periodRange(period)
  const all = [...home.items].sort(byNewest)
  const inPeriod = all.filter((e) => inRange(e.date, range))
  const before = all.filter((e) => e.date < range[0])

  const opening = sum(before, (e) => (e.type === 'income' ? e.amount : -e.amount))
  const income = inPeriod.filter((e) => e.type === 'income')
  const expense = inPeriod.filter((e) => e.type === 'expense')
  const incomeSum = sum(income, (e) => e.amount)
  const expenseSum = sum(expense, (e) => e.amount)
  const closing = opening + incomeSum - expenseSum

  const err = home.error || loans.error

  return (
    <>
      <div className="sectionHead mobileOnly">
        <Tabs tabs={HOME_TABS} value={tab} onChange={setTab} />
        <button className="lockBtn" onClick={onLock} title="Lock">
          🔒 Lock
        </button>
      </div>
      <div className="pageHead">
        <h1 className="pageTitle desktopOnly">{HOME_TABS.find((t) => t.id === tab)?.label}</h1>
        {tab !== 'udhaar' && <PeriodBar period={period} onChange={setPeriod} />}
      </div>
      {err && <div className="errorBanner">{err}</div>}

      {tab === 'summary' && (
        <>
          <Hero label={period.mode === 'month' ? 'Balance at end of month' : 'Balance at end of day'} value={closing}>
            <HeroStat label="Opening balance" value={opening} />
            <HeroStat label="Money in" value={incomeSum} />
            <HeroStat label="Spent" value={expenseSum} />
          </Hero>
          <Card title="Quick add">
            <QuickActions
              items={[
                { icon: '💼', label: 'Add income', hint: 'Salary, earnings…', onClick: () => setAdding('income') },
                { icon: '🧾', label: 'Add expense', hint: 'Fuel, friends, bills…', onClick: () => setAdding('expense') },
                { icon: '🤝', label: 'Loans', hint: 'Lent or borrowed', onClick: () => setTab('udhaar') },
              ]}
            />
          </Card>
          {period.mode === 'month' && (
            <Card title="Daily spending">
              <BarChart data={dailySeries(expense, range[0], range[1], (e) => e.amount)} tone="out" />
            </Card>
          )}
          <div className="twoCol">
            <Card title="Where the money went">
              <Breakdown rows={groupSum(expense, (e) => e.category, (e) => e.amount)} tone="out" />
            </Card>
            <Card title="Where the money came from">
              <Breakdown rows={groupSum(income, (e) => e.category, (e) => e.amount)} tone="in" />
            </Card>
          </div>
          <UdhaarSnapshot loans={loans.items} onOpen={() => setTab('udhaar')} />
        </>
      )}

      {tab === 'entries' && (
        <>
          <StatGrid>
            <Stat label="Income" value={incomeSum} tone="in" />
            <Stat label="Expenses" value={expenseSum} tone="out" />
            <Stat label="Net" value={incomeSum - expenseSum} tone={incomeSum - expenseSum < 0 ? 'out' : 'in'} />
          </StatGrid>
          <div className="quickAdd">
            <button className="quickBtn" onClick={() => setAdding('income')}>
              <span className="qIc">+</span> Add income
            </button>
            <button className="quickBtn secondary" onClick={() => setAdding('expense')}>
              <span className="qIc">−</span> Add expense
            </button>
          </div>
          <Card>
            <List empty="No entries for this period. Use “Add income” or “Add expense” above.">
              {inPeriod.map((e) => (
                <Row
                  key={e.id}
                  icon={ICONS[e.category] ?? (e.type === 'income' ? '💵' : '🧾')}
                  title={e.category}
                  sub={e.note || undefined}
                  amount={(e.type === 'income' ? '+' : '−') + rs(e.amount)}
                  amountSub={shortDate(e.date)}
                  tone={e.type === 'income' ? 'in' : 'out'}
                  onClick={() => setDeleting(e)}
                />
              ))}
            </List>
          </Card>
        </>
      )}

      {tab === 'udhaar' && <LoansTab uid={uid} loans={loans.items} />}

      {tab !== 'udhaar' && <Fab label="Add expense" onClick={() => setAdding('expense')} />}

      {adding && <HomeForm uid={uid} initialType={adding} onClose={() => setAdding(null)} />}
      {deleting && (
        <ConfirmDelete
          what={`${deleting.category} — ${rs(deleting.amount)} (${shortDate(deleting.date)})`}
          onClose={() => setDeleting(null)}
          onConfirm={() => removeItem(homeCol(uid), deleting.id)}
        />
      )}
    </>
  )
}

function UdhaarSnapshot({ loans, onOpen }: { loans: LoanEntry[]; onOpen: () => void }) {
  const net = new Map<string, number>()
  for (const l of loans) {
    const sign = l.kind === 'diya' || l.kind === 'wapasKiya' ? 1 : -1
    net.set(l.person, (net.get(l.person) ?? 0) + sign * l.amount)
  }
  const lena = sum([...net.values()].filter((v) => v > 0), (v) => v)
  const dena = -sum([...net.values()].filter((v) => v < 0), (v) => v)
  return (
    <StatGrid>
      <Stat label="Others owe me" value={lena} tone="in" onClick={onOpen} hint="View loans ›" />
      <Stat label="I owe others" value={dena} tone="out" onClick={onOpen} hint="View loans ›" />
    </StatGrid>
  )
}

function HomeForm({ uid, initialType, onClose }: { uid: string; initialType: HomeType; onClose: () => void }) {
  const [type, setType] = useState<HomeType>(initialType)
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(initialType === 'income' ? HOME_INCOME[0] : HOME_EXPENSE[0])
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const cats = type === 'income' ? HOME_INCOME : HOME_EXPENSE

  return (
    <FormSheet
      title={type === 'income' ? 'Add income' : 'Add expense'}
      onClose={onClose}
      canSave={num(amount) > 0}
      onSave={() => addItem(homeCol(uid), { type, amount: num(amount), category, note: note.trim(), date })}
    >
      <Segmented
        options={[
          { id: 'income', label: 'Income (+)' },
          { id: 'expense', label: 'Expense (−)' },
        ]}
        value={type}
        onChange={(t) => {
          setType(t)
          setCategory(t === 'income' ? HOME_INCOME[0] : HOME_EXPENSE[0])
        }}
      />
      <Field label="Amount (Rs)">
        <MoneyInput value={amount} onChange={setAmount} autoFocus />
      </Field>
      <Field label={type === 'income' ? 'Source' : 'Category'}>
        <Chips options={cats} value={category} onChange={setCategory} />
      </Field>
      <Field label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Tea with Ali, 2 litres petrol" />
      </Field>
      <Field label="Date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
    </FormSheet>
  )
}
