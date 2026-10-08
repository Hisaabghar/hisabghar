import type { Period } from '../types'

/** Rupees, always visible — for numbers the user is typing into a form. */
export const rsRaw = (n: number) => 'Rs ' + Math.round(n).toLocaleString('en-PK')

// Privacy mode: when on, every displayed amount is masked. The app shell sets
// this during render, so all children format with the current value.
let amountsHidden = false
export const setAmountsHidden = (v: boolean) => {
  amountsHidden = v
}

export const rs = (n: number) => (amountsHidden ? 'Rs ••••' : rsRaw(n))

const pad = (n: number) => String(n).padStart(2, '0')
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => toISO(new Date())
const fromISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function periodRange(p: Period): [string, string] {
  if (p.mode === 'day') return [p.date, p.date]
  const d = fromISO(p.date)
  return [toISO(new Date(d.getFullYear(), d.getMonth(), 1)), toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0))]
}

export function monthRange(date: string): [string, string] {
  return periodRange({ mode: 'month', date })
}

export function shiftPeriod(p: Period, step: number): Period {
  const d = fromISO(p.date)
  if (p.mode === 'day') d.setDate(d.getDate() + step)
  else d.setMonth(d.getMonth() + step, 1)
  return { ...p, date: toISO(d) }
}

export function periodLabel(p: Period): string {
  const d = fromISO(p.date)
  if (p.mode === 'month') return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
  if (p.date === today()) return 'Today'
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export const shortDate = (s: string) => {
  const d = fromISO(s)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export const inRange = (date: string, [from, to]: [string, string]) => date >= from && date <= to

export const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0)

export function groupSum<T>(xs: T[], key: (x: T) => string, val: (x: T) => number) {
  const m = new Map<string, number>()
  for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + val(x))
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Every date (YYYY-MM-DD) from `from` to `to`, inclusive. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = []
  const d = fromISO(from)
  const end = fromISO(to)
  while (d <= end) {
    out.push(toISO(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

export function addDays(date: string, n: number): string {
  const d = fromISO(date)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** Daily totals for a chart: one bar per day in [from, to]. */
export function dailySeries<T extends { date: string }>(xs: T[], from: string, to: string, val: (x: T) => number) {
  const m = new Map<string, number>()
  for (const x of xs) m.set(x.date, (m.get(x.date) ?? 0) + val(x))
  return daysBetween(from, to).map((date) => ({
    label: String(Number(date.slice(8))),
    tip: shortDate(date),
    value: m.get(date) ?? 0,
  }))
}
