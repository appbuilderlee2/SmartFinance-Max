import { Subscription } from '../types';
import { subscriptionForecast } from './subscriptionSchedule';
import { toLocalYMD } from './date';

export function subscriptionCalendar(s: Subscription, now = new Date()): string {
  const end = new Date(now); end.setFullYear(end.getFullYear() + 1);
  const escape = (v: string) => v.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const events = subscriptionForecast(s, toLocalYMD(now), toLocalYMD(end)).map(row => ['BEGIN:VEVENT', `UID:${escape(s.id)}-${row.date}@smartfinance`, `DTSTAMP:${now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`, `DTSTART;VALUE=DATE:${row.date.replace(/-/g,'')}`, `SUMMARY:${escape(s.name)} · ${s.currency || ''} ${row.amount}`, 'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${escape(s.name)} 扣款提醒`, 'END:VALARM', 'END:VEVENT'].join('\r\n'));
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SmartFinance//Subscriptions//ZH','CALSCALE:GREGORIAN', ...events,'END:VCALENDAR',''].join('\r\n');
}
export function downloadSubscriptionCalendar(s: Subscription): void {
  const url = URL.createObjectURL(new Blob([subscriptionCalendar(s)], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = 'subscription-reminders.ics'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
