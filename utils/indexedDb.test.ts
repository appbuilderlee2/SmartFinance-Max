import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import {
  migrateLegacyStorage,
  openSmartFinanceDatabase,
  readDatabaseSnapshot,
  replaceDatabaseSnapshot,
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
