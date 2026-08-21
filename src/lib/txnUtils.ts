import type { Transaction, TxnType } from '../types'

export const fmt = (n: number) => Number(n).toLocaleString('en-US')

const ICONS: [RegExp, string][] = [
  [/food|lunch|dinner|breakfast|snack|kha/i, '🍔'],
  [/rent|house|ghar/i, '🏠'],
  [/transport|fuel|petrol|uber|careem|taxi|rickshaw/i, '🚕'],
  [/shop|cloth|shoe/i, '🛍️'],
  [/phone|mobile|internet|wifi|bill/i, '📱'],
  [/medic|doctor|hospital|dawai/i, '💊'],
  [/book|study|fee|tuition/i, '📚'],
  [/gift/i, '🎁'],
  [/dad|father|walid|allowance|salary|received/i, '💰'],
  [/travel|trip/i, '✈️'],
]

export function iconFor(category: string, type: TxnType): string {
  for (const [re, icon] of ICONS) {
    if (re.test(category)) return icon
  }
  return type === 'in' ? '💵' : '🧾'
}

export function balanceOf(txns: Transaction[]): number {
  return txns.reduce((sum, t) => sum + (t.type === 'in' ? t.amount : -t.amount), 0)
}

export function monthStats(txns: Transaction[]) {
  const now = new Date()
  const inMonth = txns.filter((t) => {
    const d = new Date(t.createdAt)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const inSum = inMonth.filter((t) => t.type === 'in').reduce((s, t) => s + t.amount, 0)
  const outSum = inMonth.filter((t) => t.type === 'out').reduce((s, t) => s + t.amount, 0)
  return { inSum, outSum, net: inSum - outSum }
}

export function dateStr(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })
}

export function fullDateStr(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
