import { Budget, Category, TransactionType } from '../types';

export function expenseBudgets(budgets: Budget[], categories: Category[]): Budget[] {
  const expenseIds = new Set(categories.filter(category => category.type === TransactionType.EXPENSE).map(category => category.id));
  return budgets.filter(budget => expenseIds.has(budget.categoryId));
}
