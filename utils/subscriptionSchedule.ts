import { Subscription } from '../types';
import { parseLocalYMD, toLocalYMD } from './date';

export const subscriptionActive = (s: Subscription) => (!s.status || s.status === 'active') && Boolean(s.nextBillingDate);
export const subscriptionAmount = (s: Subscription, day: string) => s.priceChange && day >= s.priceChange.effectiveDate ? s.priceChange.amount : s.amount;
export function advanceSubscriptionDate(date: Date, s: Subscription): Date {
  const next = new Date(date);
  const count = Math.max(1, Math.min(365, Math.floor(s.intervalCount || 1)));
  const days = s.billingCycle === 'Weekly' ? 7 : s.billingCycle === 'BiWeekly' ? 14 : s.billingCycle === 'Custom' && s.intervalUnit === 'days' ? count : 0;
  if (days) { next.setDate(next.getDate() + days); return next; }
  const months = s.billingCycle === 'Yearly' ? 12 : s.billingCycle === 'Custom' ? count : 1;
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  return new Date(target.getFullYear(), target.getMonth(), Math.min(s.billingAnchorDay || date.getDate(), new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()));
}
export function subscriptionForecast(s: Subscription, from: string, end: string): { date: string; amount: number }[] {
  if (!subscriptionActive(s)) return [];
  let date = parseLocalYMD(s.nextBillingDate);
  if (!date) return [];
  if (s.trialEndDate && s.trialEndDate > s.nextBillingDate) date = parseLocalYMD(s.trialEndDate) || date;
  const rows: { date: string; amount: number }[] = [];
  const schedule = { ...s, billingAnchorDay: s.billingAnchorDay || date.getDate() };
  for (let i = 0; i < 5000 && toLocalYMD(date) <= end; i++) {
    const day = toLocalYMD(date);
    if (day >= from && (!s.trialEndDate || day >= s.trialEndDate)) rows.push({ date: day, amount: subscriptionAmount(s, day) });
    if (s.autoRenewal === false) break;
    date = advanceSubscriptionDate(date, schedule);
  }
  return rows;
}
export function subscriptionMonthly(s: Subscription, today: string): number {
  if (!subscriptionActive(s) || s.autoRenewal === false) return 0;
  const amount = subscriptionAmount(s, today);
  if (s.billingCycle === 'Yearly') return amount / 12;
  if (s.billingCycle === 'Weekly') return amount * 52 / 12;
  if (s.billingCycle === 'BiWeekly') return amount * 26 / 12;
  if (s.billingCycle === 'Custom') return s.intervalUnit === 'days' ? amount * 365 / (12 * (s.intervalCount || 1)) : amount / (s.intervalCount || 1);
  return amount;
}
export function subscriptionCycleLabel(s: Subscription): string {
  return s.billingCycle === 'Custom' ? `每 ${s.intervalCount || 1} ${s.intervalUnit === 'days' ? '日' : '個月'}` : ({ Monthly: '每月', Yearly: '每年', Weekly: '每週', BiWeekly: '每兩週' }[s.billingCycle]);
}
