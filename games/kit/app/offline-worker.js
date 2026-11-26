// The site's service worker, written to dist-games/sw.js by ./offline-build.js with VERSION and FILES in front of it.
// Installing caches every built file, so the hub and every game open without a network once the site has been opened
// online. Hashed assets never change and come from the cache; pages, content and language files are fetched first and
// fall back to the cache, so an online player still reads the latest publication (./release.js sees it as before).
/* global VERSION, FILES */
const CACHE = `games-${VERSION}`
const scope = self.registration.scope
// The address without its query: ?level and ?_refresh name the same file.
const key = (url) => url.origin + url.pathname
const immutable = (url) => url.pathname.includes('/assets/')

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE)
    .then((cache) => cache.addAll(FILES.map((file) => new Request(new URL(file, scope), { cache: 'reload' }))))
    .then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((names) => Promise.all(names.filter((name) => name.startsWith('games-') && name !== CACHE).map((name) => caches.delete(name))))
    .then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || !url.href.startsWith(scope)) return
  event.respondWith(immutable(url) ? cached(event, url) : fresh(event, url))
})

async function cached(event, url) {
  return (await caches.match(key(url))) ?? fresh(event, url)
}

async function fresh(event, url) {
  try {
    const response = await fetch(event.request)
    // A redirect (a folder without its slash) cannot answer a page load from the cache.
    if (response.status === 200 && !response.redirected) {
      const copy = response.clone()
      event.waitUntil(caches.open(CACHE).then((cache) => cache.put(key(url), copy)))
    }
    return response
  } catch (error) {
    const hit = await caches.match(key(url))
    if (hit) return hit
    throw error
  }
}
