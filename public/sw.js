// Mera Khata offline cache: app shell + assets + Firebase config.
const CACHE = 'mk-v1'
const SHELL = ['/', '/index.html', '/manifest.json', '/favicon.svg', '/__/firebase/init.json']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
  self.clients.claim()
})

async function networkFirst(req, key) {
  const c = await caches.open(CACHE)
  try {
    const res = await fetch(req)
    if (res.ok) c.put(key ?? req, res.clone())
    return res
  } catch {
    return (await c.match(key ?? req)) ?? (await c.match('/index.html')) ?? Response.error()
  }
}

async function cacheFirst(req) {
  const c = await caches.open(CACHE)
  const hit = await c.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok || res.type === 'opaque') c.put(req, res.clone())
  return res
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') return e.respondWith(networkFirst(req, '/index.html'))
    if (url.pathname === '/__/firebase/init.json') return e.respondWith(networkFirst(req))
    if (url.pathname.startsWith('/__/') || url.pathname.startsWith('/__mk/')) return
    return e.respondWith(url.pathname.startsWith('/assets/') ? cacheFirst(req) : networkFirst(req))
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') e.respondWith(cacheFirst(req))
})

// Bill reminders in the background (installed app on Chrome/Android only).
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'mk-bills') e.waitUntil(remindBills())
})

async function remindBills() {
  const c = await caches.open(CACHE)
  const res = await c.match('/__mk/bills.json')
  if (!res) return
  const bills = await res.json()
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const mk = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  for (const b of bills) {
    let m = now.getMonth()
    if ((b.paid || []).includes(mk(new Date(now.getFullYear(), m, 1)))) m += 1
    const last = new Date(now.getFullYear(), m + 1, 0).getDate()
    const due = new Date(now.getFullYear(), m, Math.min(b.day, last))
    const left = Math.round((due - start) / 86400000)
    if (left > b.remindDays) continue
    const when = left < 0 ? `${-left} days late` : left === 0 ? 'due today' : left === 1 ? 'due tomorrow' : `due in ${left} days`
    await self.registration.showNotification('Mera Khata · Bill reminder', {
      body: `${b.name} — Rs ${Math.round(b.amount).toLocaleString('en-PK')} ${when}`,
      icon: '/icons/icon-192.png',
      tag: `mk-${b.id}-${mk(due)}`,
    })
  }
}

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((list) => (list[0] ? list[0].focus() : self.clients.openWindow('/'))),
  )
})
