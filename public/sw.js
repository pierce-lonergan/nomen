/*
 * Nomen's service worker.
 *
 * Two jobs, and a hard limit on both.
 *
 *  1. **Offline shell.** The app already makes no network calls at runtime; it simply could not be
 *     *loaded* without one. Precaching the shell closes that gap, which matters because Capture is
 *     designed to run in the twenty seconds after a handshake — frequently in a basement, a train,
 *     or a venue with hostile wifi.
 *
 *  2. **Local notifications.** No push service, no VAPID keys, no server. Every notification this
 *     app can show originates from a message the page itself sent while it was open. There is no
 *     mechanism by which anyone else could deliver one, which is the property that lets a local-
 *     first app have reminders at all without acquiring a backend.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: cache anything containing a person's data. The database is
 * IndexedDB and stays there. The cache holds the program — HTML, JS, CSS — and nothing else.
 */

const VERSION = 'nomen-v2'
const SHELL = 'nomen-shell-' + VERSION

/**
 * Discover the hashed asset URLs by reading the entry document.
 *
 * Vite hashes every filename, so a hand-written precache list would go stale on the next build.
 * Parsing index.html is the only way to know what the shell actually consists of without a build
 * plugin generating a manifest.
 *
 * This has to happen at INSTALL, not lazily on fetch. On a first visit the page requests its JS
 * and CSS before the worker controls the page, so those requests never pass through the fetch
 * handler and never get cached — which produced a shell that served its HTML offline and then
 * rendered a blank page, because the bundle behind it was missing.
 */
async function precacheShell(cache) {
  await cache.addAll(['./', './index.html', './manifest.webmanifest'])
  const html = await (await fetch('./index.html', { cache: 'reload' })).text()
  const urls = new Set()
  const attr = /(?:src|href)="([^"]+)"/g
  let m
  while ((m = attr.exec(html))) {
    const href = m[1]
    // Same-origin build output only. Never a data: URI, never another origin.
    if (/^(https?:)?\/\//.test(href) || href.startsWith('data:')) continue
    if (/\.(js|css|png|svg|webmanifest)$/.test(href)) urls.add(new URL(href, self.location.href).href)
  }
  // One failed asset must not fail the whole install and leave the user with no worker at all.
  await Promise.all([...urls].map((u) => cache.add(u).catch(() => {})))
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then(precacheShell)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

/**
 * Stale-while-revalidate for same-origin GETs.
 *
 * Network-first would make every launch wait on a request the app does not need; cache-first alone
 * would pin a stale build until the cache was manually cleared. This serves instantly and updates
 * behind the scenes, which is the right trade for a shell that changes only on deploy.
 */
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    // `ignoreVary` is load-bearing, not a shortcut.
    //
    // Vite emits its module script with `crossorigin`, so the browser requests it in CORS mode
    // and sends an `Origin` header; the worker's own `cache.add()` sends none. Servers commonly
    // answer with `Vary: Origin`, and Cache.match honours Vary by default — so the two requests
    // did not match, the lookup missed, and the app served its HTML offline and then died with
    // ERR_FAILED on the bundle behind it. Every entry in this cache is same-origin build output
    // where Origin cannot meaningfully change the bytes.
    caches.match(req, { ignoreVary: true }).then((hit) => {
      const fresh = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(SHELL).then((c) => c.put(req, copy))
          }
          return res
        })
        // Offline with nothing cached: hand back a real error response rather than `undefined`,
        // which respondWith turns into an opaque network failure with no diagnosis.
        .catch(() => hit || new Response('', { status: 504, statusText: 'Offline' }))
      return hit || fresh
    }),
  )
})

/**
 * Show a notification the page asked for.
 *
 * `requireInteraction` is deliberately false and there is no sound: this is a nudge toward a
 * five-minute review, not an alarm. The charter forbids manufactured urgency, and a notification
 * that will not go away until acknowledged is exactly that.
 */
self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'nomen:notify') return
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag || 'nomen-review',
      renotify: false,
      requireInteraction: false,
      silent: true,
      data: { url: data.url || './' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || './'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})
