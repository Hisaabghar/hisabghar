import { useState } from 'react'
import type { HomeEntry } from '../../types'
import { groupSum, rs, shortDate, sum } from '../../lib/format'
import { ICONS, accountIcon } from '../../lib/catalog'
import { Card, Chips, List, Row, Stat, StatGrid } from '../ui/kit'

const ALL = 'All accounts'

/** Every expense of the period added up by category, for all accounts or one account. */
export function ReportTab({
  expenses,
  accounts,
  accountOf,
  onOpen,
}: {
  expenses: HomeEntry[]
  accounts: string[]
  accountOf: (e: HomeEntry) => string
  onOpen: (e: HomeEntry) => void
}) {
  const [acc, setAcc] = useState(ALL)
  const [open, setOpen] = useState<string | null>(null)
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
