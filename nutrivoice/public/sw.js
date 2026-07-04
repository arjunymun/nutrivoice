/* NutriVoice service worker — cache-first so the installed PWA launches and
 * works with no network. Food DB + parser ship inside the JS bundle; logs live
 * in localStorage; sync catches up when back online. */
const CACHE = 'nutrivoice-v1';
const PRECACHE = ['/', '/manifest.json', '/pwa-192.png', '/pwa-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // App navigation: try network (fresh deploys), fall back to cache, then shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/'))),
    );
    return;
  }

  // Static assets (hashed bundles): cache-first, populate on first fetch.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        }),
    ),
  );
});
