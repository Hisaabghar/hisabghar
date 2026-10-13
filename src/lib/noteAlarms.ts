import type { Note, Repeat } from '../types'

const CACHE = 'mk-v1'
const NOTES_URL = '/__mk/notes.json'

/** Next alarm time after `now` for a repeating note. */
export function nextTime(at: number, repeat: Repeat | undefined, now = Date.now()) {
  if (!repeat || repeat === 'none') return at
  const d = new Date(at)
  while (d.getTime() <= now) {
    if (repeat === 'daily') d.setDate(d.getDate() + 1)
    else if (repeat === 'weekly') d.setDate(d.getDate() + 7)
    else d.setMonth(d.getMonth() + 1)
  }
  return d.getTime()
}

export async function askNotifyPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

export async function showNote(n: Note) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const title = `⏰ ${n.title || 'Reminder'}`
  const body = n.text.slice(0, 140) || 'Mera Khata note'
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, { body, icon: '/icons/icon-192.png', tag: `note-${n.id}-${n.remindAt}`, requireInteraction: true } as NotificationOptions)
    else new Notification(title, { body, icon: '/icons/icon-192.png' })
  } catch {
    // ignore
  }
}

/** Gives the service worker a copy of upcoming alarms for background checks. */
export async function cacheAlarms(notes: Note[]) {
  try {
    const list = notes.filter((n) => n.remindAt && !n.notified).map((n) => ({ id: n.id, title: n.title, text: n.text.slice(0, 140), at: n.remindAt }))
    const c = await caches.open(CACHE)
    await c.put(NOTES_URL, new Response(JSON.stringify(list), { headers: { 'content-type': 'application/json' } }))
  } catch {
    // ignore
  }
}

/** Google Calendar link: the phone's calendar app then rings at the right time even when Mera Khata is closed. */
export function calendarLink(n: { title: string; text: string; remindAt: number; repeat?: Repeat }) {
  const f = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: n.title || 'Reminder',
    details: n.text,
    dates: `${f(n.remindAt)}/${f(n.remindAt + 15 * 60000)}`,
  })
  if (n.repeat && n.repeat !== 'none') p.set('recur', `RRULE:FREQ=${n.repeat.toUpperCase()}`)
  return `https://calendar.google.com/calendar/render?${p}`
}

export const nowMs = () => Date.now()
