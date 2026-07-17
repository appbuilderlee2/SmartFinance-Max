// SmartFinance Service Worker (minimal, safe-by-default)
// Goals:
// - Avoid long-lived "stuck on old index.html" after deploy
// - Keep offline support for app shell + icons
// - Keep the implementation simple (no Workbox dependency yet)

// Bump this when you change SW behavior.
const SW_VERSION = 'v11';
const CACHE_PREFIX = 'smartfinance-';
const CACHE_NAME = `${CACHE_PREFIX}${SW_VERSION}`;

const scope = self.registration.scope; // e.g. https://host/app/ or https://host/dist/

// "App shell" assets we want available offline.
const SHELL_URLS = [
  `${scope}index.html`,
  `${scope}manifest.json`,
  `${scope}icon-192.png`,
  `${scope}icon-512.png`,
  `${scope}precache-manifest.json`,
];

const precacheShell = async () => {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(SHELL_URLS);

  // Vite writes hashed JS/CSS entry assets into the built index. Discover and
  // precache them at install time so the core app can start fully offline after
  // the first successful installation, rather than caching only index.html.
  const indexResponse = await fetch(`${scope}index.html`, { cache: 'no-store' });
  if (!indexResponse.ok) throw new Error(`Unable to precache index: ${indexResponse.status}`);
  const html = await indexResponse.clone().text();
  await cache.put(`${scope}index.html`, indexResponse);
  const assetUrls = [...html.matchAll(/(?:src|href)=["']\.\/([^"']+)["']/g)]
    .map((match) => new URL(match[1], scope).href)
    .filter((url) => url.startsWith(scope));
  await cache.addAll([...new Set(assetUrls)]);

  // The build emits every code-split JS/CSS chunk into this manifest. Fetching
  // them during SW installation keeps lazy routes available offline without
  // putting those chunks back into the initial page download.
  const manifestResponse = await fetch(`${scope}precache-manifest.json`, { cache: 'no-store' });
  if (!manifestResponse.ok) throw new Error(`Unable to precache manifest: ${manifestResponse.status}`);
  const manifestFiles = await manifestResponse.json();
  const lazyAssetUrls = Array.isArray(manifestFiles)
    ? manifestFiles.map((path) => new URL(path, scope).href).filter((url) => url.startsWith(scope))
    : [];
  await cache.addAll([...new Set(lazyAssetUrls)]);
};

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell());
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
  if (event?.data?.type === 'REFRESH_CACHE') {
    event.waitUntil(precacheShell().catch(() => undefined));
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
// - For navigations (index.html): cached shell immediately, refresh in background.
//   This avoids waiting for a network timeout when the device is offline.
// - For other GET requests on same origin: cache-first (simple offline)
// - For cross-origin or non-GET: passthrough
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Only handle same-origin requests; avoid messing with Firebase/CDNs.
  if (!sameOrigin(req.url)) return;

  if (isNavigate(req)) {
    const refresh = async () => {
      const fresh = await fetch(req, { cache: 'no-store' });
      if (!fresh.ok) throw new Error(`Navigation refresh failed: ${fresh.status}`);
      const cache = await caches.open(CACHE_NAME);
      await cache.put(`${scope}index.html`, fresh.clone());
      return fresh;
    };
    const refreshPromise = refresh();

    // Register background work while the fetch event is still active. Calling
    // waitUntil after an awaited operation can make browsers reject the event.
    event.waitUntil(refreshPromise.then(() => undefined).catch(() => undefined));
    event.respondWith(
      (async () => {
        const cached = await caches.match(`${scope}index.html`);
        if (cached) {
          return cached;
        }

        try {
          return await refreshPromise;
        } catch {
          return Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
});
