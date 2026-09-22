import { Currency, TransactionType, RecurrenceFrequency } from '../types';
export const DRAFT_KEY = 'sf.entryDraft.v1';
export interface EntryDraft { id:string; amount:string; selectedCategory:string|null; note:string; date:string; recurrence:RecurrenceFrequency|'none'; receiptPreview:string|null; tags:string[]; transactionType:TransactionType; txCurrency:Currency; showDetails:boolean; }
export function readEntryDraft(): EntryDraft | null {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
    if (!d || typeof d.id !== 'string' || !d.id.startsWith('tx') || typeof d.amount !== 'string' || typeof d.note !== 'string' || typeof d.date !== 'string'
      || !(d.selectedCategory === null || typeof d.selectedCategory === 'string') || !(d.receiptPreview === null || typeof d.receiptPreview === 'string')
      || !Array.isArray(d.tags) || !d.tags.every((t: unknown) => typeof t === 'string') || !Object.values(Currency).includes(d.txCurrency)
      || !Object.values(TransactionType).includes(d.transactionType) || !['none','weekly','biweekly','monthly'].includes(d.recurrence)) return null;
    return d;
  } catch { return null; }
}
export function saveEntryDraft(draft: EntryDraft): boolean { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); return true; } catch { return false; } }
export function clearEntryDraft(): void { try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* unavailable storage */ } }
