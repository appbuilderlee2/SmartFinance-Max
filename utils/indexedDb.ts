export const DATABASE_NAME = 'smartfinance-max';
export const DATABASE_VERSION = 1;

const DATA_STORE = 'app-data';
const META_STORE = 'meta';
const MIGRATION_KEY = 'localstorage-migration-v1';
const APP_PREFIXES = ['smartfinance_', 'sf_', 'sf.'];

export type KeyValueSnapshot = Record<string, string>;

export type LegacyStorage = Pick<Storage, 'length' | 'key' | 'getItem'>;

export type MigrationResult = {
  migrated: boolean;
  importedKeys: number;
  existingKeys: number;
};

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
  });
}

export function isAppDataKey(key: string): boolean {
  return APP_PREFIXES.some(prefix => key.startsWith(prefix));
}

export function collectLegacySnapshot(storage: LegacyStorage): KeyValueSnapshot {
  const snapshot: KeyValueSnapshot = {};
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !isAppDataKey(key)) continue;
    const value = storage.getItem(key);
    if (value !== null) snapshot[key] = value;
  }
  return snapshot;
}

export function openSmartFinanceDatabase(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DATA_STORE)) database.createObjectStore(DATA_STORE);
      if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open IndexedDB'));
    request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another tab'));
  });
}

export async function readDatabaseSnapshot(database: IDBDatabase): Promise<KeyValueSnapshot> {
  const transaction = database.transaction(DATA_STORE, 'readonly');
  const done = transactionDone(transaction);
  const store = transaction.objectStore(DATA_STORE);
  const [keys, values] = await Promise.all([
    requestResult(store.getAllKeys()),
    requestResult(store.getAll()),
  ]);
  await done;
  const snapshot: KeyValueSnapshot = {};
  keys.forEach((key, index) => {
    if (typeof key === 'string' && typeof values[index] === 'string') snapshot[key] = values[index];
  });
  return snapshot;
}

export async function writeDatabaseValue(database: IDBDatabase, key: string, value: string): Promise<void> {
  const transaction = database.transaction(DATA_STORE, 'readwrite');
  const done = transactionDone(transaction);
  transaction.objectStore(DATA_STORE).put(value, key);
  await done;
}

export async function removeDatabaseValue(database: IDBDatabase, key: string): Promise<void> {
  const transaction = database.transaction(DATA_STORE, 'readwrite');
  const done = transactionDone(transaction);
  transaction.objectStore(DATA_STORE).delete(key);
  await done;
}

export async function replaceDatabaseSnapshot(database: IDBDatabase, snapshot: KeyValueSnapshot): Promise<void> {
  const transaction = database.transaction(DATA_STORE, 'readwrite');
  const done = transactionDone(transaction);
  const store = transaction.objectStore(DATA_STORE);
  store.clear();
  Object.entries(snapshot).forEach(([key, value]) => {
    if (isAppDataKey(key)) store.put(value, key);
  });
  await done;
}

export async function clearDatabaseData(database: IDBDatabase): Promise<void> {
  await replaceDatabaseSnapshot(database, {});
}

export async function migrateLegacyStorage(
  database: IDBDatabase,
  storage: LegacyStorage,
): Promise<MigrationResult> {
  const legacy = collectLegacySnapshot(storage);
  const entries = Object.entries(legacy);
  const transaction = database.transaction([DATA_STORE, META_STORE], 'readwrite');
  const done = transactionDone(transaction);
  const dataStore = transaction.objectStore(DATA_STORE);
  const metaStore = transaction.objectStore(META_STORE);
  let outcome: MigrationResult = { migrated: false, importedKeys: 0, existingKeys: 0 };

  const markerRequest = metaStore.get(MIGRATION_KEY);
  markerRequest.onerror = () => transaction.abort();
  markerRequest.onsuccess = () => {
    if (markerRequest.result) {
      const previous = markerRequest.result as MigrationResult;
      outcome = {
        migrated: false,
        importedKeys: 0,
        existingKeys: previous.existingKeys + previous.importedKeys,
      };
      return;
    }

    const countRequest = dataStore.count();
    countRequest.onerror = () => transaction.abort();
    countRequest.onsuccess = () => {
      const existingKeys = countRequest.result;
      if (existingKeys > 0 || entries.length === 0) {
        outcome = { migrated: false, importedKeys: 0, existingKeys };
        metaStore.put(outcome, MIGRATION_KEY);
        return;
      }

      entries.forEach(([key, value]) => dataStore.put(value, key));
      let verified = 0;
      let failed = false;
      entries.forEach(([key, expected]) => {
        const verifyRequest = dataStore.get(key);
        verifyRequest.onerror = () => transaction.abort();
        verifyRequest.onsuccess = () => {
          if (verifyRequest.result !== expected) failed = true;
          verified += 1;
          if (verified !== entries.length) return;
          if (failed) {
            transaction.abort();
            return;
          }
          outcome = { migrated: true, importedKeys: entries.length, existingKeys: 0 };
          metaStore.put(outcome, MIGRATION_KEY);
        };
      });
    };
  };

  await done;
  return outcome;
}

export function deleteSmartFinanceDatabase(factory: IDBFactory = indexedDB): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Unable to delete IndexedDB database'));
    request.onblocked = () => reject(new Error('IndexedDB deletion is blocked by another tab'));
  });
}
