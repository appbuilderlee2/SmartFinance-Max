import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Transaction, TransactionType } from '../types';

class MemoryStorage {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function setup() {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('localStorage', new MemoryStorage());
  vi.stubGlobal('window', new EventTarget());
  const storage = await import('./storage');
  await storage.initializeStorage();
  return storage;
}
const row = (id: string): Transaction => ({ id, amount: 12, note: '', date: '2026-09-01', categoryId: 'food', type: TransactionType.EXPENSE });

describe('durable storage queue', () => {
  it('waits for commit and only rewrites one row in a 5000-row ledger', async () => {
    const storage = await setup();
    const rows = Array.from({ length: 5000 }, (_, index) => row(`tx-${index}`));
    const first = storage.writeCoreData(rows, {});
    expect(storage.getSaveStatus()).toBe('saving');
    expect(await first).toBe(true);
    expect(storage.getSaveStatus()).toBe('saved');
    const put = vi.spyOn(IDBObjectStore.prototype, 'put');
    const updated = rows.map((tx, index) => index === 25 ? { ...tx, amount: 42 } : tx);
    await storage.writeCoreData(updated, {});
    const storeName = (index: number) => (put.mock.contexts[index] as IDBObjectStore | undefined)?.name;
    const rowWrite = put.mock.calls.find((_, index) => storeName(index) === 'transactions');
    expect(put.mock.calls.filter((_, index) => storeName(index) === 'transactions')).toHaveLength(1);
    expect(rowWrite?.[0]).toEqual(updated[25]);
    expect(JSON.parse(storage.getStorageSnapshot().smartfinance_transactions)).toHaveLength(5000);
  });
  it('retains failed work, reports error and retries in order', async () => {
    const storage = await setup();
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => { throw new Error('quota'); });
    expect(await storage.writeCoreData([row('first')], {})).toBe(false);
    expect(storage.getSaveStatus()).toBe('error');
    await expect(storage.flushStorage()).rejects.toThrow();
    const second = storage.writeCoreData([row('first'), row('second')], {});
    put.mockRestore();
    await storage.retryStorage();
    expect(await second).toBe(true);
    await storage.flushStorage();
    expect(storage.getSaveStatus()).toBe('saved');
    const { openSmartFinanceDatabase, readDatabaseSnapshot } = await import('./indexedDb');
    const database = await openSmartFinanceDatabase();
    expect(JSON.parse((await readDatabaseSnapshot(database)).smartfinance_transactions)).toHaveLength(2);
    database.close();
  });

  it('marks this tab stale when an external commit wins before its next write', async () => {
    const storage = await setup();
    const { openSmartFinanceDatabase, readDatabaseState, writeDatabaseBatch } = await import('./indexedDb');
    const database = await openSmartFinanceDatabase();
    const state = await readDatabaseState(database);
    await writeDatabaseBatch(database, { smartfinance_currency: 'USD' }, [], [], state.revision);

    expect(await storage.writeText('smartfinance_currency', 'AUD')).toBe(false);
    expect(storage.getStaleTab()).toBe(true);
    await expect(storage.flushStorage()).rejects.toThrow('另一分頁已更新資料');
    database.close();
  });
});

it('mirrors theme synchronously even while another write is pending', async () => {
  const storage = await setup();
  const pending = storage.writeCoreData([row('first')], {});
  const theme = storage.writeText('smartfinance_themecolor', 'applefluid-dark');
  expect(localStorage.getItem('smartfinance_themecolor')).toBe('applefluid-dark');
  await Promise.all([pending, theme]);
  const { openSmartFinanceDatabase, readDatabaseSnapshot } = await import('./indexedDb');
  const database = await openSmartFinanceDatabase();
  expect((await readDatabaseSnapshot(database)).smartfinance_themecolor).toBe('applefluid-dark');
  database.close();
});
