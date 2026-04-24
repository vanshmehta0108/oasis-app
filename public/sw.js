// Bump on every meaningful deploy to force clients off stale caches.
const CACHE_NAME = 'sift-v3-2026-04-24';

// Only cache the shell manifest — do NOT pre-cache route HTML. That locks
// users into an old JS bundle until they manually reload.
const STATIC_ASSETS = ['/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never touch API calls — always hit the network.
  if (url.pathname.startsWith('/api/')) return;

  // Navigation requests (HTML documents) → network-first so new deploys
  // propagate without requiring a reload. Fall back to cache only when
  // offline.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Static assets (hashed JS/CSS/images) → cache-first is safe because
  // the hash changes on each deploy, so filenames are effectively
  // immutable.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && (url.origin === self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      });
    })
  );
});

// Listen for messages from the app (e.g. "skipWaiting" to activate a new SW
// immediately after a deploy).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
