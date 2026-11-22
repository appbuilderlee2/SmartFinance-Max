import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { isNativeIos } from './ios';

const FIRST_ID = 4200;
const MAX_COUNT = 64;

export function iosReminderSchedule(dailyTime: string | null, cardDates: Date[], now = new Date()): LocalNotificationSchema[] {
  const notifications: LocalNotificationSchema[] = [];
  if (dailyTime && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(dailyTime)) {
    const [hour, minute] = dailyTime.split(':').map(Number);
    notifications.push({
      id: FIRST_ID,
      title: 'SmartFinance 記帳提醒',
      body: '記得記錄今日嘅收支。',
      schedule: { on: { hour, minute, second: 0 } },
    });
  }
  const upcoming = [...new Set(cardDates.map(date => date.getTime()))]
    .filter(time => time > now.getTime() + 1000)
    .sort((a, b) => a - b)
    .slice(0, MAX_COUNT - notifications.length);
  upcoming.forEach(time => notifications.push({
    id: FIRST_ID + notifications.length,
    title: 'SmartFinance 信用卡提醒',
    body: '請打開 App 查看信用卡提醒。',
    schedule: { at: new Date(time) },
  }));
  return notifications;
}

export async function clearIosReminders(): Promise<void> {
  if (!isNativeIos) return;
  const { notifications } = await LocalNotifications.getPending();
  const scheduled = notifications.filter(({ id }) => id >= FIRST_ID && id < FIRST_ID + MAX_COUNT);
  if (scheduled.length) await LocalNotifications.cancel({ notifications: scheduled.map(({ id }) => ({ id })) });
}

export async function applyIosReminders(notifications: LocalNotificationSchema[]): Promise<boolean> {
  if (notifications.length) {
    const permission = await LocalNotifications.checkPermissions();
    const display = permission.display === 'granted' || permission.display === 'denied'
      ? permission.display
      : (await LocalNotifications.requestPermissions()).display;
    if (display !== 'granted') return false;
  }
  await clearIosReminders();
  if (notifications.length) await LocalNotifications.schedule({ notifications });
  return true;
}
