// utils/pwa.ts

/**
 * Force-refresh PWA caches + unregister service workers, then reload.
 *
 * Use sparingly (Settings "清除快取並重新載入").
 */
export async function forceReloadPwa(): Promise<void> {
  try {
    // Unregister all service workers for this origin.
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister().catch(() => false)));
    }

    // Clear Cache Storage (if supported)
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k).catch(() => false)));
    }

    // Best-effort: clear storage (keep it conservative; DO NOT wipe user data here)
    // We intentionally do NOT clear localStorage/IndexedDB.
  } finally {
    // Hard reload without cache.
    window.location.reload();
  }
}
