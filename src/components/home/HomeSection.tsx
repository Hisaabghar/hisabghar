import { useState } from 'react'
import type { HomeEntry, HomeType, LoanEntry, Period } from '../../types'
import { homeCol, loansCol } from '../../lib/paths'
import { addItem, allByDate, removeItem, useLiveQuery } from '../../hooks/useData'
import { groupSum, inRange, periodRange, rs, shortDate, sum, today } from '../../lib/format'
import { HOME_EXPENSE, HOME_INCOME, ICONS } from '../../lib/catalog'
import {
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

type Tab = 'summary' | 'entries' | 'udhaar'

const byNewest = (a: { date: string; createdAt: number }, b: { date: string; createdAt: number }) =>
  b.date.localeCompare(a.date) || b.createdAt - a.createdAt

export function HomeSection({ uid, onLock }: { uid: string; onLock: () => void }) {
  const [tab, setTab] = useState<Tab>('summary')
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
      <div className="sectionHead">
        <Tabs
          tabs={[
            { id: 'summary', label: 'Khulasa' },
            { id: 'entries', label: 'Entries' },
            { id: 'udhaar', label: 'Udhaar' },
          ]}
          value={tab}
          onChange={setTab}
        />
        <button className="lockBtn" onClick={onLock} title="Lock karein">
          🔒 Lock
        </button>
      </div>
      {err && <div className="errorBanner">{err}</div>}

      {tab !== 'udhaar' && <PeriodBar period={period} onChange={setPeriod} />}

      {tab === 'summary' && (
        <>
          <Hero label={period.mode === 'month' ? 'Is mahine ke aakhir mein bacha' : 'Din ke aakhir mein bacha'} value={closing}>
            <HeroStat label="Shuru mein the" value={opening} />
            <HeroStat label="Aaye" value={incomeSum} />
            <HeroStat label="Kharch hue" value={expenseSum} />
          </Hero>
          <div className="twoCol">
            <Card title="Kahan kharch hua">
              <Breakdown rows={groupSum(expense, (e) => e.category, (e) => e.amount)} tone="out" />
            </Card>
            <Card title="Paise kahan se aaye">
              <Breakdown rows={groupSum(income, (e) => e.category, (e) => e.amount)} tone="in" />
            </Card>
          </div>
          <UdhaarSnapshot loans={loans.items} onOpen={() => setTab('udhaar')} />
        </>
      )}

      {tab === 'entries' && (
        <>
          <StatGrid>
            <Stat label="Aamdani" value={incomeSum} tone="in" />
            <Stat label="Kharcha" value={expenseSum} tone="out" />
            <Stat label="Farq" value={incomeSum - expenseSum} tone={incomeSum - expenseSum < 0 ? 'out' : 'in'} />
          </StatGrid>
          <div className="quickAdd">
            <button className="quickBtn" onClick={() => setAdding('income')}>
              <span className="qIc">+</span> Aamdani
            </button>
            <button className="quickBtn secondary" onClick={() => setAdding('expense')}>
              <span className="qIc">−</span> Kharcha
            </button>
          </div>
          <Card>
            <List empty="Is waqt mein koi entry nahi">
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

      {tab !== 'udhaar' && <Fab label="Kharcha" onClick={() => setAdding('expense')} />}

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
      <Stat label="Logon se lena hai" value={lena} tone="in" onClick={onOpen} hint="Udhaar dekhein ›" />
      <Stat label="Logon ko dena hai" value={dena} tone="out" onClick={onOpen} hint="Udhaar dekhein ›" />
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
      title={type === 'income' ? 'Aamdani likhein' : 'Kharcha likhein'}
      onClose={onClose}
      canSave={num(amount) > 0}
      onSave={() => addItem(homeCol(uid), { type, amount: num(amount), category, note: note.trim(), date })}
    >
      <Segmented
        options={[
          { id: 'income', label: 'Aamdani (+)' },
          { id: 'expense', label: 'Kharcha (−)' },
        ]}
        value={type}
        onChange={(t) => {
          setType(t)
          setCategory(t === 'income' ? HOME_INCOME[0] : HOME_EXPENSE[0])
        }}
      />
      <Field label="Raqam (Rs)">
        <MoneyInput value={amount} onChange={setAmount} autoFocus />
      </Field>
      <Field label={type === 'income' ? 'Kahan se aaye' : 'Kis cheez par'}>
        <Chips options={cats} value={category} onChange={setCategory} />
      </Field>
      <Field label="Detail (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Jaise: Ali ke sath chai, petrol 2 litre" />
      </Field>
      <Field label="Tareekh">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
    </FormSheet>
  )
}
