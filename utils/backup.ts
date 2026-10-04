import { parseDate, parseLocalYMD } from './date';
import { pinSnapshotCurrencies } from './ledgerCurrency';
import { validateWalletItem, validateWalletLedger, WALLET_KEY } from './wallet';
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
  WALLET_KEY,
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
  if (key === 'smartfinance_deleted_transaction_ids') {
    const ids = JSON.parse(value);
    if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) throw new Error('已刪除交易記錄格式不正確');
  }
  if (ARRAY_KEYS.has(key)) {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) throw new Error(`${key} 必須係陣列`);
    const ids = new Set<string>();
    parsed.forEach((row, index) => {
      const fail = (field: string): never => { throw new Error(`${key} 第 ${index + 1} 筆：${field} 不正確`); };
      if (!row || typeof row !== 'object' || Array.isArray(row)) fail('資料');
      const id = key === 'smartfinance_budgets' ? row.categoryId : row.id;
      if (typeof id !== 'string' || !id.trim() || ids.has(id)) fail('ID（空白或重複）');
      ids.add(id);
      const string = (field: string, required = true) => { if ((required || row[field] !== undefined) && typeof row[field] !== 'string') fail(field); };
      const number = (field: string, required = true) => { if ((required || row[field] !== undefined) && (typeof row[field] !== 'number' || !Number.isFinite(row[field]) || row[field] < 0)) fail(field); };
      const date = (field: string, required = true) => { if ((required || row[field] !== undefined) && (!row[field] || !parseDate(row[field]))) fail(field); };
      if (row.currency !== undefined && !CURRENCIES.has(row.currency)) fail('currency');
      if (key === WALLET_KEY) {
        validateWalletItem(row);
      } else if (key === 'smartfinance_transactions') {
        number('amount'); date('date'); string('note'); string('categoryId');
        if (!['INCOME', 'EXPENSE'].includes(row.type)) fail('type');
        if (row.recurrence !== undefined && !['weekly', 'biweekly', 'monthly'].includes(row.recurrence)) fail('recurrence');
        string('recurrenceSourceId', false); string('subscriptionId', false); string('receiptUrl', false); string('walletItemId', false);
        for (const field of ['recurrenceFrom', 'recurrenceUntil', 'recurrenceOccurrenceDate', 'subscriptionOccurrenceDate']) {
          if (row[field] !== undefined && !parseLocalYMD(row[field])) fail(field);
        }
        if (row.recurrenceTemplate !== undefined) {
          if (!row.recurrenceTemplate || typeof row.recurrenceTemplate !== 'object' || Array.isArray(row.recurrenceTemplate) || row.recurrenceTemplate.recurrenceTemplate !== undefined) fail('recurrenceTemplate');
          validateStoredValue(key, JSON.stringify([{ ...row.recurrenceTemplate, id: 'template' }]));
        }
        if (row.tags !== undefined && (!Array.isArray(row.tags) || row.tags.some((tag: unknown) => typeof tag !== 'string'))) fail('tags');
        if (row.skippedDates !== undefined && (!Array.isArray(row.skippedDates) || row.skippedDates.some((day: unknown) => typeof day !== 'string' || !parseLocalYMD(day)))) fail('skippedDates');
      } else if (key === 'smartfinance_categories') {
        ['name', 'icon', 'color'].forEach(field => string(field));
        if (!['INCOME', 'EXPENSE'].includes(row.type)) fail('type');
      } else if (key === 'smartfinance_budgets') {
        number('limit'); number('spent');
      } else if (key === 'smartfinance_subscriptions') {
        string('name'); number('amount');
        if (!['Monthly', 'Yearly', 'Weekly', 'BiWeekly', 'Custom'].includes(row.billingCycle)) fail('billingCycle');
        if (row.status !== undefined && !['active','paused','cancelled'].includes(row.status)) fail('status');
        if (row.recordingMode !== undefined && !['auto','track'].includes(row.recordingMode)) fail('recordingMode');
        if (row.billingCycle === 'Custom' && (!Number.isInteger(row.intervalCount) || row.intervalCount < 1 || row.intervalCount > 365 || !['days','months'].includes(row.intervalUnit))) fail('interval');
        for (const field of ['trialEndDate','serviceEndDate']) if (row[field] && !parseLocalYMD(row[field])) fail(field);
        if (row.priceChange !== undefined && (!row.priceChange || typeof row.priceChange.amount !== 'number' || !Number.isFinite(row.priceChange.amount) || row.priceChange.amount <= 0 || !parseLocalYMD(row.priceChange.effectiveDate))) fail('priceChange');
        string('cardId', false); string('managementUrl', false);
        if (!((row.autoRenewal === false || row.status === 'paused' || row.status === 'cancelled') && row.nextBillingDate === '')) date('nextBillingDate');
        if (row.nextBillingDate && !parseLocalYMD(row.nextBillingDate)) fail('nextBillingDate');
        string('categoryId', false);
      } else if (key === 'smartfinance_creditcards') {
        string('name'); number('annualFee'); string('cashbackType'); string('expiryDate');
        ['statementDay', 'dueDay'].forEach(field => { if (row[field] !== undefined && (!Number.isInteger(row[field]) || row[field] < 1 || row[field] > 31)) fail(field); });
      } else if (key === 'smartfinance_creditcard_cycles') {
        string('cardId'); string('yearMonth'); number('year'); number('month0'); number('amountDue', false);
        if (!Number.isInteger(row.month0) || row.month0 > 11 || !['open', 'closed'].includes(row.status)) fail('帳單週期');
      }
    });
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
  return createBackupFromSnapshot(collectAppStorage(storage), appVersion);
}

export function createBackupFromSnapshot(storage: Record<string, string>, appVersion: string): SmartFinanceBackup {
  return {
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    appVersion,
    exportedAt: new Date().toISOString(),
    storage: Object.fromEntries(Object.entries(storage).filter(([key]) => isAppStorageKey(key))),
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
  if (data.format !== undefined && data.format !== BACKUP_FORMAT) throw new Error('不支援嘅備份格式');
  if (data.backupVersion !== undefined && (!Number.isInteger(data.backupVersion) || Number(data.backupVersion) < 1 || Number(data.backupVersion) > BACKUP_VERSION)) throw new Error('不支援嘅備份版本，請先更新 App');
  const storage = data.format === BACKUP_FORMAT && data.storage && typeof data.storage === 'object'
    ? data.storage as Record<string, unknown>
    : legacyBackupToStorage(data);

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(storage)) {
    if (!isAppStorageKey(key) || typeof value !== 'string') continue;
    validateStoredValue(key, value);
    normalized[key] = value;
  }
  validateBackupSnapshot(normalized);
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
  validateBackupSnapshot(backup.storage);
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
  validateBackupSnapshot(storage);
  if (!Object.keys(storage).length) throw new Error('CSV 內冇可還原資料');
  return {
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    appVersion: 'csv',
    exportedAt: '',
    storage,
  };
}

export function validateBackupSnapshot(storage: Record<string, string>): void {
  Object.entries(storage).forEach(([key, value]) => validateStoredValue(key, value));
  validateWalletLedger(JSON.parse(storage[WALLET_KEY] || '[]'), JSON.parse(storage.smartfinance_transactions || '[]'));
  const categories = storage.smartfinance_categories ? JSON.parse(storage.smartfinance_categories) : null;
  if (categories) {
    const byId = new Map<string, { type: string }>(categories.map((row: { id: string; type: string }) => [row.id, row]));
    for (const key of ['smartfinance_transactions', 'smartfinance_subscriptions', 'smartfinance_budgets']) {
      const rows = JSON.parse(storage[key] || '[]');
      for (const row of rows) {
        if (key === 'smartfinance_subscriptions' && !row.categoryId) continue;
        const category = byId.get(row.categoryId);
        if (!category) throw new Error(`${key}：分類 ${row.categoryId} 不存在`);
        if (row.type && row.type !== category.type) throw new Error(`${key}：分類收入／支出類型不符`);
        if (row.recurrenceTemplate) {
          const templateCategory = byId.get(row.recurrenceTemplate.categoryId);
          if (!templateCategory || templateCategory.type !== row.recurrenceTemplate.type) throw new Error('週期範本分類不存在或類型不符');
        }
      }
    }
  }
}

export type MergeOptions = { conflict?: 'current' | 'incoming'; restoreDeleted?: boolean };
export function previewBackupMerge(current: Record<string, string>, incoming: Record<string, string>) {
  let added = 0, conflicts = 0, deleted = 0;
  const removed = new Set<string>(JSON.parse(current.smartfinance_deleted_transaction_ids || '[]'));
  ARRAY_KEYS.forEach(key => {
    const idKey = key === 'smartfinance_budgets' ? 'categoryId' : 'id';
    const rows = new Map(JSON.parse(current[key] || '[]').map((row: Record<string, unknown>) => [row[idKey], row]));
    for (const row of JSON.parse(incoming[key] || '[]')) {
      if (key === 'smartfinance_transactions' && removed.has(row.id)) { deleted++; continue; }
      if (!rows.has(row[idKey])) added++;
      else if (JSON.stringify(rows.get(row[idKey])) !== JSON.stringify(row)) conflicts++;
    }
  });
  return { added, conflicts, deleted };
}

export function mergeBackupSnapshots(current: Record<string, string>, incoming: Record<string, string>, options: MergeOptions = {}): Record<string, string> {
  current = pinSnapshotCurrencies(current);
  incoming = pinSnapshotCurrencies(incoming);
  // Merging entities does not silently replace device preferences or security settings.
  const result = { ...incoming, ...current };
  const removed = new Set<string>(JSON.parse(current.smartfinance_deleted_transaction_ids || '[]'));
  ARRAY_KEYS.forEach(key => {
    if (!incoming[key]) return;
    const idKey = key === 'smartfinance_budgets' ? 'categoryId' : 'id';
    const rows = new Map(JSON.parse(current[key] || '[]').map((row: Record<string, unknown>) => [row[idKey], row]));
    JSON.parse(incoming[key]).forEach((row: Record<string, unknown>) => {
      if (key === 'smartfinance_transactions' && removed.has(row.id as string)) {
        if (!options.restoreDeleted) return;
        removed.delete(row.id as string);
      }
      if (!rows.has(row[idKey]) || options.conflict === 'incoming') rows.set(row[idKey], row);
    });
    result[key] = JSON.stringify([...rows.values()]);
  });
  // Retain deletion history from an imported device without deleting live rows.
  const liveIds = new Set(JSON.parse(result.smartfinance_transactions || '[]').map((row: { id: string }) => row.id));
  for (const id of JSON.parse(incoming.smartfinance_deleted_transaction_ids || '[]')) {
    if (!liveIds.has(id)) removed.add(id);
  }
  result.smartfinance_deleted_transaction_ids = JSON.stringify([...removed]);
  validateBackupSnapshot(result);
  return result;
}
