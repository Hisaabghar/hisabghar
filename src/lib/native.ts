import type { Bill, Note } from '../types'
import { isNative } from './saveFile'
import { idOf } from './notify'
import { billStatus, dueText } from './bills'
import { rsRaw } from './format'

export const APK_URL = 'https://github.com/Hisaabghar/hisabghar/releases/download/android-latest/mera-khata.apk'

type Pending = { id: number; title: string; body: string; at?: Date; on?: { day?: number; weekday?: number; hour: number; minute: number } }

/** Replaces this group's scheduled phone alarms (Android app only). They ring even when the app is closed. */
async function replaceGroup(group: string, list: Pending[]) {
  if (!isNative()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const key = `mk-native-${group}`
    let old: number[] = []
    try {
      old = JSON.parse(localStorage.getItem(key) ?? '[]')
    } catch {
      // ignore
    }
    if (old.length) await LocalNotifications.cancel({ notifications: old.map((id) => ({ id })) })
    if (list.length) {
      let perm = await LocalNotifications.checkPermissions()
      if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') perm = await LocalNotifications.requestPermissions()
      if (perm.display !== 'granted') return
      await LocalNotifications.schedule({
        notifications: list.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          largeBody: n.body,
          schedule: n.on ? { on: n.on, allowWhileIdle: true } : { at: n.at, allowWhileIdle: true },
        })),
      })
    }
    localStorage.setItem(key, JSON.stringify(list.map((n) => n.id)))
  } catch {
    // Plugin missing (old app version) — in-app alarms still work.
  }
}

export function scheduleNoteAlarms(notes: Note[]) {
  const now = Date.now()
  const list: Pending[] = []
  for (const n of notes) {
    if (!n.remindAt || n.notified) continue
    const d = new Date(n.remindAt)
    const base = { id: idOf(`note-${n.id}`), title: `⏰ ${n.title || 'Reminder'}`, body: n.text.slice(0, 200) || 'Mera Khata note' }
    const hm = { hour: d.getHours(), minute: d.getMinutes() }
    if (n.repeat === 'daily') list.push({ ...base, on: hm })
    else if (n.repeat === 'weekly') list.push({ ...base, on: { ...hm, weekday: d.getDay() + 1 } })
    else if (n.repeat === 'monthly') list.push({ ...base, on: { ...hm, day: d.getDate() } })
    else if (n.remindAt > now) list.push({ ...base, at: d })
  }
  return replaceGroup('notes', list)
}

export function scheduleBillAlarms(bills: Bill[]) {
  const now = new Date()
  const list: Pending[] = []
  for (const b of bills) {
    // This (unpaid) bill and the next two months, reminded at 9 AM.
    for (let k = 0; k < 3; k++) {
      const from = new Date(now.getFullYear(), now.getMonth() + k, k ? 1 : now.getDate())
      const s = billStatus({ ...b, paid: k ? [] : b.paid }, from)
      const due = new Date(s.due + 'T09:00:00')
      const remind = new Date(due)
      remind.setDate(remind.getDate() - b.remindDays)
      for (const [when, left] of [
        [remind, b.remindDays],
        [due, 0],
      ] as const) {
        if (when.getTime() <= now.getTime()) continue
        list.push({
          id: idOf(`bill-${b.id}-${s.month}-${left}`),
          title: '🔔 Bill reminder',
          body: `${b.name} — ${rsRaw(b.amount)} ${dueText(left)}`,
          at: when,
        })
      }
    }
  }
  return replaceGroup('bills', [...new Map(list.map((x) => [x.id, x])).values()])
}

/** Android 12+: alarms ring on the minute only with "Alarms & reminders" allowed. */
export async function exactAlarmStatus(): Promise<'granted' | 'denied' | 'na'> {
  if (!isNative()) return 'na'
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const r = await LocalNotifications.checkExactNotificationSetting()
    return r.exact_alarm === 'granted' ? 'granted' : 'denied'
  } catch {
    return 'na'
  }
}

export async function openExactAlarmSetting() {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  await LocalNotifications.changeExactNotificationSetting()
}
