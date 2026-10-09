import { arrayRemove, arrayUnion, deleteField } from 'firebase/firestore'
import { Sheet } from '../ui/Sheet'
import { useState } from 'react'
import type { HomeEntry, HomeType, LoanEntry, Period, Settings } from '../../types'
import { homeCol, loansCol, settingsDoc } from '../../lib/paths'
import { addItem, allByDate, mergeDoc, removeItem, useLiveQuery, patchItem } from '../../hooks/useData'
import { dailySeries, groupSum, inRange, periodRange, rs, shortDate, sum, today } from '../../lib/format'
import { HOME_EXPENSE, HOME_INCOME, ICONS, accountIcon, allHomeAccounts } from '../../lib/catalog'
import { HomeForm, ME, withExtra } from './HomeForm'
import {
  QuickActions,
  Breakdown,
  Card,
  EditEntry,
  Field,
  MoneyInput,
  num,
  type EditField,
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
import { BillsTab } from './BillsTab'
import { ReportTab } from './ReportTab'

export type HomeTab = 'summary' | 'entries' | 'report' | 'bills' | 'udhaar'
export const HOME_TABS: { id: HomeTab; label: string; icon: string }[] = [
  { id: 'summary', label: 'Overview', icon: '📈' },
  { id: 'entries', label: 'Income & Expenses', icon: '🧾' },
  { id: 'report', label: 'Spending report', icon: '📊' },
  { id: 'bills', label: 'Monthly bills', icon: '🔔' },
  { id: 'udhaar', label: 'Loans', icon: '🤝' },
]

const byNewest = (a: HomeEntry, b: HomeEntry) =>
  b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? '') || b.createdAt - a.createdAt

const DEFAULT_ACCOUNT = 'Cash in pocket'
const accountOf = (e: HomeEntry) => e.account || DEFAULT_ACCOUNT

const ownerOf = (e: HomeEntry) => e.owner || ME
const isMine = (e: HomeEntry) => ownerOf(e) === ME

/** Money in every account split by whose it is, from all entries up to and including `upTo`. */
function holdings(entries: HomeEntry[], accounts: string[], upTo: string) {
  const byAcc = new Map<string, Map<string, number>>(accounts.map((a) => [a, new Map()]))
  const add = (acc: string, owner: string, v: number) => {
    const m = byAcc.get(acc) ?? new Map<string, number>()
    m.set(owner, (m.get(owner) ?? 0) + v)
    byAcc.set(acc, m)
  }
  for (const e of entries) {
    if (e.date > upTo) continue
    const o = ownerOf(e)
    if (e.type === 'income') add(accountOf(e), o, e.amount)
    else if (e.type === 'expense') add(accountOf(e), o, -e.amount)
    else {
      add(accountOf(e), o, -e.amount)
      if (e.toAccount) add(e.toAccount, o, e.amount)
    }
  }
  const accountsOut = [...byAcc.entries()].map(([account, m]) => {
    const total = [...m.values()].reduce((s, v) => s + v, 0)
    const mine = m.get(ME) ?? 0
    return { account, total, mine, others: total - mine }
  })
  const owners = new Map<string, { total: number; where: [string, number][] }>()
  for (const [acc, m] of byAcc) {
    for (const [o, v] of m) {
      const cur = owners.get(o) ?? { total: 0, where: [] }
      cur.total += v
      if (Math.round(v) !== 0) cur.where.push([acc, v])
      owners.set(o, cur)
    }
  }
  return { accounts: accountsOut, owners }
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
  onLock?: () => void
  tab: HomeTab
  setTab: (t: HomeTab) => void
}) {
  const [period, setPeriod] = useState<Period>({ mode: 'month', date: today() })
  const [adding, setAddingState] = useState<{ type: HomeType; owner?: string } | null>(null)
  const setAdding = (type: HomeType | null, owner?: string) => setAddingState(type ? { type, owner } : null)
  const [deleting, setDeleting] = useState<HomeEntry | null>(null)

  const home = useLiveQuery<HomeEntry>(allByDate(homeCol(uid)), `home-${uid}`)
  const loans = useLiveQuery<LoanEntry>(allByDate(loansCol(uid)), `loans-${uid}`)

  const range = periodRange(period)
  const all = [...home.items].sort(byNewest)
  const inPeriod = all.filter((e) => inRange(e.date, range))
  const before = all.filter((e) => e.date < range[0])

  const hidden = new Set(settings.hiddenAccounts ?? [])
  const accounts = allHomeAccounts([...(settings.homeAccounts ?? []), ...all.flatMap((e) => [e.account ?? '', e.toAccount ?? ''])]).filter(
    (a) => !hidden.has(a),
  )
  const [view, setView] = useState<{ type: 'owner' | 'mine' | 'account'; name: string } | null>(null)
  const [wipe, setWipe] = useState(false)
  const [fixing, setFixing] = useState<string | null>(null)
  const owners = [...new Set([...(settings.owners ?? []), ...all.map((e) => e.owner ?? '').filter(Boolean)])]
  const held = holdings(all, accounts, range[1])
  const othersHeld = [...held.owners.entries()].filter(([o, v]) => o !== ME && Math.round(v.total) !== 0)
  // The summary is about the user's own money; money kept for others is shown separately.
  const opening = sum(before.filter(isMine), (e) => (e.type === 'income' ? e.amount : e.type === 'expense' ? -e.amount : 0))
  const income = inPeriod.filter((e) => e.type === 'income' && isMine(e))
  const expense = inPeriod.filter((e) => e.type === 'expense' && isMine(e))
  const incomeSum = sum(income, (e) => e.amount)
  const expenseSum = sum(expense, (e) => e.amount)
  const closing = opening + incomeSum - expenseSum

  const err = home.error || loans.error

  return (
    <>
      <div className="sectionHead mobileOnly">
        <Tabs tabs={HOME_TABS} value={tab} onChange={setTab} />
        {onLock && (
          <button className="lockBtn" onClick={onLock} title="Lock">
            🔒 Lock
          </button>
        )}
      </div>
      <div className="pageHead">
        <h1 className="pageTitle desktopOnly">{HOME_TABS.find((t) => t.id === tab)?.label}</h1>
        {tab !== 'udhaar' && tab !== 'bills' && <PeriodBar period={period} onChange={setPeriod} />}
      </div>
      {err && <div className="errorBanner">{err}</div>}

      {tab === 'summary' && (
        <>
          <Hero
            label={period.mode === 'month' ? 'My money at end of month' : 'My money at end of day'}
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
              {held.accounts.map((a) => (
                <Stat
                  key={a.account}
                  icon={accountIcon(a.account)}
                  label={a.account}
                  value={a.total}
                  tone={a.total < 0 ? 'out' : undefined}
                  hint={Math.round(a.others) !== 0 ? `Mine ${rs(a.mine)} · Others ${rs(a.others)}` : undefined}
                  onClick={() => setView({ type: 'account', name: a.account })}
                />
              ))}
            </StatGrid>
          </Card>
          <Card
            title="Whose money is it?"
            action={
              <button className="linkBtn" onClick={() => setAdding('income', owners[0] ?? '')}>
                + Keep money for someone
              </button>
            }
          >
            <List empty="All the money in your accounts is yours. Use “Keep money for someone” when you hold money for others.">
              {[[ME, held.owners.get(ME) ?? { total: 0, where: [] }] as const, ...othersHeld].map(([o, v]) => (
                <Row
                  key={o}
                  icon={o === ME ? '🙋' : o.slice(0, 1).toUpperCase()}
                  title={o === ME ? 'Mine' : `${o}'s money`}
                  sub={v.where.map(([acc, amt]) => `${acc} ${rs(amt)}`).join(' · ') || 'Nothing held'}
                  amount={rs(v.total)}
                  tone={o === ME ? 'in' : undefined}
                  onClick={() => setView(o === ME ? { type: 'mine', name: ME } : { type: 'owner', name: o })}
                />
              ))}
            </List>
          </Card>
          <Card title="Quick add">
            <QuickActions
              items={[
                { icon: '💼', label: 'Add income', hint: 'Salary, earnings…', onClick: () => setAdding('income') },
                { icon: '🧾', label: 'Add expense', hint: 'Fuel, friends, bills…', onClick: () => setAdding('expense') },
                { icon: '🔁', label: 'Transfer', hint: 'Bank → cash, etc.', onClick: () => setAdding('transfer') },
                { icon: '🤲', label: "Someone's money", hint: 'Uncle, Abu…', onClick: () => setAdding('income', owners[0] ?? '') },
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
                      isMine(e) ? '' : `${ownerOf(e)}'s money`,
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

      {tab === 'report' && (
        <ReportTab expenses={inPeriod.filter((e) => e.type === 'expense')} accounts={accounts} accountOf={accountOf} onOpen={setDeleting} />
      )}

      {tab === 'bills' && <BillsTab uid={uid} settings={settings} accounts={accounts} />}

      {tab === 'udhaar' && <LoansTab uid={uid} loans={loans.items} />}

      {tab !== 'udhaar' && tab !== 'bills' && <Fab label="Add expense" onClick={() => setAdding('expense')} />}

      {view &&
        !deleting &&
        (() => {
          // Entries that make up this person's money / this account's balance.
          const list = all.filter((e) =>
            view.type === 'owner'
              ? e.owner === view.name
              : view.type === 'mine'
                ? isMine(e)
                : accountOf(e) === view.name || e.toAccount === view.name,
          )
          const effect = (e: HomeEntry) =>
            view.type === 'account'
              ? e.type === 'income'
                ? e.amount
                : e.type === 'expense'
                  ? -e.amount
                  : (e.toAccount === view.name ? e.amount : 0) - (accountOf(e) === view.name ? e.amount : 0)
              : e.type === 'income'
                ? e.amount
                : e.type === 'expense'
                  ? -e.amount
                  : 0
          const total = sum(list, effect)
          const close = () => {
            setView(null)
            setWipe(false)
            setFixing(null)
          }
          const title = view.type === 'owner' ? `${view.name}'s money` : view.type === 'mine' ? 'My money' : `${accountIcon(view.name)} ${view.name}`
          return (
            <Sheet title={title} onClose={close}>
              <p className="sheetText">
                {view.type === 'account' ? 'Balance' : 'Holding now'}: <b>{rs(total)}</b> · tap any entry to edit or delete it.
              </p>

              {view.type === 'account' && fixing !== null && (
                <div className="fixBox">
                  <Field label={`Actual balance in ${view.name} right now (Rs)`}>
                    <MoneyInput value={fixing} onChange={setFixing} autoFocus />
                  </Field>
                  {fixing !== '' && Math.round(num(fixing) - total) !== 0 && (
                    <div className="statHint">
                      A “Balance correction” of {num(fixing) - total > 0 ? '+' : '−'}
                      {rs(Math.abs(num(fixing) - total))} will be added so the balance becomes {rs(num(fixing))}.
                    </div>
                  )}
                  <div className="sheetBtns">
                    <button className="btnGhost" onClick={() => setFixing(null)}>
                      Cancel
                    </button>
                    <button
                      className="btnPrimary"
                      disabled={fixing === '' || Math.round(num(fixing) - total) === 0}
                      onClick={async () => {
                        const diff = num(fixing) - total
                        await addItem(homeCol(uid), {
                          type: diff > 0 ? 'income' : 'expense',
                          amount: Math.abs(diff),
                          category: 'Balance correction',
                          account: view.name,
                          note: `Set balance to ${num(fixing)}`,
                          date: today(),
                          time: new Date().toTimeString().slice(0, 5),
                        })
                        setFixing(null)
                      }}
                    >
                      Save balance
                    </button>
                  </div>
                </div>
              )}

              <List empty="No entries.">
                {list.map((e) => {
                  const v = effect(e)
                  return (
                    <Row
                      key={e.id}
                      icon={e.type === 'transfer' ? '🔁' : (ICONS[e.category] ?? (e.type === 'income' ? '💵' : '🧾'))}
                      title={e.type === 'transfer' ? `${accountOf(e)} → ${e.toAccount}` : e.category}
                      sub={[
                        view.type !== 'account' ? accountOf(e) : '',
                        view.type !== 'owner' && !isMine(e) ? `${ownerOf(e)}'s money` : '',
                        e.note,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      amount={(v > 0 ? '+' : v < 0 ? '−' : '') + rs(Math.abs(v || e.amount))}
                      amountSub={`${shortDate(e.date)}${e.time ? ' · ' + e.time : ''}`}
                      tone={v > 0 ? 'in' : v < 0 ? 'out' : undefined}
                      onClick={() => setDeleting(e)}
                    />
                  )
                })}
              </List>

              {wipe ? (
                <>
                  <div className="errorBanner">
                    Delete all {list.length} entries {view.type === 'account' ? `of ${view.name}` : view.type === 'owner' ? `of ${view.name}` : 'of your own money'}? This can’t be undone.
                  </div>
                  <div className="sheetBtns">
                    <button className="btnGhost" onClick={() => setWipe(false)}>
                      Back
                    </button>
                    <button
                      className="btnDanger"
                      onClick={async () => {
                        for (const e of list) await removeItem(homeCol(uid), e.id)
                        if (view.type === 'owner') await mergeDoc(settingsDoc(uid), { owners: arrayRemove(view.name) })
                        close()
                      }}
                    >
                      Yes, delete all
                    </button>
                  </div>
                </>
              ) : (
                <div className="sheetBtns wrapBtns">
                  {list.length > 0 && (
                    <button className="btnGhost delOutline" onClick={() => setWipe(true)}>
                      🗑️ Delete all
                    </button>
                  )}
                  {view.type === 'account' && Math.round(total) === 0 && (
                    <button
                      className="btnDanger"
                      onClick={async () => {
                        await mergeDoc(settingsDoc(uid), { homeAccounts: arrayRemove(view.name), hiddenAccounts: arrayUnion(view.name) })
                        close()
                      }}
                    >
                      Remove account
                    </button>
                  )}
                  {view.type === 'account' && fixing === null && (
                    <button className="btnGhost" onClick={() => setFixing(String(Math.round(total)))}>
                      ✏️ Correct balance
                    </button>
                  )}
                  {view.type === 'account' && Math.round(total) !== 0 && (
                    <button
                      className="btnPrimary"
                      onClick={() => {
                        close()
                        setAdding('transfer')
                      }}
                    >
                      🔁 Transfer out
                    </button>
                  )}
                  {view.type === 'owner' && (
                    <button
                      className="btnPrimary"
                      onClick={() => {
                        const o = view.name
                        close()
                        setAdding('expense', o)
                      }}
                    >
                      ↪️ Return / pay out
                    </button>
                  )}
                </div>
              )}
            </Sheet>
          )
        })()}
      {adding && (
        <HomeForm
          uid={uid}
          initialType={adding.type}
          initialOwner={adding.owner === '' ? undefined : adding.owner}
          accounts={accounts}
          owners={owners}
          extraCats={{ income: settings.incomeCats ?? [], expense: settings.expenseCats ?? [] }}
          onClose={() => setAdding(null)}
        />
      )}
      {deleting && (
        <EditEntry
          title={deleting.type === 'transfer' ? `Transfer ${deleting.account ?? ''} → ${deleting.toAccount ?? ''}` : deleting.category}
          subtitle={`${deleting.type === 'income' ? 'Income' : deleting.type === 'expense' ? 'Expense' : 'Transfer'}${deleting.owner ? ` · ${deleting.owner}'s money` : ''}`}
          fields={[
            { key: 'amount', label: 'Amount (Rs)', kind: 'money' },
            ...(deleting.type === 'transfer'
              ? ([
                  { key: 'account', label: 'From account', kind: 'select', options: accounts.map((a) => ({ value: a, label: a })) },
                  { key: 'toAccount', label: 'To account', kind: 'select', options: accounts.map((a) => ({ value: a, label: a })) },
                ] as EditField[])
              : ([
                  { key: 'account', label: deleting.type === 'income' ? 'Received in' : 'Paid from', kind: 'select', options: accounts.map((a) => ({ value: a, label: a })) },
                  {
                    key: 'category',
                    label: 'Category',
                    kind: 'select',
                    options: (deleting.type === 'income'
                      ? withExtra(HOME_INCOME, settings.incomeCats)
                      : withExtra(HOME_EXPENSE, settings.expenseCats)
                    ).concat('Balance correction').map((c) => ({ value: c, label: c })),
                  },
                ] as EditField[])),
            {
              key: 'owner',
              label: 'Whose money',
              kind: 'select',
              options: [{ value: '', label: 'Mine' }, ...owners.map((o) => ({ value: o, label: o }))],
            },
            { key: 'note', label: 'Note', kind: 'text' },
            { key: 'date', label: 'Date', kind: 'date' },
            { key: 'time', label: 'Time', kind: 'time' },
          ]}
          initial={{ ...deleting, account: accountOf(deleting), owner: deleting.owner ?? '' }}
          onSave={(v) => {
            const { owner, ...rest } = v
            return patchItem(homeCol(uid), deleting.id, { ...rest, owner: owner ? owner : deleteField() })
          }}
          onDelete={() => removeItem(homeCol(uid), deleting.id)}
          onClose={() => setDeleting(null)}
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
