import type { ReactNode } from 'react'
import type { BizEntry } from '../../types'
import { rs, sum } from '../../lib/format'
import { Card, Hero, HeroStat, List } from '../ui/kit'
import { KIND_ICON, KIND_LABEL } from './bizMeta'

/** All business income in one place: what each line of work earned. */
export function IncomeTab({
  entries,
  expTotal,
  isDay,
  customIcon,
  row,
}: {
  entries: BizEntry[]
  expTotal: number
  isDay: boolean
  customIcon: (name?: string) => string
  row: (e: BizEntry) => ReactNode
}) {
  const groups = new Map<string, { icon: string; label: string; list: BizEntry[] }>()
  for (const e of entries) {
    const key = e.kind === 'custom' ? `c:${e.biz}` : e.kind
    const g = groups.get(key) ?? { icon: e.kind === 'custom' ? customIcon(e.biz) : KIND_ICON[e.kind], label: e.kind === 'custom' ? (e.biz ?? 'Other') : KIND_LABEL[e.kind], list: [] }
    g.list.push(e)
    groups.set(key, g)
  }
  const rows = [...groups.values()]
    .map((g) => ({ ...g, profit: sum(g.list, (e) => e.profit), turnover: sum(g.list, (e) => e.amount), wallet: g.list[0].kind === 'wallet' }))
    .sort((a, b) => b.profit - a.profit)
  const income = sum(entries, (e) => e.profit)
  const sales = sum(
    entries.filter((e) => e.kind !== 'wallet'),
    (e) => e.amount,
  )

  return (
    <>
      <Hero label={isDay ? 'Business income today' : 'Business income this month'} value={income}>
        <HeroStat label="Sales / takings" value={sales} />
        <HeroStat label="Net after shop expenses" value={income - expTotal} />
      </Hero>
      <Card title="Income from each business">
        {rows.length === 0 ? (
          <div className="empty">No income recorded in this period.</div>
        ) : (
          <div className="incomeTable">
            <div className="incomeRow head">
              <span>Business</span>
              <span>Takings</span>
              <span>Income</span>
            </div>
            {rows.map((r) => (
              <div key={r.label} className="incomeRow">
                <span>
                  {r.icon} {r.label}
                  <small>
                    {r.list.length} {r.list.length === 1 ? 'entry' : 'entries'}
                  </small>
                </span>
                <span>
                  {rs(r.turnover)}
                  {r.wallet && <small>sent / withdrawn</small>}
                </span>
                <b>{rs(r.profit)}</b>
              </div>
            ))}
            <div className="incomeRow total">
              <span>Total</span>
              <span>{rs(sales)}</span>
              <b>{rs(income)}</b>
            </div>
          </div>
        )}
        <div className="statHint">Income = your earning (commission, profit on sales). Takings = money customers paid.</div>
      </Card>
      <Card title="All income entries">
        <List empty="No entries in this period">{entries.map(row)}</List>
      </Card>
    </>
  )
}
