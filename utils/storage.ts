import { Transaction } from '../types';
// utils/storage.ts
// Synchronous cache facade backed by IndexedDB after app hydration.

import {
  clearDatabaseData,
  migrateTransactionRows, writeDatabaseBatch, TRANSACTIONS_KEY,
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
const CROSS_TAB_KEY = 'smartfinance-tab-update';
const tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let channel: BroadcastChannel | null = null;
let staleTab = false;
let crossTabStarted = false;
const staleListeners = new Set<() => void>();
export const getStaleTab = () => staleTab;
export const subscribeStaleTab = (listener: () => void) => { staleListeners.add(listener); return () => { staleListeners.delete(listener); }; };
function markStale(source: unknown) {
  if (source === tabId || staleTab) return;
  staleTab = true;
  staleListeners.forEach(listener => listener());
  reportStorageError('other-tab', new Error('另一分頁已更新資料，請重新載入此分頁'));
}
function startCrossTabMonitor() {
  if (crossTabStarted || typeof window === 'undefined') return;
  crossTabStarted = true;
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CROSS_TAB_KEY);
    channel.onmessage = event => markStale(event.data?.source);
  }
  window.addEventListener('storage', event => {
    if (event.key !== CROSS_TAB_KEY || !event.newValue) return;
    try { markStale(JSON.parse(event.newValue).source); } catch { /* ignore invalid marker */ }
  });
}
function publishChange() {
  if (staleTab) return;
  const notice = { source: tabId, time: Date.now() };
  channel?.postMessage(notice);
  try { localStorage.setItem(CROSS_TAB_KEY, JSON.stringify(notice)); } catch { /* BroadcastChannel still works */ }
}

export type StorageBackend = 'indexeddb' | 'localstorage';

export type StorageInitialization = {
  backend: StorageBackend;
  migrated: boolean;
  importedKeys: number;
  storedKeys: number;
};

export type SaveStatus = 'saved' | 'saving' | 'error';
let saveStatus: SaveStatus = 'saved';
const listeners = new Set<() => void>();
export const subscribeStorage = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getSaveStatus = () => saveStatus;
function setStatus(status: SaveStatus) { saveStatus = status; listeners.forEach(listener => listener()); }
type Job = { run: () => Promise<void>; resolve: (success: boolean) => void };
const pending: Job[] = [];
let running = false;
async function drain(): Promise<void> {
  if (running) return;
  running = true;
  setStatus('saving');
  while (pending.length) {
    if (staleTab) { running = false; setStatus('error'); return; }
    const job = pending[0];
    try { await job.run(); pending.shift(); job.resolve(true); }
    catch (error) {
      running = false; job.resolve(false); setStatus('error'); reportStorageError('write', error); return;
    }
  }
  running = false; setStatus('saved');
}
function enqueue(run: () => Promise<void>): Promise<boolean> {
  if (staleTab) { reportStorageError('other-tab', new Error('另一分頁已更新資料')); return Promise.resolve(false); }
  const result = new Promise<boolean>(resolve => pending.push({ run, resolve }));
  if (saveStatus !== 'error') void drain();
  return result;
}
export async function retryStorage(): Promise<void> {
  if (staleTab) throw new Error('另一分頁已更新資料，請重新載入');
  await drain();
}
export function flushStorage(): Promise<void> {
  if (staleTab) return Promise.reject(new Error('另一分頁已更新資料，請重新載入'));
  if (!pending.length) return Promise.resolve();
  if (saveStatus === 'error') return Promise.reject(new Error('資料未能儲存，請先重試或匯出備份'));
  return new Promise((resolve, reject) => {
    const unsubscribe = subscribeStorage(() => {
      if (saveStatus === 'saving') return;
      unsubscribe();
      if (saveStatus === 'error') reject(new Error('資料未能儲存')); else resolve();
    });
  });
}
let transactionRows: Transaction[] = [];
let durableRows = new Map<string, Transaction>();
let cache = new Map<string, string>();
let database: IDBDatabase | null = null;
let backend: StorageBackend = 'localstorage';
let initialized = false;
let initializationPromise: Promise<StorageInitialization> | null = null;

const THEME_KEY = 'smartfinance_themecolor';

export async function reconcileThemeMirror(
  targetDatabase: IDBDatabase,
  storage: Pick<Storage, 'getItem'>,
  snapshot: KeyValueSnapshot,
): Promise<KeyValueSnapshot> {
  const mirroredTheme = storage.getItem(THEME_KEY);
  if (!mirroredTheme || snapshot[THEME_KEY] === mirroredTheme) return snapshot;
  await writeDatabaseValue(targetDatabase, THEME_KEY, mirroredTheme);
  return { ...snapshot, [THEME_KEY]: mirroredTheme };
}

function replaceCache(snapshot: KeyValueSnapshot): void {
  transactionRows = JSON.parse(snapshot[TRANSACTIONS_KEY] || '[]');
  durableRows = new Map(transactionRows.map(row => [row.id, row]));
  cache = new Map(Object.entries(snapshot).filter(([key]) => key !== TRANSACTIONS_KEY));
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
      await migrateTransactionRows(database);
      const snapshot = await reconcileThemeMirror(
        database,
        localStorage,
        await readDatabaseSnapshot(database),
      );
      replaceCache(snapshot);
      // Reconcile mirrors written by older app versions before hydration.
      // Theme is synchronously mirrored before yielding, so reload cannot
      // reconcile a stale mirror over a newly committed setting.
      localStorage.setItem('sf_indexeddb_authoritative', 'true');
      backend = 'indexeddb';
      initialized = true;
      startCrossTabMonitor();
      return {
        backend,
        migrated: migration.migrated,
        importedKeys: migration.importedKeys,
        storedKeys: Object.keys(snapshot).length,
      };
    } catch (error) {
      database?.close();
      database = null;
      if (typeof indexedDB !== 'undefined' || localStorage.getItem('sf_indexeddb_authoritative')) throw new Error('本機資料庫暫時無法開啟，請關閉其他分頁後重試。為保護資料，不會載入過期副本。');
      const snapshot = collectLegacySnapshot(localStorage);
      replaceCache(snapshot);
      backend = 'localstorage';
      initialized = true;
      startCrossTabMonitor();
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
    if (initialized && key === TRANSACTIONS_KEY) return transactionRows as T;
    const raw = initialized ? cache.get(key) ?? null : localStorage.getItem(key);
    if (!raw) return null;
    const parsed = safeJsonParse<T>(raw);
    return parsed.ok ? parsed.value : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): Promise<boolean> {
  try { return writeText(key, JSON.stringify(value)); }
  catch (error) { reportStorageError(key, error); return Promise.resolve(false); }
}

export function writeText(key: string, value: string): Promise<boolean> {
  if (key === TRANSACTIONS_KEY) return writeCoreData(JSON.parse(value), {});
  if (cache.get(key) === value) return Promise.resolve(saveStatus === 'saved');
  cache.set(key, value);
  if (key === THEME_KEY) {
    try { localStorage.setItem(key, value); } catch { /* Retried by the queued job. */ }
  }
  return enqueue(async () => {
    if (key === THEME_KEY && cache.get(key) === value) localStorage.setItem(key, value);
    if (backend === 'indexeddb' && database) await writeDatabaseValue(database, key, value);
    else localStorage.setItem(key, value);
    publishChange();
  });
}

// Rows are compared by reference: a one-row edit writes only that row.
// Serialisation of the entire ledger is reserved for backup/fallback storage.
export function writeCoreData(rows: Transaction[], values: KeyValueSnapshot): Promise<boolean> {
  const changes = Object.fromEntries(Object.entries(values).filter(([key, value]) => cache.get(key) !== value));
  if (rows === transactionRows && !Object.keys(changes).length) return Promise.resolve(saveStatus === 'saved');
  transactionRows = rows;
  Object.entries(changes).forEach(([key, value]) => cache.set(key, value));
  return enqueue(async () => {
    const next = new Map(rows.map(row => [row.id, row]));
    const changed = rows.filter(row => durableRows.get(row.id) !== row);
    const deleted = [...durableRows.keys()].filter(id => !next.has(id));
    if (backend === 'indexeddb' && database) await writeDatabaseBatch(database, changes, changed, deleted);
    else {
      const previous = collectLegacySnapshot(localStorage);
      try {
        Object.entries(changes).forEach(([key, value]) => localStorage.setItem(key, value));
        localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(rows));
      } catch (error) {
        clearLegacyAppStorage(); Object.entries(previous).forEach(([key, value]) => localStorage.setItem(key, value)); throw error;
      }
    }
    durableRows = next;
    publishChange();
  });
}

export function removeKey(key: string): void {
  cache.delete(key);
  void enqueue(async () => {
    if (backend === 'indexeddb' && database) await removeDatabaseValue(database, key);
    else localStorage.removeItem(key);
    if (key === THEME_KEY) localStorage.removeItem(key);
    publishChange();
  });
}

export function readText(key: string): string | null {
  try {
    return initialized ? (key === TRANSACTIONS_KEY ? JSON.stringify(transactionRows) : cache.get(key) ?? null) : localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getStorageSnapshot(): KeyValueSnapshot {
  if (initialized) return { ...Object.fromEntries(cache), [TRANSACTIONS_KEY]: JSON.stringify(transactionRows) };
  return collectLegacySnapshot(localStorage);
}

export async function replaceStorageSnapshot(snapshot: KeyValueSnapshot): Promise<void> {
  await flushStorage();
  const filtered = Object.fromEntries(
    Object.entries(snapshot).filter((entry): entry is [string, string] => isAppDataKey(entry[0]) && typeof entry[1] === 'string'),
  );
  if (backend === 'indexeddb' && database) {
    await replaceDatabaseSnapshot(database, filtered);
  } else {
    const previous = collectLegacySnapshot(localStorage);
    try { clearLegacyAppStorage(); Object.entries(filtered).forEach(([key, value]) => localStorage.setItem(key, value)); }
    catch (error) { clearLegacyAppStorage(); Object.entries(previous).forEach(([key, value]) => localStorage.setItem(key, value)); throw error; }
  }
  replaceCache(filtered);
  const theme = filtered[THEME_KEY];
  if (theme) localStorage.setItem(THEME_KEY, theme); else localStorage.removeItem(THEME_KEY);
  publishChange();
}

export async function clearStorageData(): Promise<void> {
  await flushStorage();
  if (backend === 'indexeddb' && database) await clearDatabaseData(database);
  clearLegacyAppStorage();
  cache.clear(); transactionRows = []; durableRows.clear();
  if (backend === 'indexeddb') localStorage.setItem('sf_indexeddb_authoritative', 'true');
  publishChange();
}

export function getStorageBackend(): StorageBackend {
  return backend;
}
