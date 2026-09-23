import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import {
  migrateLegacyStorage, migrateTransactionRows, writeDatabaseBatch,
  openSmartFinanceDatabase, DATABASE_NAME,
  readDatabaseSnapshot,
  readDatabaseState,
  replaceDatabaseSnapshot,
  StorageRevisionConflictError,
} from './indexedDb';
import { reconcileThemeMirror } from './storage';

class MemoryStorage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('IndexedDB storage', () => {
  it('copies legacy app data without deleting the original safety copy', async () => {
    const factory = new IDBFactory();
    const legacy = new MemoryStorage();
    legacy.setItem('smartfinance_transactions', '[{"id":"legacy-1"}]');
    legacy.setItem('unrelated', 'keep-out');
    const database = await openSmartFinanceDatabase(factory);

    const result = await migrateLegacyStorage(database, legacy);
    const snapshot = await readDatabaseSnapshot(database);

    expect(result).toEqual({ migrated: true, importedKeys: 1, existingKeys: 0 });
    expect(snapshot).toEqual({ smartfinance_transactions: '[{"id":"legacy-1"}]' });
    expect(legacy.getItem('smartfinance_transactions')).toContain('legacy-1');
    database.close();
  });

  it('does not overwrite IndexedDB when migration runs again', async () => {
    const factory = new IDBFactory();
    const legacy = new MemoryStorage();
    legacy.setItem('smartfinance_currency', 'HKD');
    const database = await openSmartFinanceDatabase(factory);
    await migrateLegacyStorage(database, legacy);
    await replaceDatabaseSnapshot(database, { smartfinance_currency: 'AUD' });
    legacy.setItem('smartfinance_currency', 'USD');

    const result = await migrateLegacyStorage(database, legacy);
    const snapshot = await readDatabaseSnapshot(database);

    expect(result.migrated).toBe(false);
    expect(snapshot.smartfinance_currency).toBe('AUD');
    database.close();
  });

  it('reconciles the synchronous theme mirror before app hydration', async () => {
    const factory = new IDBFactory();
    const legacy = new MemoryStorage();
    const database = await openSmartFinanceDatabase(factory);
    await replaceDatabaseSnapshot(database, { smartfinance_themecolor: 'blue' });
    legacy.setItem('smartfinance_themecolor', 'applefluid');

    const snapshot = await reconcileThemeMirror(
      database,
      legacy,
      await readDatabaseSnapshot(database),
    );

    expect(snapshot.smartfinance_themecolor).toBe('applefluid');
    expect((await readDatabaseSnapshot(database)).smartfinance_themecolor).toBe('applefluid');
    database.close();
  });
});

it('migrates v1 rows atomically and supports delta updates with indexes', async () => {
  const factory = new IDBFactory();
  const old = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open('smartfinance-max', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('app-data'); request.result.createObjectStore('meta'); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  await new Promise<void>(resolve => {
    const transaction = old.transaction('app-data', 'readwrite');
    transaction.objectStore('app-data').put(JSON.stringify([{ id: 'a', amount: 12, date: '2026-09-01', categoryId: 'food' }, { id: 'b', amount: 9 }]), 'smartfinance_transactions');
    transaction.oncomplete = () => resolve();
  });
  old.close();
  const database = await openSmartFinanceDatabase(factory);
  await migrateTransactionRows(database);
  expect(database.transaction('transactions').objectStore('transactions').indexNames.contains('date')).toBe(true);
  await writeDatabaseBatch(database, { smartfinance_subscriptions: '[]' }, [{ id: 'a', amount: 30 } as any], ['b']);
  const result = await readDatabaseSnapshot(database);
  expect(JSON.parse(result.smartfinance_transactions)).toEqual([{ id: 'a', amount: 30 }]);
  expect(result.smartfinance_subscriptions).toBe('[]');
  database.close();
});

it('rolls back a failed multi-store write, including related metadata', async () => {
  const database = await openSmartFinanceDatabase(new IDBFactory());
  await replaceDatabaseSnapshot(database, { smartfinance_subscriptions: '["old"]', smartfinance_transactions: '[{"id":"old"}]' });
  await expect(writeDatabaseBatch(database, { smartfinance_subscriptions: '["new"]' }, [{ id: 'valid' }, { amount: 1 }] as any, ['old'])).rejects.toThrow();
  const snapshot = await readDatabaseSnapshot(database);
  expect(snapshot.smartfinance_subscriptions).toBe('["old"]');
  expect(JSON.parse(snapshot.smartfinance_transactions)).toEqual([{ id: 'old' }]);
  database.close();
});

it('atomically rejects a stale cross-tab write using the stored revision', async () => {
  const database = await openSmartFinanceDatabase(new IDBFactory());
  const initial = await readDatabaseState(database);
  expect(initial.revision).toBe(0);

  const outcomes = await Promise.allSettled([
    writeDatabaseBatch(database, { smartfinance_currency: 'AUD' }, [], [], initial.revision),
    writeDatabaseBatch(database, { smartfinance_currency: 'HKD' }, [], [], initial.revision),
  ]);
  expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  const rejected = outcomes.find(result => result.status === 'rejected');
  expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(StorageRevisionConflictError);
  const saved = await readDatabaseState(database);
  expect(saved.revision).toBe(1);
  expect(['AUD', 'HKD']).toContain(saved.snapshot.smartfinance_currency);
  database.close();
});

it('closes a version 2 tab before opening the revision-aware version 3 database', async () => {
  const factory = new IDBFactory();
  const request = factory.open(DATABASE_NAME, 2);
  request.onupgradeneeded = () => {
    const database = request.result;
    database.createObjectStore('app-data');
    database.createObjectStore('meta');
    database.createObjectStore('transactions', { keyPath: 'id' });
  };
  const oldDatabase = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  oldDatabase.onversionchange = () => oldDatabase.close();

  const currentDatabase = await openSmartFinanceDatabase(factory);
  expect(() => oldDatabase.transaction('app-data', 'readonly')).toThrow();
  currentDatabase.close();
});
