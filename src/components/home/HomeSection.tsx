import { arrayRemove, arrayUnion } from 'firebase/firestore'
import { Sheet } from '../ui/Sheet'
import { useState } from 'react'
import type { HomeEntry, HomeType, LoanEntry, Period, Settings } from '../../types'
import { homeCol, loansCol, settingsDoc } from '../../lib/paths'
import { allByDate, mergeDoc, removeItem, useLiveQuery, patchItem } from '../../hooks/useData'
import { dailySeries, groupSum, inRange, periodRange, rs, shortDate, sum, today } from '../../lib/format'
import { ICONS, accountIcon, allHomeAccounts } from '../../lib/catalog'
import { HomeForm, ME } from './HomeForm'
import {
  QuickActions,
  Breakdown,
  Card,
  EditEntry,
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
  onLock: () => void
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
  const [accSheet, setAccSheet] = useState<{ account: string; total: number } | null>(null)
  const [ownerSheet, setOwnerSheet] = useState<string | null>(null)
  const [wipeOwner, setWipeOwner] = useState(false)
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
                  onClick={() => setAccSheet({ account: a.account, total: a.total })}
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
                  onClick={o === ME ? undefined : () => setOwnerSheet(o)}
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

      {tab === 'udhaar' && <LoansTab uid={uid} loans={loans.items} />}

      {tab !== 'udhaar' && <Fab label="Add expense" onClick={() => setAdding('expense')} />}

      {ownerSheet &&
        !deleting &&
        (() => {
          const list = all.filter((e) => e.owner === ownerSheet)
          const total = sum(list, (e) => (e.type === 'income' ? e.amount : e.type === 'expense' ? -e.amount : 0))
          return (
            <Sheet
              title={`${ownerSheet}'s money`}
              onClose={() => {
                setOwnerSheet(null)
                setWipeOwner(false)
              }}
            >
              <p className="sheetText">
                Holding now: <b>{rs(total)}</b> · tap an entry to edit or delete it.
              </p>
              <List empty="No entries.">
                {list.map((e) => (
                  <Row
                    key={e.id}
                    icon={e.type === 'income' ? '📥' : e.type === 'expense' ? '📤' : '🔁'}
                    title={e.type === 'income' ? `Kept in ${accountOf(e)}` : e.type === 'expense' ? `Paid out of ${accountOf(e)}` : `${accountOf(e)} → ${e.toAccount}`}
                    sub={[e.category, e.note].filter(Boolean).join(' · ')}
                    amount={(e.type === 'income' ? '+' : e.type === 'expense' ? '−' : '') + rs(e.amount)}
                    amountSub={`${shortDate(e.date)}${e.time ? ' · ' + e.time : ''}`}
                    tone={e.type === 'income' ? 'in' : e.type === 'expense' ? 'out' : undefined}
                    onClick={() => setDeleting(e)}
                  />
                ))}
              </List>
              {wipeOwner ? (
                <>
                  <div className="errorBanner">
                    Delete all {list.length} entries of {ownerSheet}? Their {rs(total)} will no longer show in your accounts. This can’t be undone.
                  </div>
                  <div className="sheetBtns">
                    <button className="btnGhost" onClick={() => setWipeOwner(false)}>
                      Back
                    </button>
                    <button
                      className="btnDanger"
                      onClick={async () => {
                        for (const e of list) await removeItem(homeCol(uid), e.id)
                        await mergeDoc(settingsDoc(uid), { owners: arrayRemove(ownerSheet) })
                        setWipeOwner(false)
                        setOwnerSheet(null)
                      }}
                    >
                      Yes, delete all
                    </button>
                  </div>
                </>
              ) : (
                <div className="sheetBtns">
                  <button className="btnGhost delOutline" onClick={() => setWipeOwner(true)}>
                    🗑️ Delete all
                  </button>
                  <button
                    className="btnPrimary"
                    onClick={() => {
                      const o = ownerSheet
                      setOwnerSheet(null)
                      setAdding('expense', o)
                    }}
                  >
                    ↪️ Return / pay out money
                  </button>
                </div>
              )}
            </Sheet>
          )
        })()}
      {accSheet && (
        <Sheet title={`${accountIcon(accSheet.account)} ${accSheet.account}`} onClose={() => setAccSheet(null)}>
          <p className="sheetText">
            Balance: <b>{rs(accSheet.total)}</b>
          </p>
          {Math.round(accSheet.total) !== 0 ? (
            <>
              <div className="errorBanner">
                This account still has money. Move it to another account with a Transfer first (or edit its entries), then you can delete it.
              </div>
              <div className="sheetBtns">
                <button className="btnGhost" onClick={() => setAccSheet(null)}>
                  Close
                </button>
                <button
                  className="btnPrimary"
                  onClick={() => {
                    setAccSheet(null)
                    setAdding('transfer')
                  }}
                >
                  🔁 Transfer money out
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="sheetText">Remove this account from your list? Old entries stay in your history.</p>
              <div className="sheetBtns">
                <button className="btnGhost" onClick={() => setAccSheet(null)}>
                  Cancel
                </button>
                <button
                  className="btnDanger"
                  onClick={async () => {
                    await mergeDoc(settingsDoc(uid), {
                      homeAccounts: arrayRemove(accSheet.account),
                      hiddenAccounts: arrayUnion(accSheet.account),
                    })
                    setAccSheet(null)
                  }}
                >
                  🗑️ Delete account
                </button>
              </div>
            </>
          )}
        </Sheet>
      )}
      {adding && (
        <HomeForm
          uid={uid}
          initialType={adding.type}
          initialOwner={adding.owner === '' ? undefined : adding.owner}
          accounts={accounts}
          owners={owners}
          onClose={() => setAdding(null)}
        />
      )}
      {deleting && (
        <EditEntry
          title={deleting.type === 'transfer' ? `Transfer ${deleting.account ?? ''} → ${deleting.toAccount ?? ''}` : deleting.category}
          subtitle={`${deleting.type === 'income' ? 'Income' : deleting.type === 'expense' ? 'Expense' : 'Transfer'}${deleting.owner ? ` · ${deleting.owner}'s money` : ''}`}
          fields={[
            { key: 'amount', label: 'Amount (Rs)', kind: 'money' },
            { key: 'note', label: 'Note', kind: 'text' },
            { key: 'date', label: 'Date', kind: 'date' },
            { key: 'time', label: 'Time', kind: 'time' },
          ]}
          initial={deleting}
          onSave={(v) => patchItem(homeCol(uid), deleting.id, v)}
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
