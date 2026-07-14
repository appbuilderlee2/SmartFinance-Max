import { Category, Currency, Subscription, Transaction, TransactionType } from '../types';
import { parseDate, parseLocalYMD, toLocalYMD } from './date';

type ProcessInput = {
  subscriptions: Subscription[];
  transactions: Transaction[];
  categories: Category[];
  defaultCurrency: Currency;
  today?: Date;
  makeTransactionId: () => string;
};

type ProcessResult = {
  subscriptions: Subscription[];
  transactions: Transaction[];
  changed: boolean;
};

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function advanceDate(date: Date, cycle: Subscription['billingCycle'], anchorDay: number): Date {
  const next = new Date(date);
  if (cycle === 'Weekly') next.setDate(next.getDate() + 7);
  else if (cycle === 'BiWeekly') next.setDate(next.getDate() + 14);
  else if (cycle === 'Monthly') {
    const nextMonth = next.getMonth() + 1;
    const year = next.getFullYear() + Math.floor(nextMonth / 12);
    const month = nextMonth % 12;
    return new Date(year, month, Math.min(anchorDay, daysInMonth(year, month)));
  } else if (cycle === 'Yearly') {
    const year = next.getFullYear() + 1;
    return new Date(year, next.getMonth(), Math.min(anchorDay, daysInMonth(year, next.getMonth())));
  }
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
    const anchorDay = subscription.billingAnchorDay || initial.getDate();
    const subscriptionCurrency = subscription.currency || input.defaultCurrency;
    let iterations = 0;
    let processed = false;
    let lastProcessed = subscription.lastProcessedDate || '';

    while (toLocalYMD(nextDate) <= todayYmd && iterations < 500) {
      const dueYmd = toLocalYMD(nextDate);
      if (!lastProcessed || lastProcessed < dueYmd) {
        const note = `訂閱：${subscription.name}`;
        const exists = [...input.transactions, ...generated].some((transaction) => {
          const sameDate = transactionYmd(transaction) === dueYmd;
          return sameDate && (
            transaction.subscriptionId === subscription.id
            || (
              transaction.amount === subscription.amount
              && transaction.note === note
              && ((transaction.currency as Currency) || input.defaultCurrency) === subscriptionCurrency
            )
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
            currency: subscriptionCurrency,
            tags: ['subscription'],
          });
        }
        processed = true;
        lastProcessed = dueYmd;
      }

      if (subscription.autoRenewal === false) break;
      nextDate = advanceDate(nextDate, subscription.billingCycle, anchorDay);
      iterations += 1;
    }

    if (!processed) return subscription;
    changed = true;
    return {
      ...subscription,
      nextBillingDate: subscription.autoRenewal === false ? '' : toLocalYMD(nextDate),
      lastProcessedDate: lastProcessed,
      currency: subscriptionCurrency,
      billingAnchorDay: anchorDay,
    };
  });

  return { subscriptions: updated, transactions: generated, changed };
}
