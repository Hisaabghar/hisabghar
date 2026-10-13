import { isNative } from './saveFile'

/** Stable positive 31-bit id from a string (Android notification ids are ints). */
export function idOf(s: string) {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) % 2147483000
}

/** Shows a notification right now (Android app or browser). */
export async function notifyNow(title: string, body: string, tag: string) {
  try {
    if (isNative()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.schedule({ notifications: [{ id: idOf(tag), title, body, schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true } }] })
      return
    }
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, { body, icon: '/icons/icon-192.png', tag })
    else new Notification(title, { body, icon: '/icons/icon-192.png' })
  } catch {
    // ignore
  }
}
