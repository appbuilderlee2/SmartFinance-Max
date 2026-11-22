import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { parseLocalYMD, toLocalYMD } from './date';
import { isNativeIos } from './ios';
import { loadReminderSettings, regenerateReminders, type Reminder, type ReminderSettings, type ReminderType } from './reminders';

const FIRST_ID = 4200;
const MAX_COUNT = 64;
const MAX_REMINDERS = MAX_COUNT - 1;
const TEST_ID = 4199;
const HISTORY_KEY = 'ios-notification-history-v1';
const routes: Record<ReminderType, string> = {
  cc_amount_due: '/settings/creditcard-cycles',
  cc_payment_due: '/settings/creditcard-cycles',
  cc_annual_fee: '/settings/creditcards',
  subscription_upcoming: '/subscriptions',
  budget_near_limit: '/budget',
  budget_over_limit: '/budget',
  backup_export_json: '/settings',
};
const titles: Record<ReminderType, string> = {
  cc_amount_due: '信用卡應繳金額提醒',
  cc_payment_due: '信用卡繳費提醒',
  cc_annual_fee: '信用卡年費提醒',
  subscription_upcoming: '訂閱扣款提醒',
  budget_near_limit: '預算接近上限',
  budget_over_limit: '預算已超支',
  backup_export_json: '備份提醒',
};
const targets = new Set([...Object.values(routes), '/add', '/settings/notifications']);
type History = Record<string, number>;
type Inputs = Pick<Parameters<typeof regenerateReminders>[0], 'creditCards' | 'subscriptions' | 'budgets' | 'categories' | 'currency'>;

export function iosNotificationRoute(actionId: string, path: unknown): string | undefined {
  return actionId === 'tap' && typeof path === 'string' && targets.has(path) ? path : undefined;
}

export function iosReminderSchedule(
  settings: ReminderSettings, reminders: Reminder[], now = new Date(), history: History = {},
): LocalNotificationSchema[] {
  if (!settings.iosEnabled) return [];
  const notifications: LocalNotificationSchema[] = [];
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(settings.reminderTime) ? settings.reminderTime : '20:00';
  const [hour, minute] = time.split(':').map(Number);
  if (settings.dailyEnabled) {
    notifications.push({
      id: FIRST_ID, title: 'SmartFinance 記帳提醒', body: '記得記錄今日嘅收支。',
      schedule: { on: { hour, minute, second: 0 } },
      extra: { signature: `daily|${time}`, path: '/add' },
    });
  }

  const due = new Map<string, { reminder: Reminder; at: number }>();
  for (const reminder of settings.enabled ? reminders : []) {
    if (reminder.status !== 'open') continue;
    const date = parseLocalYMD(reminder.dueYmd);
    if (!date || (reminder.type.startsWith('cc_') && reminder.dueYmd < toLocalYMD(now))) continue;
    date.setHours(hour, minute, 0, 0);
    const key = JSON.stringify([reminder.dedupeKey, reminder.snoozeUntilYmd, reminder.type.startsWith('cc_') ? reminder.dueYmd : null]);
    const previous = history[key];
    if (previous && previous <= now.getTime()) continue;
    const at = date.getTime() > now.getTime() + 1_000 ? date.getTime() : previous ?? now.getTime() + 5_000;
    due.set(key, { reminder, at });
  }

  [...due].sort(([ka, a], [kb, b]) => a.at - b.at || ka.localeCompare(kb))
    .slice(0, MAX_REMINDERS - notifications.length)
    .forEach(([key, { reminder, at }]) => notifications.push({
      id: FIRST_ID + notifications.length,
      title: `SmartFinance · ${titles[reminder.type]}`,
      body: '打開 App 查看詳情。',
      schedule: { at: new Date(at) },
      extra: { key, signature: JSON.stringify([key, at]), path: routes[reminder.type] },
    }));
  return notifications;
}

function readHistory(): History {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}'); }
  catch { return {}; }
}

function writeHistory(history: History): void {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }
  catch { /* System pending notifications still prevent duplicate scheduling. */ }
}

let pendingSync = Promise.resolve<unknown>(undefined);
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = pendingSync.then(work);
  pendingSync = next.catch(() => undefined);
  return next;
}

function managed(id: number): boolean {
  return id >= FIRST_ID && id < FIRST_ID + MAX_COUNT;
}

async function updatePending(desired: LocalNotificationSchema[]): Promise<void> {
  const { notifications } = await LocalNotifications.getPending();
  const pending = new Map(notifications.filter(({ id }) => managed(id)).map(item => [item.id, item]));
  const desiredIds = new Set(desired.map(item => item.id));
  const remove = [...pending.keys()].filter(id => !desiredIds.has(id)).map(id => ({ id }));
  const schedule = desired.filter(item => pending.get(item.id)?.extra?.signature !== item.extra?.signature);
  if (remove.length) await LocalNotifications.cancel({ notifications: remove });
  if (schedule.length) await LocalNotifications.schedule({ notifications: schedule });
}

export function clearIosReminders(): Promise<void> {
  if (!isNativeIos) return Promise.resolve();
  return serialize(async () => {
    await updatePending([]);
    await LocalNotifications.cancel({ notifications: [{ id: TEST_ID }] });
    writeHistory({});
  });
}

export async function requestIosNotificationPermission(): Promise<boolean> {
  const { display } = await LocalNotifications.checkPermissions();
  return display === 'granted' || (display === 'prompt' && (await LocalNotifications.requestPermissions()).display === 'granted');
}

export function syncIosReminders(inputs: Inputs, settings?: ReminderSettings): Promise<number> {
  if (!isNativeIos) return Promise.resolve(0);
  return serialize(async () => {
    const preferences = settings ?? loadReminderSettings();
    const now = new Date();
    const prior = readHistory();
    const cutoff = now.getTime() - 400 * 86_400_000;
    const history = Object.fromEntries(Object.entries(prior).filter(([, time]) => time >= cutoff && time <= now.getTime()));
    if ((await LocalNotifications.checkPermissions()).display !== 'granted' || !preferences.iosEnabled) {
      await updatePending([]);
      writeHistory(history);
      return 0;
    }
    const reminders = regenerateReminders({ ...inputs, now, scheduleAhead: true, settings: preferences });
    const notifications = iosReminderSchedule(preferences, reminders, now, prior);
    await updatePending(notifications);
    for (const item of notifications) {
      if (item.extra?.key && item.schedule?.at) history[item.extra.key] = item.schedule.at.getTime();
    }
    writeHistory(history);
    return notifications.length;
  });
}

export async function sendIosTestNotification(): Promise<boolean> {
  if (!await requestIosNotificationPermission()) return false;
  await LocalNotifications.schedule({ notifications: [{
    id: TEST_ID,
    title: 'SmartFinance 測試通知',
    body: '你已成功開啟 iPhone 通知。',
    schedule: { at: new Date(Date.now() + 5_000) },
    extra: { path: '/settings/notifications' },
  }] });
  return true;
}
