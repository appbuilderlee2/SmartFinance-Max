import { expect, test } from 'vitest';
import { TransactionType, type Category } from '../types';
import { expenseBudgets } from './expenseBudgets';

test('expense limits exclude old income-category rows while preserving the original snapshot', () => {
  const categories = [
    { id: 'spent', type: TransactionType.EXPENSE },
    { id: 'earned', type: TransactionType.INCOME },
  ] as Category[];
  const budgets = [{ categoryId: 'spent', limit: 100, spent: 40 }, { categoryId: 'earned', limit: 300, spent: 0 }];
  expect(expenseBudgets(budgets, categories)).toEqual([budgets[0]]);
  expect(budgets).toHaveLength(2);
});
