import { useState } from 'react'
import type { HomeEntry, HomeType, LoanEntry, Period, Settings } from '../../types'
import { homeCol, loansCol } from '../../lib/paths'
import { allByDate, removeItem, useLiveQuery } from '../../hooks/useData'
import { dailySeries, groupSum, inRange, periodRange, rs, shortDate, sum, today } from '../../lib/format'
import { ICONS, accountIcon, allHomeAccounts } from '../../lib/catalog'
import { HomeForm } from './HomeForm'
import {
  QuickActions,
  Breakdown,
  Card,
  ConfirmDelete,
  Fab,
  Hero,
  HeroStat,
  List,
  PeriodBar,
  Row,
  Stat,
  StatGrid,
  Tabs,
} from '../ui/kit'
import { LoansTab } from './LoansTab'
import { BarChart } from '../ui/BarChart'

export type HomeTab = 'summary' | 'entries' | 'udhaar'
export const HOME_TABS: { id: HomeTab; label: string; icon: string }[] = [
  { id: 'summary', label: 'Overview', icon: '📈' },
  { id: 'entries', label: 'Income & Expenses', icon: '🧾' },
  { id: 'udhaar', label: 'Loans', icon: '🤝' },
]

const byNewest = (a: HomeEntry, b: HomeEntry) =>
  b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? '') || b.createdAt - a.createdAt

const DEFAULT_ACCOUNT = 'Cash in pocket'
const accountOf = (e: HomeEntry) => e.account || DEFAULT_ACCOUNT

/** Balance of every account from all entries up to and including `upTo`. */
function accountBalances(entries: HomeEntry[], accounts: string[], upTo: string) {
  const bal = new Map<string, number>(accounts.map((a) => [a, 0]))
  const add = (a: string, v: number) => bal.set(a, (bal.get(a) ?? 0) + v)
  for (const e of entries) {
    if (e.date > upTo) continue
    if (e.type === 'income') add(accountOf(e), e.amount)
    else if (e.type === 'expense') add(accountOf(e), -e.amount)
    else {
      add(accountOf(e), -e.amount)
      if (e.toAccount) add(e.toAccount, e.amount)
    }
  }
  return [...bal.entries()]
}

export function HomeSection({
  uid,
  settings,
  onLock,
  tab,
  setTab,
}: {
  uid: string
  settings: Settings
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

  const accounts = allHomeAccounts([...(settings.homeAccounts ?? []), ...all.flatMap((e) => [e.account ?? '', e.toAccount ?? ''])])
  const balances = accountBalances(all, accounts, range[1])
  const opening = sum(before, (e) => (e.type === 'income' ? e.amount : e.type === 'expense' ? -e.amount : 0))
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
          <Hero
            label={period.mode === 'month' ? 'Balance at end of month' : 'Balance at end of day'}
            value={closing}
            spark={period.mode === 'month' ? dailySeries(expense, range[0], range[1], (e) => e.amount).map((d) => d.value) : undefined}
          >
            <HeroStat label="Opening balance" value={opening} />
            <HeroStat label="Money in" value={incomeSum} />
            <HeroStat label="Spent" value={expenseSum} />
            {incomeSum > 0 && (
              <span className="heroChip">
                {expenseSum <= incomeSum
                  ? `You saved ${Math.round(((incomeSum - expenseSum) / incomeSum) * 100)}% of your income`
                  : `Spent ${rs(expenseSum - incomeSum)} more than you earned`}
              </span>
            )}
          </Hero>
          <Card title={period.date === today() || period.mode === 'month' ? 'My accounts' : 'Account balances'}>
            <StatGrid>
              {balances.map(([a, v]) => (
                <Stat key={a} icon={accountIcon(a)} label={a} value={v} tone={v < 0 ? 'out' : undefined} />
              ))}
            </StatGrid>
          </Card>
          <Card title="Quick add">
            <QuickActions
              items={[
                { icon: '💼', label: 'Add income', hint: 'Salary, earnings…', onClick: () => setAdding('income') },
                { icon: '🧾', label: 'Add expense', hint: 'Fuel, friends, bills…', onClick: () => setAdding('expense') },
                { icon: '🔁', label: 'Transfer', hint: 'Bank → cash, etc.', onClick: () => setAdding('transfer') },
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
              <Breakdown rows={groupSum(expense, (e) => e.category, (e) => e.amount)} tone="out" icons={ICONS} />
            </Card>
            <Card title="Where the money came from">
              <Breakdown rows={groupSum(income, (e) => e.category, (e) => e.amount)} tone="in" icons={ICONS} />
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
            <button className="quickBtn plain span2" onClick={() => setAdding('transfer')}>
              <span className="qIc">⇄</span> Transfer between accounts
            </button>
          </div>
          <Card>
            <List empty="No entries for this period. Use “Add income” or “Add expense” above.">
              {inPeriod.map((e) => (
                <Row
                  key={e.id}
                  icon={e.type === 'transfer' ? '🔁' : (ICONS[e.category] ?? (e.type === 'income' ? '💵' : '🧾'))}
                  title={e.type === 'transfer' ? `${accountOf(e)} → ${e.toAccount}` : e.category}
                  sub={
                    [
                      e.type === 'income' ? `into ${accountOf(e)}` : e.type === 'expense' ? `from ${accountOf(e)}` : 'Transfer',
                      e.note,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  }
                  amount={(e.type === 'income' ? '+' : e.type === 'expense' ? '−' : '') + rs(e.amount)}
                  amountSub={`${shortDate(e.date)}${e.time ? ' · ' + e.time : ''}`}
                  tone={e.type === 'income' ? 'in' : e.type === 'expense' ? 'out' : undefined}
                  onClick={() => setDeleting(e)}
                />
              ))}
            </List>
          </Card>
        </>
      )}

      {tab === 'udhaar' && <LoansTab uid={uid} loans={loans.items} />}

      {tab !== 'udhaar' && <Fab label="Add expense" onClick={() => setAdding('expense')} />}

      {adding && <HomeForm uid={uid} initialType={adding} accounts={accounts} onClose={() => setAdding(null)} />}
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
