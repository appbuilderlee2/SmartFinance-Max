import { RecurrenceFrequency, Transaction } from '../types';
import { parseDate, toLocalYMD } from './date';

type ProcessInput = {
  transactions: Transaction[];
  today?: Date;
  makeTransactionId: () => string;
};

type ProcessResult = {
  transactions: Transaction[];
  changed: boolean;
};

const MAX_STEPS_PER_SOURCE = 5000;

export const RECURRENCE_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: '每週',
  biweekly: '每2週',
  monthly: '每月',
};

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function advanceOccurrence(date: Date, frequency: RecurrenceFrequency, anchorDay: number): Date {
  if (frequency === 'weekly' || frequency === 'biweekly') {
    const next = new Date(date);
    next.setDate(next.getDate() + (frequency === 'weekly' ? 7 : 14));
    return next;
  }

  const nextMonth = date.getMonth() + 1;
  const year = date.getFullYear() + Math.floor(nextMonth / 12);
  const month = ((nextMonth % 12) + 12) % 12;
  return new Date(year, month, Math.min(anchorDay, daysInMonth(year, month)));
}

function transactionYmd(transaction: Transaction): string | null {
  const date = parseDate(transaction.date);
  return date ? toLocalYMD(date) : null;
}

export function processDueRecurringTransactions(input: ProcessInput): ProcessResult {
  const todayYmd = toLocalYMD(input.today || new Date());
  const generated: Transaction[] = [];
  const existingOccurrences = new Set<string>();

  input.transactions.forEach((transaction) => {
    if (!transaction.recurrenceSourceId) return;
    const ymd = transactionYmd(transaction);
    if (ymd) existingOccurrences.add(`${transaction.recurrenceSourceId}:${ymd}`);
  });

  const sources = input.transactions.filter(
    (transaction) => transaction.recurrence && !transaction.recurrenceSourceId,
  );

  sources.forEach((source) => {
    const start = parseDate(source.date);
    if (!start || !source.recurrence) return;

    const anchorDay = start.getDate();
    let occurrence = advanceOccurrence(start, source.recurrence, anchorDay);
    let steps = 0;

    while (toLocalYMD(occurrence) <= todayYmd && steps < MAX_STEPS_PER_SOURCE) {
      const dueYmd = toLocalYMD(occurrence);
      const key = `${source.id}:${dueYmd}`;
      if (!existingOccurrences.has(key)) {
        generated.push({
          ...source,
          id: input.makeTransactionId(),
          date: dueYmd,
          isRecurring: true,
          recurrence: undefined,
          recurrenceSourceId: source.id,
          receiptUrl: undefined,
          subscriptionId: undefined,
        });
        existingOccurrences.add(key);
      }
      occurrence = advanceOccurrence(occurrence, source.recurrence, anchorDay);
      steps += 1;
    }
  });

  return { transactions: generated, changed: generated.length > 0 };
}
