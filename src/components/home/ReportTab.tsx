import { useState } from 'react'
import { deleteField } from 'firebase/firestore'
import type { HomeEntry } from '../../types'
import { groupSum, rs, rsRaw, shortDate, sum } from '../../lib/format'
import { ICONS, accountIcon } from '../../lib/catalog'
import { settingsDoc } from '../../lib/paths'
import { mergeDoc } from '../../hooks/useData'
import type { BudgetRow } from '../../lib/budget'
import { Card, Chips, Field, FormSheet, List, MoneyInput, Row, Stat, StatGrid, num } from '../ui/kit'

/** Bars of this month's spending against each category's limit. */
export function BudgetCard({ rows, onEdit, editLabel = 'Edit' }: { rows: BudgetRow[]; onEdit: () => void; editLabel?: string }) {
  return (
    <Card
      title="🎯 Monthly budget (this month)"
      action={
        <button className="linkBtn" onClick={onEdit}>
          {editLabel}
        </button>
      }
    >
      {rows.length === 0 ? (
        <div className="empty">No budgets yet. Set a monthly limit for fuel, food, bills… and get a warning before you cross it.</div>
      ) : (
        <div className="budgetList">
          {rows.map((r) => (
            <div key={r.category} className="budgetRow">
              <div className="bdTop">
                <span>
                  {ICONS[r.category] && <span className="bdIc">{ICONS[r.category]}</span>}
                  {r.category}
                </span>
                <span className={`bdVal ${r.level === 100 ? 'over' : r.level ? 'warn' : ''}`}>
                  {rs(r.spent)} / {rs(r.limit)}
                </span>
              </div>
              <div className="bdTrack">
                <div className={`bdBar budget ${r.level === 100 ? 'over' : r.level ? 'warn' : ''}`} style={{ width: `${Math.min(100, r.pct)}%` }} />
              </div>
              <div className={`budgetHint ${r.level === 100 ? 'over' : ''}`}>
                {r.level === 100 ? `Crossed by ${rs(r.spent - r.limit)}` : `${rs(r.limit - r.spent)} left · ${Math.round(r.pct)}% used`}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function BudgetSheet({ uid, budgets, cats, onClose }: { uid: string; budgets: Record<string, number>; cats: string[]; onClose: () => void }) {
  const [cat, setCat] = useState(cats.find((c) => !(c in budgets)) ?? cats[0])
  const [amount, setAmount] = useState(budgets[cat] ? String(budgets[cat]) : '')
  const pick = (c: string) => {
    setCat(c)
    setAmount(budgets[c] ? String(budgets[c]) : '')
  }
  return (
    <FormSheet
      title="🎯 Set a monthly budget"
      onClose={onClose}
      canSave={num(amount) > 0}
      onSave={() => mergeDoc(settingsDoc(uid), { budgets: { [cat]: num(amount) } })}
    >
      <Field label="Category">
        <Chips options={cats} value={cat} onChange={pick} />
      </Field>
      <Field label={`Limit for ${cat} per month`}>
        <MoneyInput value={amount} onChange={setAmount} autoFocus />
      </Field>
      <div className="statHint">You get a warning at 80% and when the limit is crossed.</div>
      {Object.keys(budgets).length > 0 && (
        <div className="budgetSet">
          <div className="statHint">Your budgets:</div>
          {Object.entries(budgets).map(([c, v]) => (
            <div key={c} className="budgetSetRow">
              <button type="button" className="chip" onClick={() => pick(c)}>
                {c}: {rsRaw(v)}
              </button>
              <button
                type="button"
                className="linkBtn danger"
                onClick={async () => {
                  await mergeDoc(settingsDoc(uid), { budgets: { [c]: deleteField() } })
                  onClose()
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </FormSheet>
  )
}

const ALL = 'All accounts'

/** Every expense of the period added up by category, for all accounts or one account. */
export function ReportTab({
  uid,
  budgets,
  budget,
  cats: budgetCats,
  expenses,
  accounts,
  accountOf,
  onOpen,
}: {
  uid: string
  budgets: Record<string, number>
  budget: BudgetRow[]
  cats: string[]
  expenses: HomeEntry[]
  accounts: string[]
  accountOf: (e: HomeEntry) => string
  onOpen: (e: HomeEntry) => void
}) {
  const [acc, setAcc] = useState(ALL)
  const [open, setOpen] = useState<string | null>(null)
  const [settingBudget, setSettingBudget] = useState(false)
  const list = acc === ALL ? expenses : expenses.filter((e) => accountOf(e) === acc)
  const total = sum(list, (e) => e.amount)
  const cats = groupSum(list, (e) => e.category, (e) => e.amount)
  const byAcc = groupSum(expenses, accountOf, (e) => e.amount)
  const max = Math.max(1, ...cats.map((c) => c[1]))

  return (
    <>
      <StatGrid>
        <Stat label="Total spent" value={total} tone="out" />
        <Stat label="Entries" value={String(list.length)} />
        <Stat label="Categories" value={String(cats.length)} />
      </StatGrid>
      <BudgetCard rows={budget} onEdit={() => setSettingBudget(true)} editLabel="＋ Set budget" />
      {settingBudget && <BudgetSheet uid={uid} budgets={budgets} cats={budgetCats} onClose={() => setSettingBudget(false)} />}
      <Card title="Account">
        <Chips options={[ALL, ...accounts.filter((a) => byAcc.some(([k]) => k === a))]} value={acc} onChange={(a) => (setAcc(a), setOpen(null))} />
      </Card>
      <Card title={acc === ALL ? 'Spent on — all accounts' : `Spent on — from ${acc}`}>
        {cats.length === 0 ? (
          <div className="empty">No expenses in this period.</div>
        ) : (
          <div className="reportList">
            {cats.map(([cat, v]) => {
              const items = list.filter((e) => e.category === cat)
              const isOpen = open === cat
              return (
                <div key={cat} className="reportCat">
                  <button className="reportHead" onClick={() => setOpen(isOpen ? null : cat)}>
                    <span className="reportIc">{ICONS[cat] ?? '🧾'}</span>
                    <span className="reportBody">
                      <span className="reportName">
                        {cat} <span className="reportCount">· {items.length}×</span>
                      </span>
                      <span className="bdTrack">
                        <span className="bdBar out" style={{ width: `${(v / max) * 100}%` }} />
                      </span>
                    </span>
                    <span className="reportAmt">
                      {rs(v)}
                      <span className="reportPct">{total ? Math.round((v / total) * 100) : 0}%</span>
                    </span>
                    <span className="reportChev">{isOpen ? '▾' : '▸'}</span>
                  </button>
                  {isOpen && (
                    <div className="reportItems">
                      {acc === ALL && (
                        <div className="reportSplit">
                          {groupSum(items, accountOf, (e) => e.amount).map(([a, x]) => (
                            <span key={a} className="chip">
                              {accountIcon(a)} {a}: {rs(x)}
                            </span>
                          ))}
                        </div>
                      )}
                      {items.map((e) => (
                        <Row
                          key={e.id}
                          icon={accountIcon(accountOf(e))}
                          title={e.note || cat}
                          sub={`from ${accountOf(e)}${e.owner ? ` · ${e.owner}'s money` : ''}`}
                          amount={'−' + rs(e.amount)}
                          amountSub={`${shortDate(e.date)}${e.time ? ' · ' + e.time : ''}`}
                          tone="out"
                          onClick={() => onOpen(e)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
      {acc === ALL && byAcc.length > 0 && (
        <Card title="Spent from each account">
          <List empty="">
            {byAcc.map(([a, v]) => (
              <Row
                key={a}
                icon={accountIcon(a)}
                title={a}
                sub={groupSum(expenses.filter((e) => accountOf(e) === a), (e) => e.category, (e) => e.amount)
                  .slice(0, 3)
                  .map(([c, x]) => `${c} ${rs(x)}`)
                  .join(' · ')}
                amount={'−' + rs(v)}
                tone="out"
                onClick={() => (setAcc(a), setOpen(null))}
              />
            ))}
          </List>
        </Card>
      )}
    </>
  )
}
