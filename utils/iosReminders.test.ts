import { LocalNotifications } from '@capacitor/local-notifications';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOpenCycle } from './creditCardCycles';
import { loadCycles } from './creditCardCycleStorage';
import { getIosNotificationPermission, getUpcomingIosReminders, iosNotificationRoute, iosReminderSchedule, requestIosNotificationPermission, sendIosTestNotification, syncIosReminders } from './iosReminders';
import { DEFAULT_REMINDER_SETTINGS, regenerateReminders, type Reminder, type ReminderType } from './reminders';

vi.mock('./ios', () => ({ isNativeIos: true }));
vi.mock('./creditCardCycleStorage', () => ({ loadCycles: vi.fn(() => []) }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {
  checkPermissions: vi.fn(), requestPermissions: vi.fn(), getPending: vi.fn(), schedule: vi.fn(), cancel: vi.fn(),
} }));

const now = new Date(2026, 0, 1, 12);
const inputs = { creditCards: [], subscriptions: [] };
const sample = (id: string, dueYmd: string, type: ReminderType = 'cc_payment_due'): Reminder => ({
  id, dedupeKey: id, dueYmd, type, title: 'Private details', severity: 'info', status: 'open', createdAt: now.toISOString(),
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: 'granted' });
  vi.mocked(LocalNotifications.getPending).mockResolvedValue({ notifications: [] });
});

describe('iOS reminder schedule', () => {
  it('schedules the statement alert even when the amount due was already entered', () => {
    const card = {
      id: 'card', name: 'Card', annualFee: 0, cashbackType: '', expiryDate: '',
      statementDay: 19, remindStatement: true,
    };
    vi.mocked(loadCycles).mockReturnValueOnce([{
      ...createOpenCycle(card, 2026, 0), amountDueEnteredAt: now.toISOString(),
    }]);
    const settings = { ...DEFAULT_REMINDER_SETTINGS, ccAdvanceDays: 2 };
    const reminders = regenerateReminders({ ...inputs, creditCards: [card], now, scheduleAhead: true, settings });
    expect(reminders.some(item => item.dedupeKey === 'cc_amount_due|card|2026-01')).toBe(false);
    expect(iosReminderSchedule(settings, reminders, now)).toContainEqual(expect.objectContaining({
      title: 'SmartFinance · 信用卡截數提醒',
      schedule: { at: new Date(2026, 0, 17, 20) },
      extra: expect.objectContaining({ path: '/settings/creditcard-cycles' }),
    }));
    const disabled = regenerateReminders({
      ...inputs, creditCards: [{ ...card, remindStatement: false }], now, scheduleAhead: true, settings,
    });
    expect(disabled.some(item => item.type === 'cc_statement')).toBe(false);
  });

  it('uses a daily local-time trigger and keeps unique future card reminders in order', () => {
    const soon = sample('soon', '2026-01-02');
    const later = sample('later', '2026-01-03');
    const notifications = iosReminderSchedule({ ...DEFAULT_REMINDER_SETTINGS, reminderTime: '20:30' }, [
      later, soon, sample('expired', '2025-12-31'), { ...soon },
    ], now);
    expect(notifications.map(item => item.schedule)).toEqual([
      { on: { hour: 20, minute: 30, second: 0 } },
      { at: new Date(2026, 0, 2, 20, 30) },
      { at: new Date(2026, 0, 3, 20, 30) },
    ]);
    expect(new Set(notifications.map(item => item.id)).size).toBe(3);
  });

  it('honors disabled reminders and reserves a system slot for the test notification', () => {
    expect(iosReminderSchedule({ ...DEFAULT_REMINDER_SETTINGS, iosEnabled: false }, [], now)).toEqual([]);
    const cards = Array.from({ length: 100 }, (_, i) => sample(String(i), '2026-01-02'));
    expect(iosReminderSchedule(DEFAULT_REMINDER_SETTINGS, cards, now)).toHaveLength(63);
    expect(iosReminderSchedule({ ...DEFAULT_REMINDER_SETTINGS, enabled: false, dailyEnabled: false }, cards, now)).toEqual([]);
  });

  it('schedules subscriptions before their cutoff and routes budget and backup reminders without exposing financial details', () => {
    const reminders = regenerateReminders({
      ...inputs, now, scheduleAhead: true,
      subscriptions: [{ id: 's', name: 'Private service', billingCycle: 'Monthly', nextBillingDate: '2026-01-25', amount: 10 }],
      budgets: [{ categoryId: 'food', limit: 100, spent: 110 }],
    });
    const notifications = iosReminderSchedule(DEFAULT_REMINDER_SETTINGS, reminders, now);
    const subscription = notifications.find(item => item.extra?.path === '/subscriptions');
    expect(subscription?.schedule?.at).toEqual(new Date(2026, 0, 18, 20));
    expect(subscription?.title).not.toContain('Private service');
    expect(notifications.map(item => item.extra?.path)).toEqual(expect.arrayContaining(['/add', '/budget', '/settings', '/subscriptions']));
    expect(iosNotificationRoute('dismiss', '/budget')).toBeUndefined();
    expect(iosNotificationRoute('tap', 'https://example.com')).toBeUndefined();
    expect(iosNotificationRoute('tap', '/budget')).toBe('/budget');
  });

  it('does not recreate an already delivered budget notification, but does allow snoozing', () => {
    const budget = sample('monthly', '2026-01-01', 'budget_over_limit');
    const [scheduled] = iosReminderSchedule({ ...DEFAULT_REMINDER_SETTINGS, dailyEnabled: false }, [budget], now);
    const settings = { ...DEFAULT_REMINDER_SETTINGS, dailyEnabled: false };
    const nextDay = new Date(2026, 0, 2, 12);
    const history = { [scheduled.extra?.key]: scheduled.schedule!.at!.getTime() };
    expect(iosReminderSchedule(settings, [{ ...budget, dueYmd: '2026-01-02' }], nextDay, history)).toEqual([]);
    expect(iosReminderSchedule(settings, [{ ...budget, dueYmd: '2026-01-03', snoozeUntilYmd: '2026-01-03' }], nextDay, history)).toHaveLength(1);
  });
});

describe('iOS notification bridge', () => {
  it('reports denied permission without requesting it again', async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: 'denied' });
    expect(await getIosNotificationPermission()).toBe('denied');
    expect(await requestIosNotificationPermission()).toBe(false);
    expect(LocalNotifications.requestPermissions).not.toHaveBeenCalled();
  });

  it('lists actual upcoming managed notifications in order, excluding test and past requests', async () => {
    const [daily] = iosReminderSchedule({ ...DEFAULT_REMINDER_SETTINGS, reminderTime: '09:00' }, [], now);
    const request = (id: number, at: string) => ({ id, title: 'Reminder', body: '', schedule: { at: at as unknown as Date } });
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({ notifications: [
      daily, request(4202, '2026-01-01T17:00:00'), request(4201, '2026-01-01T08:00:00'),
      request(4199, '2026-01-01T12:00:05'), request(100, '2026-01-01T13:00:00'),
    ] });
    expect(await getUpcomingIosReminders(now)).toEqual([
      { id: 4202, title: 'Reminder', at: new Date(2026, 0, 1, 17), daily: false },
      { id: 4200, title: 'SmartFinance 記帳提醒', at: new Date(2026, 0, 2, 9), daily: true },
    ]);
  });

  it('requests permission only when prompted and schedules a native test notification', async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValueOnce({ display: 'prompt' });
    vi.mocked(LocalNotifications.requestPermissions).mockResolvedValueOnce({ display: 'granted' });
    expect(await requestIosNotificationPermission()).toBe(true);
    expect(LocalNotifications.requestPermissions).toHaveBeenCalledTimes(1);
    expect(await sendIosTestNotification()).toBe(true);
    expect(LocalNotifications.schedule).toHaveBeenCalledWith({ notifications: [expect.objectContaining({
      title: 'SmartFinance 測試通知', schedule: { at: expect.any(Date) }, extra: { path: '/settings/notifications' },
    })] });
  });

  it('replaces changes, leaves unchanged requests alone, and cancels disabled requests', async () => {
    const settings = { ...DEFAULT_REMINDER_SETTINGS, enabled: false };
    const [daily] = iosReminderSchedule(settings, [], now);
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({ notifications: [daily] });
    expect(await syncIosReminders(inputs, settings)).toBe(1);
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
    await syncIosReminders(inputs, { ...settings, reminderTime: '21:30' });
    expect(LocalNotifications.schedule).toHaveBeenCalledWith({ notifications: [expect.objectContaining({
      id: daily.id, schedule: { on: { hour: 21, minute: 30, second: 0 } },
    })] });
    await syncIosReminders(inputs, { ...settings, dailyEnabled: false });
    expect(LocalNotifications.cancel).toHaveBeenCalledWith({ notifications: [{ id: daily.id }] });
  });
});
