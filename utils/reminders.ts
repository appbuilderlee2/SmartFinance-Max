// utils/reminders.ts

import type { CreditCard } from '../contexts/DataContext';
import type { Subscription } from '../types';
import { loadCycles } from './creditCardCycleStorage';
import { getStatementAndDueForMonth } from './creditCardSchedule';
import { parseLocalYMD, toLocalYMD } from './date';

export type ReminderType =
  | 'cc_amount_due'
  | 'cc_payment_due'
  | 'cc_annual_fee'
  | 'subscription_upcoming'
  | 'backup_export_json';

export type ReminderStatus = 'open' | 'done' | 'dismissed';

export type Reminder = {
  id: string;
  type: ReminderType;
  title: string;
  detail?: string;
  dueYmd: string; // local YYYY-MM-DD
  severity: 'info' | 'warn' | 'urgent';
  status: ReminderStatus;
  createdAt: string; // ISO
  doneAt?: string;
  snoozeUntilYmd?: string;
  action?: {
    kind: 'navigate';
    to: string;
  };
  dedupeKey: string;
};

export type ReminderSettings = {
  // master
  enabled: boolean;

  // credit cards
  ccEnabled: boolean;
  ccAdvanceDays: number; // due reminder lead time, 0..7
  ccAmountEnabled: boolean; // statement+1 amount due entry
  ccFeeEnabled: boolean;

  // subscriptions
  subEnabled: boolean;
  subAheadDays: number; // e.g. 7

  // backup
  backupEnabled: boolean;
  backupEveryDays: number; // e.g. 14
};

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  ccEnabled: true,
  ccAdvanceDays: 0,
  ccAmountEnabled: true,
  ccFeeEnabled: true,
  subEnabled: true,
  subAheadDays: 7,
  backupEnabled: true,
  backupEveryDays: 14,
};

const SETTINGS_KEY = 'sf_reminder_settings_v1';
const REMINDERS_KEY = 'sf_reminders_v1';
const BACKUP_STAMP_KEY = 'sf_last_backup_export_ymd';

export function loadReminderSettings(): ReminderSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_REMINDER_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_REMINDER_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export function saveReminderSettings(s: ReminderSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

export function loadReminders(): Reminder[] {
  try {
    const raw = localStorage.getItem(REMINDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Reminder[];
  } catch {
    return [];
  }
}

export function saveReminders(list: Reminder[]): void {
  try {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function markReminderDone(id: string): void {
  const list = loadReminders();
  const nowIso = new Date().toISOString();
  const next = list.map(r => (r.id === id ? { ...r, status: 'done' as const, doneAt: nowIso } : r));
  saveReminders(next);
}

export function snoozeReminder(id: string, days: number): void {
  const list = loadReminders();
  const r = list.find(x => x.id === id);
  if (!r) return;
  const base = parseLocalYMD(r.dueYmd) ?? new Date();
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  const nextYmd = toLocalYMD(d);
  const next = list.map(x => (x.id === id ? { ...x, snoozeUntilYmd: nextYmd } : x));
  saveReminders(next);
}

export function dismissReminder(id: string): void {
  const list = loadReminders();
  const next = list.map(r => (r.id === id ? { ...r, status: 'dismissed' as const } : r));
  saveReminders(next);
}

function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `r_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function daysBetweenYmd(a: string, b: string): number | null {
  const da = parseLocalYMD(a);
  const db = parseLocalYMD(b);
  if (!da || !db) return null;
  const ms = db.getTime() - da.getTime();
  return Math.round(ms / 86400000);
}

export function getTodayYmd(): string {
  return toLocalYMD(new Date());
}

export function regenerateReminders(params: {
  creditCards: CreditCard[];
  subscriptions: Subscription[];
  now?: Date;
}): Reminder[] {
  const settings = loadReminderSettings();
  if (!settings.enabled) {
    saveReminders([]);
    return [];
  }

  const now = params.now ?? new Date();
  const todayYmd = toLocalYMD(now);

  const existing = loadReminders();
  const existingByKey = new Map(existing.map(r => [r.dedupeKey, r]));

  const out: Reminder[] = [];

  // --- Credit card reminders ---
  if (settings.ccEnabled) {
    const cycles = loadCycles();

    // current + next month (if near month end)
    const months: Array<{ y: number; m0: number }> = [{ y: now.getFullYear(), m0: now.getMonth() }];
    if (now.getDate() >= 25) {
      const n2 = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      months.push({ y: n2.getFullYear(), m0: n2.getMonth() });
    }

    for (const { y, m0 } of months) {
      const yearMonth = `${String(y).padStart(4, '0')}-${String(m0 + 1).padStart(2, '0')}`;

      for (const c of params.creditCards || []) {
        const { statementDate, dueDate } = getStatementAndDueForMonth(y, m0, c as any);

        // statement + 1 day: amount due entry reminder
        if (settings.ccAmountEnabled && c.remindStatement !== false && statementDate) {
          const d = new Date(statementDate + 'T00:00:00');
          d.setDate(d.getDate() + 1);
          const ymdPlus1 = toLocalYMD(d);
          const cycleId = `ccyc_${c.id}_${yearMonth}`;
          const cy = (cycles as any[]).find(x => x.id === cycleId);
          if (!cy?.amountDueEnteredAt) {
            const dedupeKey = `cc_amount_due|${c.id}|${yearMonth}`;
            const prev = existingByKey.get(dedupeKey);
            out.push({
              id: prev?.id ?? uid(),
              type: 'cc_amount_due',
              title: `信用卡應繳金額：${c.name}`,
              detail: `請輸入 ${yearMonth} 本期應繳金額`,
              dueYmd: ymdPlus1,
              severity: 'warn',
              status: prev?.status ?? 'open',
              createdAt: prev?.createdAt ?? new Date().toISOString(),
              doneAt: prev?.doneAt,
              snoozeUntilYmd: prev?.snoozeUntilYmd,
              action: { kind: 'navigate', to: '/settings/creditcard-cycles' },
              dedupeKey,
            });
          }
        }

        // due reminder (due - advanceDays), skip if cycle is closed/paid
        if (c.remindDue !== false && dueDate) {
          const d = new Date(dueDate + 'T00:00:00');
          if (settings.ccAdvanceDays > 0) d.setDate(d.getDate() - settings.ccAdvanceDays);
          const ymd = toLocalYMD(d);

          const cycleId = `ccyc_${c.id}_${yearMonth}`;
          const cy = (cycles as any[]).find(x => x.id === cycleId);
          const isClosed = cy?.status === 'closed' || !!cy?.paidAt;

          if (!isClosed) {
            const dedupeKey = `cc_payment_due|${c.id}|${yearMonth}`;
            const prev = existingByKey.get(dedupeKey);
            const amt = typeof cy?.amountDue === 'number' ? cy.amountDue : null;

            // Severity (option B):
            // - <= 3 days: urgent
            // - <= 7 days: warn
            // - otherwise: info
            const daysToDue = daysBetweenYmd(todayYmd, ymd);
            const severity = daysToDue != null && daysToDue <= 3 ? 'urgent' : daysToDue != null && daysToDue <= 7 ? 'warn' : 'info';

            // Only show amount due if > 0 (avoid "應繳 0")
            const amtSuffix = amt != null && amt > 0 ? `（應繳 ${amt}）` : '';

            out.push({
              id: prev?.id ?? uid(),
              type: 'cc_payment_due',
              title: `信用卡繳費：${c.name}${amtSuffix}`,
              detail: `繳費日：${dueDate}${settings.ccAdvanceDays ? `（提前 ${settings.ccAdvanceDays} 日提醒）` : ''}`,
              dueYmd: ymd,
              severity,
              status: prev?.status ?? 'open',
              createdAt: prev?.createdAt ?? new Date().toISOString(),
              doneAt: prev?.doneAt,
              snoozeUntilYmd: prev?.snoozeUntilYmd,
              action: { kind: 'navigate', to: '/settings/creditcard-cycles' },
              dedupeKey,
            });
          }
        }

        // annual fee reminder
        if (settings.ccFeeEnabled && (Number(c.annualFee) || 0) > 0 && (Number(c.feeMonth) || 0) >= 1) {
          const feeMonth0 = Number(c.feeMonth) - 1;
          if (feeMonth0 === m0) {
            const feeDate = new Date(y, m0, 1);
            const ymd = toLocalYMD(feeDate);
            const dedupeKey = `cc_annual_fee|${c.id}|${y}`;
            const prev = existingByKey.get(dedupeKey);
            out.push({
              id: prev?.id ?? uid(),
              type: 'cc_annual_fee',
              title: `信用卡年費：${c.name}`,
              detail: `本月年費 ${c.annualFee}`,
              dueYmd: ymd,
              severity: 'info',
              status: prev?.status ?? 'open',
              createdAt: prev?.createdAt ?? new Date().toISOString(),
              doneAt: prev?.doneAt,
              snoozeUntilYmd: prev?.snoozeUntilYmd,
              action: { kind: 'navigate', to: '/settings/creditcards' },
              dedupeKey,
            });
          }
        }
      }
    }
  }

  // --- Subscription reminders ---
  if (settings.subEnabled) {
    const ahead = Math.max(0, settings.subAheadDays || 0);

    for (const s of params.subscriptions || []) {
      if (!s.nextBillingDate) continue;
      const due = s.nextBillingDate;
      const days = daysBetweenYmd(todayYmd, due);
      if (days == null) continue;
      if (days < 0 || days > ahead) continue;

      const dedupeKey = `sub_upcoming|${s.id}|${due}`;
      const prev = existingByKey.get(dedupeKey);
      const sev = days <= 1 ? 'urgent' : days <= 3 ? 'warn' : 'info';

      out.push({
        id: prev?.id ?? uid(),
        type: 'subscription_upcoming',
        title: `訂閱即將扣款：${s.name}`,
        detail: `扣款日：${due}（尚餘 ${days} 日）`,
        dueYmd: due,
        severity: sev as any,
        status: prev?.status ?? 'open',
        createdAt: prev?.createdAt ?? new Date().toISOString(),
        doneAt: prev?.doneAt,
        snoozeUntilYmd: prev?.snoozeUntilYmd,
        action: { kind: 'navigate', to: '/subscriptions' },
        dedupeKey,
      });
    }
  }

  // --- Backup reminders ---
  if (settings.backupEnabled) {
    const every = Math.max(1, settings.backupEveryDays || 14);
    const last = localStorage.getItem(BACKUP_STAMP_KEY);
    const lastDt = last ? parseLocalYMD(last) : null;

    let should = false;
    if (!lastDt) {
      should = true;
    } else {
      const diff = daysBetweenYmd(last ?? todayYmd, todayYmd);
      should = diff != null && diff >= every;
    }

    if (should) {
      const dedupeKey = `backup_export_json|${todayYmd}`;
      const prev = existingByKey.get(dedupeKey);
      out.push({
        id: prev?.id ?? uid(),
        type: 'backup_export_json',
        title: '備份提醒：匯出 JSON',
        detail: `建議每 ${every} 日匯出一次備份`,
        dueYmd: todayYmd,
        severity: 'warn',
        status: prev?.status ?? 'open',
        createdAt: prev?.createdAt ?? new Date().toISOString(),
        doneAt: prev?.doneAt,
        snoozeUntilYmd: prev?.snoozeUntilYmd,
        action: { kind: 'navigate', to: '/settings' },
        dedupeKey,
      });
    }
  }

  // Keep only open-ish reminders (but preserve done/dismissed state if still relevant by key)
  // Also apply snooze: if snoozeUntil is in the future, shift dueYmd.
  const normalized = out.map(r => {
    if (r.snoozeUntilYmd) {
      const diff = daysBetweenYmd(todayYmd, r.snoozeUntilYmd);
      if (diff != null && diff > 0) {
        return { ...r, dueYmd: r.snoozeUntilYmd };
      }
    }
    return r;
  });

  // Sort
  normalized.sort((a, b) => {
    const ta = parseLocalYMD(a.dueYmd)?.getTime() ?? 0;
    const tb = parseLocalYMD(b.dueYmd)?.getTime() ?? 0;
    return ta - tb;
  });

  saveReminders(normalized);
  return normalized;
}

export function stampBackupExportToday(): void {
  try {
    localStorage.setItem(BACKUP_STAMP_KEY, getTodayYmd());
  } catch {
    // ignore
  }
}
