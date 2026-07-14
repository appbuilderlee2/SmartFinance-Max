export const BACKUP_FORMAT = 'smartfinance-backup';
export const BACKUP_VERSION = 2;

const APP_KEY_PREFIXES = ['smartfinance_', 'sf_', 'sf.'];
const ARRAY_KEYS = new Set([
  'smartfinance_transactions',
  'smartfinance_categories',
  'smartfinance_budgets',
  'smartfinance_subscriptions',
  'smartfinance_creditcards',
  'smartfinance_creditcard_cycles',
]);
const CURRENCIES = new Set(['TWD', 'HKD', 'USD', 'AUD', 'CNY', 'JPY', 'EUR', 'GBP']);

export type StorageLike = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>;

export type SmartFinanceBackup = {
  format: typeof BACKUP_FORMAT;
  backupVersion: number;
  appVersion: string;
  exportedAt: string;
  storage: Record<string, string>;
};

export function isAppStorageKey(key: string): boolean {
  return APP_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function validateStoredValue(key: string, value: string): void {
  if (ARRAY_KEYS.has(key)) {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) throw new Error(`${key} 必須係陣列`);
  }

  if (key === 'smartfinance_currency' && !CURRENCIES.has(value)) {
    throw new Error(`不支援嘅貨幣：${value}`);
  }

  if (key === 'smartfinance_themecolor' && !/^[a-z0-9-]+$/i.test(value)) {
    throw new Error('主題名稱格式不正確');
  }
}

export function collectAppStorage(storage: StorageLike): Record<string, string> {
  const result: Record<string, string> = {};
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !isAppStorageKey(key)) continue;
    const value = storage.getItem(key);
    if (value !== null) result[key] = value;
  }
  return result;
}

export function createBackup(storage: StorageLike, appVersion: string): SmartFinanceBackup {
  return {
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    appVersion,
    exportedAt: new Date().toISOString(),
    storage: collectAppStorage(storage),
  };
}

function legacyBackupToStorage(data: Record<string, unknown>): Record<string, string> {
  const mapping: Array<[string, string]> = [
    ['transactions', 'smartfinance_transactions'],
    ['categories', 'smartfinance_categories'],
    ['budgets', 'smartfinance_budgets'],
    ['subscriptions', 'smartfinance_subscriptions'],
    ['creditCards', 'smartfinance_creditcards'],
    ['creditCardCycles', 'smartfinance_creditcard_cycles'],
  ];
  const storage: Record<string, string> = {};
  for (const [field, key] of mapping) {
    if (data[field] !== undefined) storage[key] = JSON.stringify(data[field]);
  }
  if (typeof data.currency === 'string') storage.smartfinance_currency = data.currency;
  if (typeof data.themeColor === 'string') storage.smartfinance_themecolor = data.themeColor;
  return storage;
}

export function parseBackupJson(text: string): SmartFinanceBackup {
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('備份檔案格式不正確');
  }
  const data = parsed as Record<string, unknown>;
  const storage = data.format === BACKUP_FORMAT && data.storage && typeof data.storage === 'object'
    ? data.storage as Record<string, unknown>
    : legacyBackupToStorage(data);

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(storage)) {
    if (!isAppStorageKey(key) || typeof value !== 'string') continue;
    validateStoredValue(key, value);
    normalized[key] = value;
  }
  if (!Object.keys(normalized).length) throw new Error('備份內搵唔到 SmartFinance 資料');

  return {
    format: BACKUP_FORMAT,
    backupVersion: Number(data.backupVersion) || 1,
    appVersion: typeof data.appVersion === 'string' ? data.appVersion : 'legacy',
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
    storage: normalized,
  };
}

export function restoreBackup(backup: SmartFinanceBackup, storage: StorageLike): void {
  for (const [key, value] of Object.entries(backup.storage)) validateStoredValue(key, value);
  const previous = collectAppStorage(storage);
  try {
    clearAppStorage(storage);
    for (const [key, value] of Object.entries(backup.storage)) storage.setItem(key, value);
  } catch (error) {
    // A quota/private-mode error must not leave the user with a half-restored
    // database. Best-effort rollback to the exact previous app snapshot.
    clearAppStorage(storage);
    for (const [key, value] of Object.entries(previous)) storage.setItem(key, value);
    throw error;
  }
}

export function clearAppStorage(storage: StorageLike): void {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && isAppStorageKey(key)) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
}

export function stringifyCsv(rows: string[][]): string {
  return rows.map((row) => row.map((value) => {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(',')).join('\r\n');
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error('CSV 引號未完整關閉');
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

export function backupToCsv(backup: SmartFinanceBackup): string {
  const rows = [['storageKey', 'value']];
  Object.entries(backup.storage)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, value]) => rows.push([key, value]));
  return stringifyCsv(rows);
}

export function parseBackupCsv(text: string): SmartFinanceBackup {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  if (rows[0]?.[0] !== 'storageKey' || rows[0]?.[1] !== 'value') {
    throw new Error('CSV 唔係 SmartFinance v2 備份格式');
  }
  const storage: Record<string, string> = {};
  rows.slice(1).forEach(([key, value]) => {
    if (!key || !isAppStorageKey(key)) return;
    validateStoredValue(key, value ?? '');
    storage[key] = value ?? '';
  });
  if (!Object.keys(storage).length) throw new Error('CSV 內冇可還原資料');
  return {
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    appVersion: 'csv',
    exportedAt: '',
    storage,
  };
}
