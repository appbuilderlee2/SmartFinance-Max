import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import { removeTransactionTag } from './tags';

describe('removeTransactionTag', () => {
  it('removes matching labels without removing transactions or system subscription metadata', () => {
    const ordinary = { id: 'one', tags: ['Food', 'keep'] } as Transaction;
    const subscription = { id: 'two', subscriptionId: 'sub', tags: ['subscription', 'FOOD', 'keep'] } as Transaction;
    const rows = [ordinary, subscription];
    const result = removeTransactionTag(rows, '#food');
    expect(result).toHaveLength(2);
    expect(result[0].tags).toEqual(['keep']);
    expect(result[1].tags).toEqual(['subscription', 'keep']);
    expect(rows[0].tags).toEqual(['Food', 'keep']);
  });

  it('does not remove subscription metadata when deleting the user label of the same name', () => {
    const row = { id: 'sub', subscriptionId: 'sub', tags: ['subscription'] } as Transaction;
    expect(removeTransactionTag([row], 'subscription')[0]).toBe(row);
  });
});
