// SmartFinance Service Worker (minimal, safe-by-default)
// Goals:
// - Avoid long-lived "stuck on old index.html" after deploy
// - Keep offline support for app shell + icons
// - Keep the implementation simple (no Workbox dependency yet)

// Bump this when you change SW behavior.
const SW_VERSION = 'v3';
const CACHE_PREFIX = 'smartfinance-';
const CACHE_NAME = `${CACHE_PREFIX}${SW_VERSION}`;

const scope = self.registration.scope; // e.g. https://host/app/ or https://host/dist/

// "App shell" assets we want available offline.
const SHELL_URLS = [
  `${scope}index.html`,
  `${scope}manifest.json`,
  `${scope}icon-192.png`,
  `${scope}icon-512.png`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete older smartfinance-* caches.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Helpers
const isNavigate = (req) => req.mode === 'navigate' || req.destination === 'document';
const sameOrigin = (url) => {
  try {
    return new URL(url).origin === self.location.origin;
  } catch {
    return false;
  }
};

// Fetch strategy:
// - For navigations (index.html): network-first, fallback to cached index.html
//   This prevents "stuck on old app" after deploy.
// - For other GET requests on same origin: cache-first (simple offline)
// - For cross-origin or non-GET: passthrough
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Only handle same-origin requests; avoid messing with Firebase/CDNs.
  if (!sameOrigin(req.url)) return;

  if (isNavigate(req)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          // Keep a copy of the latest index.html for offline.
          const cache = await caches.open(CACHE_NAME);
          cache.put(`${scope}index.html`, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(`${scope}index.html`);
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
});
