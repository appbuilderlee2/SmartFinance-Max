import { Category, Subscription, Transaction, TransactionType } from '../types';
import { parseDate, parseLocalYMD, toLocalYMD } from './date';

type ProcessInput = {
  subscriptions: Subscription[];
  transactions: Transaction[];
  categories: Category[];
  today?: Date;
  makeTransactionId: () => string;
};

type ProcessResult = {
  subscriptions: Subscription[];
  transactions: Transaction[];
  changed: boolean;
};

function advanceDate(date: Date, cycle: Subscription['billingCycle']): Date {
  const next = new Date(date);
  if (cycle === 'Weekly') next.setDate(next.getDate() + 7);
  else if (cycle === 'BiWeekly') next.setDate(next.getDate() + 14);
  else if (cycle === 'Monthly') next.setMonth(next.getMonth() + 1);
  else if (cycle === 'Yearly') next.setFullYear(next.getFullYear() + 1);
  return next;
}

function transactionYmd(transaction: Transaction): string | null {
  const parsed = parseDate(transaction.date);
  return parsed ? toLocalYMD(parsed) : null;
}

export function processDueSubscriptions(input: ProcessInput): ProcessResult {
  const todayYmd = toLocalYMD(input.today || new Date());
  const generated: Transaction[] = [];
  let changed = false;

  const expenseCategories = input.categories.filter((item) => item.type === TransactionType.EXPENSE);
  const pickCategoryId = (subscription: Subscription) => {
    if (subscription.categoryId && expenseCategories.some((item) => item.id === subscription.categoryId)) {
      return subscription.categoryId;
    }
    return expenseCategories.find((item) => item.name.includes('訂閱'))?.id
      || expenseCategories.find((item) => item.name.includes('娛樂'))?.id
      || expenseCategories[0]?.id
      || '';
  };

  const updated = input.subscriptions.map((subscription) => {
    const initial = parseLocalYMD(subscription.nextBillingDate);
    if (!initial) return subscription;

    let nextDate = initial;
    let iterations = 0;
    let processed = false;
    let lastProcessed = subscription.lastProcessedDate || '';

    while (toLocalYMD(nextDate) <= todayYmd && iterations < 24) {
      const dueYmd = toLocalYMD(nextDate);
      if (!lastProcessed || lastProcessed < dueYmd) {
        const note = `訂閱：${subscription.name}`;
        const exists = [...input.transactions, ...generated].some((transaction) => {
          const sameDate = transactionYmd(transaction) === dueYmd;
          return sameDate && (
            transaction.subscriptionId === subscription.id
            || (transaction.amount === subscription.amount && transaction.note === note)
          );
        });
        if (!exists) {
          generated.push({
            id: input.makeTransactionId(),
            amount: subscription.amount,
            date: dueYmd,
            note,
            categoryId: pickCategoryId(subscription),
            type: TransactionType.EXPENSE,
            isRecurring: true,
            subscriptionId: subscription.id,
            tags: ['subscription'],
          });
        }
        processed = true;
        lastProcessed = dueYmd;
      }

      if (subscription.autoRenewal === false) break;
      nextDate = advanceDate(nextDate, subscription.billingCycle);
      iterations += 1;
    }

    if (!processed) return subscription;
    changed = true;
    return {
      ...subscription,
      nextBillingDate: subscription.autoRenewal === false ? '' : toLocalYMD(nextDate),
      lastProcessedDate: lastProcessed,
    };
  });

  return { subscriptions: updated, transactions: generated, changed };
}
