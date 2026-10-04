import { AnnualReserve, Currency, Transaction, TransactionType } from '../types';
import { parseDate, parseLocalYMD, toLocalYMD } from './date';
import { fromMinorUnits, parseMoneyInput, toMinorUnits } from './money';

export const RESERVES_KEY = 'smartfinance_annual_reserves';
export function validateReserve(plan: AnnualReserve) {
  if (!plan || typeof plan.id !== 'string' || !plan.id.trim() || typeof plan.name !== 'string' || !plan.name.trim() || plan.name.length > 80 || !Object.values(Currency).includes(plan.currency) || !parseLocalYMD(plan.dueDate)) throw new Error('請輸入有效名稱、幣別及到期日');
  for (const value of [plan.target, plan.reserved]) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || parseMoneyInput(String(value), plan.currency) === null) throw new Error('預留金額不正確');
  }
  if (plan.target <= 0) throw new Error('目標金額必須大於零');
}
export function reserveProgress(plan: AnnualReserve, today: string) {
  validateReserve(plan);
  const due = parseLocalYMD(plan.dueDate)!, now = parseLocalYMD(today);
  if (!now) throw new Error('日期不正確');
  const remaining = Math.max(0, toMinorUnits(plan.target, plan.currency) - toMinorUnits(plan.reserved, plan.currency));
  // Include this month, exclude the due month: funds should be ready before payment.
  const months = Math.max(1, (due.getFullYear() - now.getFullYear()) * 12 + due.getMonth() - now.getMonth());
  return { remaining: fromMinorUnits(remaining, plan.currency), monthly: fromMinorUnits(Math.ceil(remaining / months), plan.currency), months, overdue: plan.dueDate < today, percent: Math.min(100, plan.reserved / plan.target * 100) };
}
export function nextAnnualDate(value: string) {
  const date = parseLocalYMD(value);
  if (!date) throw new Error('日期不正確');
  const year = date.getFullYear() + 1, month = date.getMonth();
  return toLocalYMD(new Date(year, month, Math.min(date.getDate(), new Date(year, month + 1, 0).getDate())));
}
export function incomeBySource(transactions: Transaction[], month: string, currency: Currency, fallback: Currency) {
  const groups = new Map<string, { source: string; minor: number; rows: Transaction[] }>();
  for (const tx of transactions) {
    const date = parseDate(tx.date);
    if (tx.type !== TransactionType.INCOME || (tx.currency || fallback) !== currency || !date || toLocalYMD(date).slice(0, 7) !== month) continue;
    const source = tx.incomeSource?.trim() || '未指定來源';
    const group = groups.get(source) || { source, minor: 0, rows: [] };
    group.minor += toMinorUnits(tx.amount, currency); group.rows.push(tx); groups.set(source, group);
  }
  const total = [...groups.values()].reduce((sum, group) => sum + group.minor, 0);
  return { total: fromMinorUnits(total, currency), groups: [...groups.values()].sort((a, b) => b.minor - a.minor).map(group => ({ source: group.source, amount: fromMinorUnits(group.minor, currency), share: total ? group.minor / total * 100 : 0, rows: group.rows.sort((a,b) => b.date.localeCompare(a.date)) })) };
}
