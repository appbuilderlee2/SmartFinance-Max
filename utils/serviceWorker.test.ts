import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

function harness(tamper = false) {
  const handlers = new Map<string, (event: any) => void>();
  const stores = new Map<string, Map<string, Response>>();
  stores.set('smartfinance-%2F-old', new Map([['https://example.test/index.html', new Response('old')]]));
  const assets = [{ path: './index.html', body: 'new' }, { path: './assets/app.js', body: 'code' }];
  const manifest = { buildId: 'test-build', assets: assets.map(asset => ({ path: asset.path, sha256: createHash('sha256').update(asset.body).digest('hex') })) };
  const update = vi.fn(async () => undefined);
  const caches = {
    open: async (key: string) => {
      if (!stores.has(key)) stores.set(key, new Map());
      const map = stores.get(key)!;
      return {
        match: async (url: string | Request) => map.get(typeof url === 'string' ? url : url.url)?.clone(),
        put: async (url: string, response: Response) => { map.set(url, response.clone()); },
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (key: string) => stores.delete(key),
  };
  const fetch = vi.fn(async (url: string) => {
    if (url.endsWith('precache-manifest.json')) return Response.json(manifest);
    const asset = assets.find(asset => new URL(asset.path, 'https://example.test/').href === url);
    return new Response(tamper && url.endsWith('app.js') ? 'corrupt' : asset?.body || '', { status: asset ? 200 : 404 });
  });
  runInNewContext(readFileSync('public/service-worker.js', 'utf8').replace('__SF_BUILD_ID__', 'test-build'), {
    self: { registration: { scope: 'https://example.test/', update }, addEventListener: (name: string, callback: (event: any) => void) => handlers.set(name, callback), clients: { claim: async () => undefined } },
    caches, fetch, crypto: webcrypto, URL, Request, Response, Uint8Array,
  });
  const install = () => new Promise<void>((resolve, reject) => handlers.get('install')!({ waitUntil: (promise: Promise<void>) => promise.then(resolve, reject) }));
  return { stores, handlers, install, fetch, update };
}

it('rejects a corrupt release without altering the previous offline release', async () => {
  const app = harness(true);
  await expect(app.install()).rejects.toThrow('Integrity');
  expect([...app.stores.keys()]).toEqual(['smartfinance-%2F-old']);
  expect(await app.stores.get('smartfinance-%2F-old')!.get('https://example.test/index.html')!.text()).toBe('old');
});
it('serves a complete installed shell without background replacement', async () => {
  const app = harness();
  await app.install();
  const previousCalls = app.fetch.mock.calls.length;
  const response = await new Promise<Response>(resolve => app.handlers.get('fetch')!({ request: { method: 'GET', mode: 'navigate', url: 'https://example.test/' }, respondWith: resolve }));
  expect(await response.text()).toBe('new');
  expect(app.fetch).toHaveBeenCalledTimes(previousCalls);
  expect(app.stores.get('smartfinance-%2F-test-build')!.has('https://example.test/__offline_ready__')).toBe(true);
});
