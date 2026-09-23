import { describe, it, expect } from 'vitest';
import { captureDeletion, restoreDeletion } from './transactionUndo';
import { removeRecurringOccurrence, processDueRecurringTransactions } from './recurringTransactions';
import { Transaction, TransactionType } from '../types';
const source: Transaction = { id:'source', amount:10, note:'source', categoryId:'food', type:TransactionType.EXPENSE, date:'2026-09-01', recurrence:'weekly' };
const occurrence: Transaction = { ...source, id:'child', date:'2026-09-08', recurrence:undefined, recurrenceSourceId:'source' };
describe('transaction undo', () => {
  it('restores the occurrence and only its new skip without reverting other edits', () => {
    const before=[source,occurrence], captured=captureDeletion(before,'child')!;
    const removed=removeRecurringOccurrence(before,'child').map(tx=>({...tx,note:'edited',skippedDates:[...(tx.skippedDates||[]),'2026-09-15']}));
    const restored=restoreDeletion(removed,captured);
    expect(restored.find(tx=>tx.id==='source')).toMatchObject({note:'edited',skippedDates:['2026-09-15']});
    expect(restored.find(tx=>tx.id==='child')).toEqual(occurrence);
    expect(processDueRecurringTransactions({transactions:restored,today:new Date(2026,8,15),makeTransactionId:()=> 'new'}).changed).toBe(false);
    expect(restoreDeletion(restored,captured)).toBe(restored);
  });
  it('restores a recurring source without removing its existing children', () => {
    const restored=restoreDeletion([occurrence],captureDeletion([source,occurrence],'source')!);
    expect(restored).toHaveLength(2); expect(restored[0].recurrence).toBe('weekly');
  });
});
