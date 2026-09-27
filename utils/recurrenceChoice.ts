import { Transaction } from '../types';
import { processDueRecurringTransactions } from './recurringTransactions';
import { parseDate, toLocalYMD } from './date';
import { showAppChoice } from './appDialog';

export async function chooseRecurrenceStart(row: Transaction, existing: Transaction[]): Promise<string | undefined | null> {
  if (!row.recurrence) return undefined;
  const today = new Date();
  const due = processDueRecurringTransactions({ transactions: [row], today, makeTransactionId: () => 'preview' }).transactions;
  if (!due.length) return undefined;
  const possibleDuplicates = due.filter(item => existing.some(tx => tx.type === item.type && tx.categoryId === item.categoryId && tx.amount === item.amount && tx.currency === item.currency && toLocalYMD(parseDate(tx.date)!) === item.date)).length;
  const choice = await showAppChoice(`按此日期及週期，會額外補建 ${due.length} 筆帳目。${possibleDuplicates ? `其中 ${possibleDuplicates} 期已有相同日期、分類、幣別及金額的帳目，可能重複。` : ''}\n請選擇開始方式。`, [
    { label: '只由下一期開始', value: 'next' },
    { label: `補建 ${due.length} 筆`, value: 'backfill' },
  ], '週期帳目預覽');
  if (choice === null) return null;
  if (choice === 'backfill') return undefined;
  today.setDate(today.getDate() + 1);
  return toLocalYMD(today);
}
