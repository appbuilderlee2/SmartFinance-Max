import { beforeEach, describe, expect, it } from 'vitest';
import { ensureSchemaVersion, getSchemaVersion, SCHEMA_VERSION } from './storageVersion';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

describe('storage migrations', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
  });

  it('migrates a legacy install sequentially to the current schema', () => {
    ensureSchemaVersion();
    expect(getSchemaVersion()).toBe(SCHEMA_VERSION);
    expect(localStorage.getItem('smartfinance_creditcard_cycles')).toBe('[]');
  });

  it('does not overwrite existing cycle data', () => {
    localStorage.setItem('smartfinance_schema_version', '1');
    localStorage.setItem('smartfinance_creditcard_cycles', '[{"id":"cycle-1"}]');
    ensureSchemaVersion();
    expect(localStorage.getItem('smartfinance_creditcard_cycles')).toContain('cycle-1');
  });

  it('does not advance the version when data is invalid', () => {
    localStorage.setItem('smartfinance_schema_version', '1');
    localStorage.setItem('smartfinance_creditcard_cycles', '{}');
    expect(() => ensureSchemaVersion()).toThrow('Invalid credit-card cycle data');
    expect(getSchemaVersion()).toBe(1);
  });
});
