import { Budget, Category, Subscription, Transaction } from '../types';

export type CategoryUsage = {
  transactionCount: number;
  subscriptionCount: number;
  hasBudget: boolean;
};

export function getCategoryUsage(
  categoryId: string,
  transactions: Transaction[],
  subscriptions: Subscription[],
  budgets: Budget[],
): CategoryUsage {
  return {
    transactionCount: transactions.filter((item) => item.categoryId === categoryId).length,
    subscriptionCount: subscriptions.filter((item) => item.categoryId === categoryId).length,
    hasBudget: budgets.some((item) => item.categoryId === categoryId && item.limit !== 0),
  };
}

export function canUseReplacement(source: Category, replacement: Category | undefined): boolean {
  return Boolean(replacement && replacement.id !== source.id && replacement.type === source.type);
}

export function reassignCategoryReferences(
  sourceId: string,
  replacementId: string,
  transactions: Transaction[],
  subscriptions: Subscription[],
  budgets: Budget[],
) {
  const sourceBudget = budgets.find((item) => item.categoryId === sourceId);
  const replacementBudget = budgets.find((item) => item.categoryId === replacementId);
  const nextBudgets = budgets
    .filter((item) => item.categoryId !== sourceId && item.categoryId !== replacementId)
    .concat({
      categoryId: replacementId,
      limit: (replacementBudget?.limit || 0) + (sourceBudget?.limit || 0),
      spent: replacementBudget?.spent || 0,
    });

  return {
    transactions: transactions.map((item) => item.categoryId === sourceId
      ? { ...item, categoryId: replacementId }
      : item),
    subscriptions: subscriptions.map((item) => item.categoryId === sourceId
      ? { ...item, categoryId: replacementId }
      : item),
    budgets: nextBudgets,
  };
}
