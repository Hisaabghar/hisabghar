import type { HomeEntry } from '../types'
import { rsRaw } from './format'

export interface BudgetRow {
  category: string
  limit: number
  spent: number
  pct: number
  level: 0 | 80 | 100
}

/** Spending against each category's monthly limit, fullest first. */
export function budgetRows(budgets: Record<string, number> | undefined, monthExpenses: HomeEntry[]): BudgetRow[] {
  return Object.entries(budgets ?? {})
    .filter(([, limit]) => limit > 0)
    .map(([category, limit]) => {
      const spent = monthExpenses.filter((e) => e.category === category).reduce((s, e) => s + e.amount, 0)
      const pct = (spent / limit) * 100
      return { category, limit, spent, pct, level: (pct >= 100 ? 100 : pct >= 80 ? 80 : 0) as BudgetRow['level'] }
    })
    .sort((a, b) => b.pct - a.pct)
}

export const budgetMessage = (r: BudgetRow) =>
  r.level === 100
    ? `${r.category}: budget crossed — spent ${rsRaw(r.spent)} of ${rsRaw(r.limit)} this month`
    : `${r.category}: ${Math.round(r.pct)}% of budget used — ${rsRaw(r.limit - r.spent)} left this month`

/** Returns rows that just reached a new level this month (each level is reported once). */
export function newAlerts(rows: BudgetRow[], month: string) {
  const out: BudgetRow[] = []
  for (const r of rows) {
    if (!r.level) continue
    const key = `mk-budget-${month}-${r.category}`
    try {
      const seen = Number(localStorage.getItem(key) ?? 0)
      if (r.level > seen) {
        localStorage.setItem(key, String(r.level))
        out.push(r)
      }
    } catch {
      // ignore
    }
  }
  return out
}
