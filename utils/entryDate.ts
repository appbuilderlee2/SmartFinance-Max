import { parseLocalYMD, toLocalYMD } from './date';

export function resolveEntryDate(date?: string, mode?: 'today' | 'manual', now = new Date()): string {
  return mode === 'manual' && date && parseLocalYMD(date) ? date : toLocalYMD(now);
}
