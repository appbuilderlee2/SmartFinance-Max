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
  if (transaction.recurrenceOccurrenceDate) return transaction.recurrenceOccurrenceDate;
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
    const template = { ...source, ...source.recurrenceTemplate };
    const start = parseDate(template.date);
    if (!start || !source.recurrence) return;

    const anchorDay = start.getDate();
    let occurrence = advanceOccurrence(start, source.recurrence, anchorDay);
    let steps = 0;

    while (toLocalYMD(occurrence) <= todayYmd && steps < MAX_STEPS_PER_SOURCE) {
      const dueYmd = toLocalYMD(occurrence);
      if (source.recurrenceUntil && dueYmd >= source.recurrenceUntil) break;
      const key = `${source.id}:${dueYmd}`;
      if ((!source.recurrenceFrom || dueYmd >= source.recurrenceFrom) && !existingOccurrences.has(key) && !source.skippedDates?.includes(dueYmd)) {
        generated.push({
          ...template,
          id: input.makeTransactionId(),
          date: dueYmd,
          isRecurring: true,
          recurrence: undefined,
          skippedDates: undefined,
          recurrenceSourceId: source.id,
          recurrenceOccurrenceDate: dueYmd,
          recurrenceTemplate: undefined,
          recurrenceFrom: undefined,
          recurrenceUntil: undefined,
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

export function editRecurringTransactions(rows: Transaction[], id: string, changes: Partial<Transaction>, scope: 'only' | 'future'): Transaction[] {
  const row = rows.find(tx => tx.id === id);
  if (!row) return rows;
  const source = row.recurrenceSourceId ? rows.find(tx => tx.id === row.recurrenceSourceId) : row;
  if (!source?.recurrence) return rows.map(tx => tx.id === id ? { ...tx, ...changes, ...(changes.recurrence ? { recurrenceSourceId: undefined, recurrenceOccurrenceDate: undefined } : {}) } : tx);
  const template = source.recurrenceTemplate || {
    amount: source.amount, date: source.date, note: source.note, categoryId: source.categoryId,
    type: source.type, currency: source.currency, tags: source.tags,
  };
  if (scope === 'only') return rows.map(tx => tx.id !== id ? tx : {
    ...tx, ...changes, recurrence: tx.recurrence,
    isRecurring: true,
    recurrenceFrom: tx.recurrenceFrom,
    recurrenceUntil: tx.recurrenceUntil,
    recurrenceTemplate: row.id === source.id ? template : undefined,
    recurrenceOccurrenceDate: row.recurrenceSourceId ? transactionYmd(row)! : undefined,
  });
  const boundary = row.id === source.id ? toLocalYMD(parseDate(template.date)!) : transactionYmd(row)!;
  if (toLocalYMD(parseDate(changes.date || row.date)!) < boundary) throw new Error('修改本次及以後時，日期不可早於原本期數；如只需移動單次日期，請選「只改本次」。');
  return rows.filter(tx => !(tx.id !== id && tx.recurrenceSourceId === source.id && (transactionYmd(tx) || '') >= boundary)).map(tx => {
    if (tx.id === id) return {
      ...tx, ...changes, recurrenceSourceId: undefined, recurrenceOccurrenceDate: undefined,
      recurrenceTemplate: undefined, recurrenceUntil: source.recurrenceUntil,
      recurrenceFrom: changes.recurrenceFrom,
      skippedDates: source.skippedDates?.filter(day => day >= boundary),
    };
    return tx.id === source.id ? { ...tx, recurrenceUntil: boundary } : tx;
  });
}

export function removeRecurringOccurrence(transactions: Transaction[], id: string): Transaction[] {
  const removed = transactions.find(tx => tx.id === id);
  const date = removed && transactionYmd(removed);
  return transactions.filter(tx => tx.id !== id).map(tx => {
    if (!date || tx.id !== removed?.recurrenceSourceId) return tx;
    return { ...tx, skippedDates: [...new Set([...(tx.skippedDates || []), date])] };
  });
}
