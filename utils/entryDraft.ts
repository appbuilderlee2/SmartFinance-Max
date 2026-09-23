import { Currency, TransactionType, RecurrenceFrequency } from '../types';

export const DRAFT_KEY = 'sf.entryDraft.v1';
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const DATABASE_NAME = 'smartfinance-entry-draft';
const STORE_NAME = 'draft';

export interface EntryDraft {
  id: string; amount: string; selectedCategory: string | null; note: string;
  date: string; recurrence: RecurrenceFrequency | 'none'; receiptPreview: string | null;
  tags: string[]; transactionType: TransactionType; txCurrency: Currency; showDetails: boolean;
}

export function validateEntryDraft(value: unknown): EntryDraft | null {
  const d = value as EntryDraft | null;
  if (!d || typeof d !== 'object' || typeof d.id !== 'string' || !d.id.startsWith('tx') ||
    typeof d.amount !== 'string' || typeof d.note !== 'string' || typeof d.date !== 'string' ||
    !(d.selectedCategory === null || typeof d.selectedCategory === 'string') ||
    !(d.receiptPreview === null || typeof d.receiptPreview === 'string') ||
    !Array.isArray(d.tags) || !d.tags.every(t => typeof t === 'string') ||
    !Object.values(Currency).includes(d.txCurrency) || !Object.values(TransactionType).includes(d.transactionType) ||
    !['none', 'weekly', 'biweekly', 'monthly'].includes(d.recurrence) || typeof d.showDetails !== 'boolean') return null;
  return d;
}

function legacyDraft(): EntryDraft | null {
  try { return validateEntryDraft(JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null')); }
  catch { return null; }
}

let databasePromise: Promise<IDBDatabase> | null = null;
function openDraftDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME); };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); databasePromise = null; };
      resolve(request.result);
    };
    request.onerror = () => reject(request.error || new Error('草稿資料庫未能開啟'));
    request.onblocked = () => reject(new Error('草稿資料庫被其他分頁阻擋'));
  }).catch(error => { databasePromise = null; throw error; });
  return databasePromise;
}

async function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDraftDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    let result: T;
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || new Error('草稿儲存失敗'));
    transaction.onabort = () => reject(transaction.error || new Error('草稿儲存中止'));
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => { result = request.result; };
  });
}

let writes: Promise<unknown> = Promise.resolve();
function orderedWrite(action: () => Promise<void>): Promise<boolean> {
  const result = writes.catch(() => undefined).then(action).then(() => true, () => false);
  writes = result;
  return result;
}

export async function readEntryDraft(): Promise<EntryDraft | null> {
  await writes;
  try {
    const legacy = legacyDraft();
    if (legacy && await saveEntryDraft(legacy)) return legacy;
    return validateEntryDraft(await transact('readonly', store => store.get(DRAFT_KEY))) || legacy;
  } catch { return legacyDraft(); }
}

export function saveEntryDraft(draft: EntryDraft): Promise<boolean> {
  return orderedWrite(async () => {
    try {
      await transact('readwrite', store => store.put(draft, DRAFT_KEY));
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* optional legacy store */ }
    } catch (error) {
      // Keep a small text draft when IndexedDB is temporarily unavailable.
      if (draft.receiptPreview) throw error;
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }
  });
}

export function clearEntryDraft(): Promise<boolean> {
  return orderedWrite(async () => {
    await transact('readwrite', store => store.delete(DRAFT_KEY));
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* optional legacy store */ }
  });
}
