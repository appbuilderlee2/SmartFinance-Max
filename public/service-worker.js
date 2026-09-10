// The build replaces this ID with a digest of the emitted bundle.
const BUILD_ID = '__SF_BUILD_ID__';
const scope = self.registration.scope;
const CACHE_PREFIX = `smartfinance-${encodeURIComponent(new URL(scope).pathname)}-`;
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_ID}`;
const READY_URL = `${scope}__offline_ready__`;

async function precacheRelease() {
  const cache = await caches.open(CACHE_NAME);
  if (await cache.match(READY_URL)) return;
  try {
    const manifestResponse = await fetch(`${scope}precache-manifest.json`, { cache: 'no-store' });
    if (!manifestResponse.ok) throw new Error('Unable to load release manifest');
    const manifest = await manifestResponse.clone().json();
    if (manifest.buildId !== BUILD_ID || !Array.isArray(manifest.assets) || !manifest.assets.length) throw new Error('Release changed during download');
    await Promise.all(manifest.assets.map(async asset => {
      if (typeof asset.path !== 'string' || !/^[a-f0-9]{64}$/.test(asset.sha256)) throw new Error('Invalid asset');
      const url = new URL(asset.path, scope).href;
      if (!url.startsWith(scope)) throw new Error('Invalid asset scope');
      const response = await fetch(url, { cache: 'reload' });
      if (!response.ok) throw new Error(`Download failed: ${asset.path}`);
      const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
      const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      if (actual !== asset.sha256) throw new Error(`Integrity check failed: ${asset.path}`);
      await cache.put(url, response);
    }));
    await cache.put(`${scope}precache-manifest.json`, manifestResponse);
    await cache.put(READY_URL, new Response(BUILD_ID));
  } catch (error) {
    await caches.delete(CACHE_NAME);
    throw error;
  }
}
self.addEventListener('install', event => event.waitUntil(precacheRelease()));
self.addEventListener('activate', event => {
  // Keep previous releases for tabs still running their code. Never purge other apps.
  event.waitUntil(self.clients.claim());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
  if (event.data?.type === 'REFRESH_CACHE') event.waitUntil(self.registration.update());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(scope)) return;
  const navigation = req.mode === 'navigate' || req.destination === 'document';
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(navigation ? `${scope}index.html` : req, { ignoreVary: true });
    if (cached) return cached;
    // Previous tabs may request a hashed lazy chunk from their own release.
    if (!navigation && new URL(req.url).pathname.includes('/assets/')) {
      const keys = (await caches.keys()).filter(key => key.startsWith(CACHE_PREFIX));
      for (const key of keys) {
        const previous = await (await caches.open(key)).match(req, { ignoreVary: true });
        if (previous) return previous;
      }
    }
    return fetch(req);
  })());
});
