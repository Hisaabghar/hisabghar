import type { Bill } from '../types'
import { rsRaw, toISO } from './format'

const NOTIFY_KEY = 'mk-bill-notify'
const CACHE = 'mk-v1'
const BILLS_URL = '/__mk/bills.json'

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/** The next unpaid due date of a bill and how many days are left (negative = late). */
export function billStatus(b: Bill, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const y = now.getFullYear()
  let m = now.getMonth()
  if ((b.paid ?? []).includes(monthKey(new Date(y, m, 1)))) m += 1
  const last = new Date(y, m + 1, 0).getDate()
  const due = new Date(y, m, Math.min(b.day, last))
  const daysLeft = Math.round((due.getTime() - start.getTime()) / 86400000)
  return { due: toISO(due), month: monthKey(due), daysLeft, remind: daysLeft <= b.remindDays }
}

export function dueText(daysLeft: number) {
  if (daysLeft < 0) return `${-daysLeft} day${daysLeft === -1 ? '' : 's'} late`
  if (daysLeft === 0) return 'due today'
  if (daysLeft === 1) return 'due tomorrow'
  return `due in ${daysLeft} days`
}

/** Bills that need attention now, soonest first. */
export function billsDue(bills: Bill[], now = new Date()) {
  return bills
    .map((b) => ({ bill: b, ...billStatus(b, now) }))
    .filter((x) => x.remind)
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

export function notifyOn() {
  try {
    return localStorage.getItem(NOTIFY_KEY) === '1'
  } catch {
    return false
  }
}

export async function setNotify(on: boolean): Promise<boolean> {
  if (on) {
    if (!('Notification' in window)) return false
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (perm !== 'granted') return false
  }
  try {
    localStorage.setItem(NOTIFY_KEY, on ? '1' : '0')
  } catch {
    // ignore
  }
  if (on) await registerPeriodic()
  return true
}

async function registerPeriodic() {
  try {
    const reg = await navigator.serviceWorker?.ready
    const ps = (reg as ServiceWorkerRegistration & { periodicSync?: { register: (t: string, o: object) => Promise<void> } })?.periodicSync
    await ps?.register('mk-bills', { minInterval: 12 * 60 * 60 * 1000 })
  } catch {
    // Not supported on this browser; reminders show when the app is opened.
  }
}

/** Keeps a copy of the bills for the service worker and shows today's reminders once. */
export async function checkBills(bills: Bill[]) {
  try {
    const c = await caches.open(CACHE)
    await c.put(BILLS_URL, new Response(JSON.stringify(bills), { headers: { 'content-type': 'application/json' } }))
  } catch {
    // ignore
  }
  if (!notifyOn() || !('Notification' in window) || Notification.permission !== 'granted') return
  const day = toISO(new Date())
  for (const x of billsDue(bills)) {
    const key = `mk-notified-${x.bill.id}-${x.month}-${day}`
    try {
      if (localStorage.getItem(key)) continue
      localStorage.setItem(key, '1')
    } catch {
      continue
    }
    const body = `${x.bill.name} — ${rsRaw(x.bill.amount)} ${dueText(x.daysLeft)}`
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      if (reg) await reg.showNotification('Mera Khata · Bill reminder', { body, icon: '/icons/icon-192.png', tag: key })
      else new Notification('Mera Khata · Bill reminder', { body, icon: '/icons/icon-192.png' })
    } catch {
      // ignore
    }
  }
}
