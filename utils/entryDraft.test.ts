import { beforeEach, describe, expect, it } from 'vitest';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { Currency, TransactionType } from '../types';
import { DRAFT_KEY, clearEntryDraft, readEntryDraft, saveEntryDraft } from './entryDraft';

const memory = new Map<string, string>();
beforeEach(async () => {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: fakeIndexedDB });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
  } });
  memory.clear();
  await clearEntryDraft();
});

const draft = {
  id: 'tx_test', amount: '88', selectedCategory: null, note: '持久草稿', date: '2026-09-23',
  recurrence: 'none' as const, receiptPreview: 'data:image/png;base64,AAAA', tags: [],
  transactionType: TransactionType.EXPENSE, txCurrency: Currency.AUD, showDetails: false,
};

describe('IndexedDB entry draft', () => {
  it('preserves a receipt without session storage and clears only after deletion commits', async () => {
    expect(await saveEntryDraft(draft)).toBe(true);
    expect(memory.has(DRAFT_KEY)).toBe(false);
    expect(await readEntryDraft()).toEqual(draft);
    expect(await clearEntryDraft()).toBe(true);
    expect(await readEntryDraft()).toBeNull();
  });

  it('migrates an existing session draft', async () => {
    memory.set(DRAFT_KEY, JSON.stringify({ ...draft, receiptPreview: null }));
    expect(await readEntryDraft()).toMatchObject({ id: draft.id, note: draft.note });
    expect(memory.has(DRAFT_KEY)).toBe(false);
    expect(await readEntryDraft()).toMatchObject({ id: draft.id, note: draft.note });
  });
});
