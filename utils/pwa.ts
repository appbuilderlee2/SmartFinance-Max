import { flushStorage } from './storage';

export async function forceReloadPwa(): Promise<void> {
  await flushStorage();
  if (!navigator.onLine) { alert('請連接網絡後再修復快取，避免失去離線啟動能力。'); return; }
  const scope = new URL('.', window.location.href).href;
  // Verify the shell is reachable before discarding the installed copy.
  const response = await fetch(new URL('index.html', scope), { cache: 'no-store' });
  if (!response.ok) throw new Error('無法下載 App，已保留原有快取');
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter(registration => registration.scope === scope).map(registration => registration.unregister()));
  }
  if ('caches' in window) {
    const prefix = `smartfinance-${encodeURIComponent(new URL(scope).pathname)}-`;
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(prefix)).map(key => caches.delete(key)));
  }
  window.location.reload();
}
