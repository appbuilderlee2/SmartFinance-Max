import { Transaction } from '../types';
import { parseDate, toLocalYMD } from './date';
export interface DeletedTransaction { row: Transaction; addedSkip: string | null; }
export function captureDeletion(rows: Transaction[], id: string): DeletedTransaction | null {
  const row = rows.find(tx => tx.id === id);
  if (!row) return null;
  const source = rows.find(tx => tx.id === row.recurrenceSourceId);
  const date = parseDate(row.date);
  const ymd = date ? toLocalYMD(date) : null;
  return { row, addedSkip: source && ymd && !source.skippedDates?.includes(ymd) ? ymd : null };
}
export function restoreDeletion(rows: Transaction[], deleted: DeletedTransaction): Transaction[] {
  if (rows.some(tx => tx.id === deleted.row.id)) return rows;
  return [deleted.row, ...rows.map(tx => tx.id === deleted.row.recurrenceSourceId && deleted.addedSkip
    ? { ...tx, skippedDates: tx.skippedDates?.filter(date => date !== deleted.addedSkip) } : tx)];
}
