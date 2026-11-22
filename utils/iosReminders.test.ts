import { describe, expect, it } from 'vitest';
import { iosReminderSchedule } from './iosReminders';

describe('iOS reminder schedule', () => {
  const now = new Date(2026, 0, 1, 12);
  const soon = new Date(2026, 0, 2, 12);
  const later = new Date(2026, 0, 3, 12);

  it('uses a daily local-time trigger and keeps unique future card reminders in order', () => {
    const notifications = iosReminderSchedule('20:30', [later, soon, now, new Date(soon)], now);
    expect(notifications.map(item => item.schedule)).toEqual([
      { on: { hour: 20, minute: 30, second: 0 } }, { at: soon }, { at: later },
    ]);
    expect(new Set(notifications.map(item => item.id)).size).toBe(3);
  });

  it('supports clearing all reminders and reserves a slot for daily reminders when capped', () => {
    expect(iosReminderSchedule(null, [], now)).toEqual([]);
    const dates = Array.from({ length: 100 }, (_, i) => new Date(2026, 0, i + 2, 12));
    expect(iosReminderSchedule('20:00', dates, now)).toHaveLength(64);
    expect(iosReminderSchedule('25:00', [], now)).toEqual([]);
  });
});
