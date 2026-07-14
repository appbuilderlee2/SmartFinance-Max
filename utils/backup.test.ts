import { describe, expect, it } from 'vitest';
import {
  backupToCsv,
  clearAppStorage,
  createBackup,
  parseBackupCsv,
  parseBackupJson,
  restoreBackup,
  stringifyCsv,
  parseCsv,
} from './backup';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

class FailingStorage extends MemoryStorage {
  failOnKey = '';
  override setItem(key: string, value: string) {
    if (key === this.failOnKey) throw new Error('quota exceeded');
    super.setItem(key, value);
  }
}

describe('CSV codec', () => {
  it('round-trips commas, quotes and newlines', () => {
    const rows = [['name', 'note'], ['餐飲,聚會', '第一行\n第二行 "測試"']];
    expect(parseCsv(stringifyCsv(rows))).toEqual(rows);
  });
});

describe('SmartFinance backup', () => {
  it('includes credit-card cycles and restores a JSON round trip', () => {
    const source = new MemoryStorage();
    source.setItem('smartfinance_transactions', JSON.stringify([{ id: 'tx1', note: '午餐,朋友' }]));
    source.setItem('smartfinance_creditcard_cycles', JSON.stringify([{ id: 'cycle1', status: 'closed' }]));
    source.setItem('sf.tagHistory.v1', JSON.stringify({ mru: ['朋友'] }));
    source.setItem('unrelated_key', 'keep-private');

    const parsed = parseBackupJson(JSON.stringify(createBackup(source, '1.2.0')));
    const target = new MemoryStorage();
    target.setItem('smartfinance_old', 'remove-me');
    target.setItem('unrelated_key', 'do-not-touch');
    restoreBackup(parsed, target);

    expect(JSON.parse(target.getItem('smartfinance_creditcard_cycles') || '[]')).toHaveLength(1);
    expect(target.getItem('sf.tagHistory.v1')).toContain('朋友');
    expect(target.getItem('smartfinance_old')).toBeNull();
    expect(target.getItem('unrelated_key')).toBe('do-not-touch');
  });

  it('round-trips the complete storage backup through CSV', () => {
    const source = new MemoryStorage();
    source.setItem('smartfinance_transactions', JSON.stringify([{ id: 'tx1', note: 'a,b\n"c"' }]));
    source.setItem('smartfinance_currency', 'AUD');
    const backup = createBackup(source, '1.2.0');
    expect(parseBackupCsv(backupToCsv(backup)).storage).toEqual(backup.storage);
  });

  it('rejects invalid known data instead of overwriting current data', () => {
    expect(() => parseBackupJson(JSON.stringify({
      format: 'smartfinance-backup',
      storage: { smartfinance_transactions: '{"not":"an array"}' },
    }))).toThrow('必須係陣列');
  });

  it('clears all app-owned keys but preserves other sites on the origin', () => {
    const storage = new MemoryStorage();
    storage.setItem('smartfinance_creditcard_cycles', '[]');
    storage.setItem('sf_reminders_v1', '[]');
    storage.setItem('sf.tagHistory.v1', '{}');
    storage.setItem('other_app', 'safe');
    clearAppStorage(storage);
    expect(storage.length).toBe(1);
    expect(storage.getItem('other_app')).toBe('safe');
  });

  it('rolls back the previous snapshot when restore cannot be completed', () => {
    const storage = new FailingStorage();
    storage.setItem('smartfinance_transactions', JSON.stringify([{ id: 'old' }]));
    const backup = parseBackupJson(JSON.stringify({
      format: 'smartfinance-backup',
      backupVersion: 2,
      storage: {
        smartfinance_transactions: JSON.stringify([{ id: 'new' }]),
        smartfinance_creditcards: '[]',
      },
    }));
    storage.failOnKey = 'smartfinance_creditcards';
    expect(() => restoreBackup(backup, storage)).toThrow('quota exceeded');
    expect(storage.getItem('smartfinance_transactions')).toContain('old');
  });
});
