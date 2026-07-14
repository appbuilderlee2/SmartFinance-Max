// utils/storage.ts
// Synchronous cache facade backed by IndexedDB after app hydration.

import {
  clearDatabaseData,
  collectLegacySnapshot,
  KeyValueSnapshot,
  migrateLegacyStorage,
  openSmartFinanceDatabase,
  readDatabaseSnapshot,
  removeDatabaseValue,
  replaceDatabaseSnapshot,
  isAppDataKey,
  writeDatabaseValue,
} from './indexedDb';

export type ParseResult<T> = {
  ok: true;
  value: T;
} | {
  ok: false;
  error: unknown;
};

export const STORAGE_ERROR_EVENT = 'sf-storage-error';

export type StorageBackend = 'indexeddb' | 'localstorage';

export type StorageInitialization = {
  backend: StorageBackend;
  migrated: boolean;
  importedKeys: number;
  storedKeys: number;
};

let cache = new Map<string, string>();
let database: IDBDatabase | null = null;
let backend: StorageBackend = 'localstorage';
let initialized = false;
let initializationPromise: Promise<StorageInitialization> | null = null;

const THEME_KEY = 'smartfinance_themecolor';

function replaceCache(snapshot: KeyValueSnapshot): void {
  cache = new Map(Object.entries(snapshot));
}

function clearLegacyAppStorage(): void {
  const keys = Object.keys(collectLegacySnapshot(localStorage));
  keys.forEach(key => localStorage.removeItem(key));
}

export function initializeStorage(): Promise<StorageInitialization> {
  if (initializationPromise) return initializationPromise;
  initializationPromise = (async () => {
    try {
      database = await openSmartFinanceDatabase();
      const migration = await migrateLegacyStorage(database, localStorage);
      const snapshot = await readDatabaseSnapshot(database);
      replaceCache(snapshot);
      backend = 'indexeddb';
      initialized = true;
      return {
        backend,
        migrated: migration.migrated,
        importedKeys: migration.importedKeys,
        storedKeys: Object.keys(snapshot).length,
      };
    } catch (error) {
      database?.close();
      database = null;
      const snapshot = collectLegacySnapshot(localStorage);
      replaceCache(snapshot);
      backend = 'localstorage';
      initialized = true;
      reportStorageError('indexeddb', error);
      return { backend, migrated: false, importedKeys: 0, storedKeys: Object.keys(snapshot).length };
    }
  })();
  return initializationPromise;
}

export function reportStorageError(key: string, error: unknown): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, {
    detail: { key, message: error instanceof Error ? error.message : 'Storage write failed' },
  }));
}

export function safeJsonParse<T>(raw: string): ParseResult<T> {
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch (error) {
    return { ok: false, error };
  }
}

export function readJson<T>(key: string): T | null {
  try {
    const raw = initialized ? cache.get(key) ?? null : localStorage.getItem(key);
    if (!raw) return null;
    const parsed = safeJsonParse<T>(raw);
    return parsed.ok ? parsed.value : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    return writeText(key, JSON.stringify(value));
  } catch (error) {
    reportStorageError(key, error);
    return false;
  }
}

export function writeText(key: string, value: string): boolean {
  try {
    if (!initialized) {
      localStorage.setItem(key, value);
      return true;
    }
    cache.set(key, value);
    if (key === THEME_KEY) localStorage.setItem(key, value);
    if (backend === 'indexeddb' && database) {
      void writeDatabaseValue(database, key, value).catch(error => reportStorageError(key, error));
    } else {
      localStorage.setItem(key, value);
    }
    return true;
  } catch (error) {
    reportStorageError(key, error);
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    if (!initialized) {
      localStorage.removeItem(key);
      return;
    }
    cache.delete(key);
    if (key === THEME_KEY) localStorage.removeItem(key);
    if (backend === 'indexeddb' && database) {
      void removeDatabaseValue(database, key).catch(error => reportStorageError(key, error));
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

export function readText(key: string): string | null {
  try {
    return initialized ? cache.get(key) ?? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getStorageSnapshot(): KeyValueSnapshot {
  if (initialized) return Object.fromEntries(cache);
  return collectLegacySnapshot(localStorage);
}

export async function replaceStorageSnapshot(snapshot: KeyValueSnapshot): Promise<void> {
  const filtered = Object.fromEntries(
    Object.entries(snapshot).filter((entry): entry is [string, string] => isAppDataKey(entry[0]) && typeof entry[1] === 'string'),
  );
  if (backend === 'indexeddb' && database) {
    await replaceDatabaseSnapshot(database, filtered);
  } else {
    clearLegacyAppStorage();
    Object.entries(filtered).forEach(([key, value]) => localStorage.setItem(key, value));
  }
  replaceCache(filtered);
  const theme = filtered[THEME_KEY];
  if (theme) localStorage.setItem(THEME_KEY, theme);
}

export async function clearStorageData(): Promise<void> {
  if (backend === 'indexeddb' && database) await clearDatabaseData(database);
  clearLegacyAppStorage();
  cache.clear();
}

export function getStorageBackend(): StorageBackend {
  return backend;
}
