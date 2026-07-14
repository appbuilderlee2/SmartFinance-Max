import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CalendarCheck } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { getStatementAndDueForMonth } from '../utils/creditCardSchedule';
import { loadCycles } from '../utils/creditCardCycleStorage';
import {
  DEFAULT_REMINDER_SETTINGS,
  loadReminderSettings,
  markReminderDone,
  regenerateReminders,
  saveReminderSettings,
  snoozeReminder,
  stampBackupExportToday,
  type Reminder,
  type ReminderSettings,
} from '../utils/reminders';

const NotificationSettings: React.FC = () => {
  const navigate = useNavigate();
  const { creditCards, subscriptions } = useData();

  const [enabled, setEnabled] = useState(true);
  const [time, setTime] = useState("20:00");

  const [ccEnabled, setCcEnabled] = useState(true);
  const [ccAdvanceDays, setCcAdvanceDays] = useState(0); // 0 = on the day

  const [ccAmountRemindEnabled, setCcAmountRemindEnabled] = useState(true); // 截數後 +1 日：提醒輸入應繳金額
  const [ccFeeRemindEnabled, setCcFeeRemindEnabled] = useState(true); // 年費提醒

  // keep setters "used" (these toggles will be rendered later)
  void setCcAmountRemindEnabled;
  void setCcFeeRemindEnabled;

  // Reminder Center settings
  const [remSettings, setRemSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    const s = loadReminderSettings();
    // keep in sync with existing credit card toggles
    setRemSettings(s);
  }, []);

  // Sync Reminder Center settings with existing ICS toggles
  useEffect(() => {
    setRemSettings(prev => ({
      ...prev,
      enabled,
      ccEnabled,
      ccAdvanceDays,
      ccAmountEnabled: ccAmountRemindEnabled,
      ccFeeEnabled: ccFeeRemindEnabled,
    }));
  }, [enabled, ccEnabled, ccAdvanceDays, ccAmountRemindEnabled, ccFeeRemindEnabled]);

  useEffect(() => {
    // persist settings whenever changed
    saveReminderSettings(remSettings);
  }, [remSettings]);

  const refreshReminders = () => {
    const list = regenerateReminders({ creditCards: creditCards || [], subscriptions: subscriptions || [] });
    setReminders(list);
  };

  useEffect(() => {
    // generate on load and whenever inputs change
    refreshReminders();
  }, [
    creditCards,
    subscriptions,
    remSettings.enabled,
    remSettings.ccEnabled,
    remSettings.ccAdvanceDays,
    remSettings.ccAmountEnabled,
    remSettings.ccFeeEnabled,
    remSettings.subEnabled,
    remSettings.subAheadDays,
    remSettings.backupEnabled,
    remSettings.backupEveryDays,
  ]);

  // Format date for ICS (YYYYMMDDTHHMMSS)
  const formatICSDate = (date: Date) => {
    // Keep UTC format; iOS Calendar handles Z-formatted timestamps fine.
    return date.toISOString().replace(/-|:|\.\d+/g, '');
  };

  // Build credit card reminders for the current month (and next month if needed)
  const creditCardEvents = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m0 = now.getMonth();

    const makeEvent = (summary: string, ymd: string) => {
      const [hh, mm] = time.split(':').map(Number);
      const dt = new Date(ymd + 'T00:00:00');
      dt.setHours(hh, mm, 0, 0);
      // advanceDays: subtract days
      if (ccAdvanceDays > 0) dt.setDate(dt.getDate() - ccAdvanceDays);
      return {
        uid: `${Date.now()}-${Math.random().toString(36).slice(2)}@smartfinance.app`,
        dt,
        summary,
      };
    };

    const events: { uid: string; dt: Date; summary: string }[] = [];

    // Load cycles to include amount-due info (best-effort; remains local-only)
    const cycles = loadCycles();

    for (const c of creditCards || []) {
      const { statementDate, dueDate } = getStatementAndDueForMonth(y, m0, c);
      if (c.remindStatement !== false && statementDate) {
        events.push(makeEvent(`信用卡截數提醒：${c.name}`, statementDate));

        // 1B: statement + 1 day => remind user to enter amount due
        if (ccAmountRemindEnabled) {
          const d = new Date(statementDate + 'T00:00:00');
          d.setDate(d.getDate() + 1);
          const ymdPlus1 = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          // If already entered amount due for this month, skip
          const cycleId = `ccyc_${c.id}_${String(y).padStart(4, '0')}-${String(m0 + 1).padStart(2, '0')}`;
          const cy = cycles.find(x => x.id === cycleId);
          if (!cy?.amountDueEnteredAt) {
            events.push(makeEvent(`信用卡應繳金額：${c.name}（請輸入本期應繳）`, ymdPlus1));
          }
        }
      }

      if (c.remindDue !== false && dueDate) {
        // If amount due exists in cycle, show it in summary
        const cycleId = `ccyc_${c.id}_${String(y).padStart(4, '0')}-${String(m0 + 1).padStart(2, '0')}`;
        const cy = cycles.find(x => x.id === cycleId);
        const amt = typeof cy?.amountDue === 'number' ? cy.amountDue : null;
        const suffix = amt != null ? `（應繳 ${amt}）` : '';
        events.push(makeEvent(`信用卡繳費提醒：${c.name}${suffix}`, dueDate));
      }

      // Annual fee reminder (3A: feeMonth day 1)
      if (ccFeeRemindEnabled && (Number(c.annualFee) || 0) > 0 && (Number(c.feeMonth) || 0) >= 1) {
        const feeMonth0 = Number(c.feeMonth) - 1;
        if (feeMonth0 === m0) {
          const feeDate = new Date(y, m0, 1);
          const ymdFee = `${feeDate.getFullYear()}-${String(feeDate.getMonth() + 1).padStart(2,'0')}-${String(feeDate.getDate()).padStart(2,'0')}`;
          events.push(makeEvent(`信用卡年費提醒：${c.name}（年費 ${c.annualFee}）`, ymdFee));
        }
      }
    }

    // If today is near end of month and user wants reminders, also include next month (helps planning)
    if (now.getDate() >= 25) {
      const next = new Date(y, m0 + 1, 1);
      const y2 = next.getFullYear();
      const m2 = next.getMonth();
      for (const c of creditCards || []) {
        const { statementDate, dueDate } = getStatementAndDueForMonth(y2, m2, c);

        if (c.remindStatement !== false && statementDate) {
          events.push(makeEvent(`信用卡截數提醒：${c.name}`, statementDate));

          // 1B: statement + 1 day => remind user to enter amount due
          if (ccAmountRemindEnabled) {
            const d = new Date(statementDate + 'T00:00:00');
            d.setDate(d.getDate() + 1);
            const ymdPlus1 = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const cycleId = `ccyc_${c.id}_${String(y2).padStart(4, '0')}-${String(m2 + 1).padStart(2, '0')}`;
            const cy = cycles.find(x => x.id === cycleId);
            if (!cy?.amountDueEnteredAt) {
              events.push(makeEvent(`信用卡應繳金額：${c.name}（請輸入本期應繳）`, ymdPlus1));
            }
          }
        }

        if (c.remindDue !== false && dueDate) {
          const cycleId = `ccyc_${c.id}_${String(y2).padStart(4, '0')}-${String(m2 + 1).padStart(2, '0')}`;
          const cy = cycles.find(x => x.id === cycleId);
          const amt = typeof cy?.amountDue === 'number' ? cy.amountDue : null;
          const suffix = amt != null ? `（應繳 ${amt}）` : '';
          events.push(makeEvent(`信用卡繳費提醒：${c.name}${suffix}`, dueDate));
        }

        // 3A: annual fee reminder at feeMonth day 1
        if (ccFeeRemindEnabled && (Number(c.annualFee) || 0) > 0 && (Number(c.feeMonth) || 0) >= 1) {
          const feeMonth0 = Number(c.feeMonth) - 1;
          if (feeMonth0 === m2) {
            const feeDate = new Date(y2, m2, 1);
            const ymdFee = `${feeDate.getFullYear()}-${String(feeDate.getMonth() + 1).padStart(2,'0')}-${String(feeDate.getDate()).padStart(2,'0')}`;
            events.push(makeEvent(`信用卡年費提醒：${c.name}（年費 ${c.annualFee}）`, ymdFee));
          }
        }
      }
    }

    // De-dupe by summary+date
    const seen = new Set<string>();
    return events
      .filter(e => {
        const key = `${e.summary}|${e.dt.toISOString()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.dt.getTime() - b.dt.getTime());
  }, [creditCards, time, ccAdvanceDays]);

  // Function to generate and download ICS file for iOS Calendar
  const addToCalendar = () => {
    // Construct the event start date (today at the selected time)
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    now.setHours(hours, minutes, 0);

    const events: string[] = [];

    // Daily bookkeeping reminder (optional)
    if (enabled) {
      events.push(
        [
          'BEGIN:VEVENT',
          `UID:${Date.now()}@smartfinance.app`,
          `DTSTAMP:${formatICSDate(new Date())}`,
          `DTSTART:${formatICSDate(now)}`,
          'RRULE:FREQ=DAILY',
          'SUMMARY:SmartFinance 記帳提醒',
          'DESCRIPTION:記得記錄今天的收支喔！保持良好的理財習慣。',
          'BEGIN:VALARM',
          'TRIGGER:-PT5M',
          'ACTION:DISPLAY',
          'DESCRIPTION:Reminder',
          'END:VALARM',
          'END:VEVENT'
        ].join('\r\n')
      );
    }

    // Credit card reminders (non-recurring events for this month/next month)
    if (ccEnabled && creditCardEvents.length) {
      for (const e of creditCardEvents) {
        events.push(
          [
            'BEGIN:VEVENT',
            `UID:${e.uid}`,
            `DTSTAMP:${formatICSDate(new Date())}`,
            `DTSTART:${formatICSDate(e.dt)}`,
            'SUMMARY:' + e.summary,
            'BEGIN:VALARM',
            'TRIGGER:-PT5M',
            'ACTION:DISPLAY',
            'DESCRIPTION:Reminder',
            'END:VALARM',
            'END:VEVENT'
          ].join('\r\n')
        );
      }
    }

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SmartFinance//App//EN',
      ...events,
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'smartfinance-reminders.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-background pt-safe-top">
      <div className="px-4 py-3 flex justify-between items-center sf-topbar sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="flex items-center text-primary">
          <ChevronLeft size={24} />
          <span>設定</span>
        </button>
        <h2 className="text-lg font-semibold">通知設定</h2>
        <div className="w-16"></div>
      </div>

      <div className="p-4 mt-2 space-y-6">
         {/* Reminder Center */}
         <div>
            <p className="text-gray-500 text-xs mb-2 ml-4">提醒中心</p>
            <div className="sf-panel overflow-hidden divide-y sf-divider">
               <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                     <div className="text-white font-medium">未處理提醒</div>
                     <button
                        type="button"
                        onClick={refreshReminders}
                        className="text-xs text-primary"
                     >
                        重新計算
                     </button>
                  </div>
                  {(() => {
                     const open = reminders.filter(r => r.status === 'open');
                     const today = new Date();
                     const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
                     const dueToday = open.filter(r => r.dueYmd === todayYmd).length;
                     const within7 = open.filter(r => {
                        const a = new Date(r.dueYmd + 'T00:00:00');
                        const b = new Date(todayYmd + 'T00:00:00');
                        const diff = Math.round((a.getTime() - b.getTime()) / 86400000);
                        return diff >= 0 && diff <= 7;
                     }).length;
                     return (
                        <div className="grid grid-cols-3 gap-2 text-xs">
                           <div className="bg-background/50 rounded-lg p-2">
                              <div className="text-gray-500">總數</div>
                              <div className="text-white font-semibold">{open.length}</div>
                           </div>
                           <div className="bg-background/50 rounded-lg p-2">
                              <div className={dueToday > 0 ? 'text-red-400 font-semibold' : 'text-gray-500'}>今日</div>
                              <div className={dueToday > 0 ? 'text-red-400 font-bold text-base' : 'text-white font-semibold'}>{dueToday}</div>
                           </div>
                           <div className="bg-background/50 rounded-lg p-2">
                              <div className={within7 > 0 ? 'text-red-400 font-semibold' : 'text-gray-500'}>7日內</div>
                              <div className={within7 > 0 ? 'text-red-400 font-bold text-base' : 'text-white font-semibold'}>{within7}</div>
                           </div>
                        </div>
                     );
                  })()}
               </div>

               <div className="p-4 space-y-2">
                  {/* Toggles */}
                  <div className="flex items-center justify-between">
                     <span className="text-white">開啟提醒中心</span>
                     <div
                        onClick={() => setRemSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                        className={`w-12 h-7 rounded-full relative cursor-pointer transition-colors ${remSettings.enabled ? 'bg-green-500' : 'bg-gray-600'}`}
                     >
                        <div className={`w-6 h-6 bg-white rounded-full absolute top-0.5 shadow-md transition-all ${remSettings.enabled ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                     </div>
                  </div>

                  {remSettings.enabled && (
                     <>
                        <div className="flex items-center justify-between">
                           <span className="text-gray-200">訂閱提醒（提前）</span>
                           <select
                              value={remSettings.subAheadDays}
                              onChange={(e) => setRemSettings(prev => ({ ...prev, subAheadDays: Number(e.target.value), subEnabled: true }))}
                              className="bg-transparent text-right text-gray-400 focus:outline-none cursor-pointer"
                           >
                              <option value={3}>3 日</option>
                              <option value={5}>5 日</option>
                              <option value={7}>7 日</option>
                              <option value={14}>14 日</option>
                           </select>
                        </div>
                        <div className="flex items-center justify-between">
                           <span className="text-gray-200">備份提醒（每）</span>
                           <select
                              value={remSettings.backupEveryDays}
                              onChange={(e) => setRemSettings(prev => ({ ...prev, backupEveryDays: Number(e.target.value), backupEnabled: true }))}
                              className="bg-transparent text-right text-gray-400 focus:outline-none cursor-pointer"
                           >
                              <option value={7}>7 日</option>
                              <option value={14}>14 日</option>
                              <option value={30}>30 日</option>
                           </select>
                        </div>
                     </>
                  )}
               </div>

               {/* List */}
               <div className="p-4">
                  {!remSettings.enabled ? (
                     <p className="text-xs text-gray-500">提醒中心已關閉</p>
                  ) : reminders.filter(r => r.status === 'open').length === 0 ? (
                     <p className="text-xs text-gray-500">暫時未有提醒</p>
                  ) : (
                     <div className="space-y-2">
                        {reminders.filter(r => r.status === 'open').map((r) => (
                           <div key={r.id} className={`bg-background/40 rounded-lg p-3 ${r.severity === 'urgent' ? 'border border-red-500/40' : r.severity === 'warn' ? 'border border-yellow-500/30' : ''}`}>
                              <div className="flex items-start justify-between gap-3">
                                 <div className="min-w-0">
                                    <div className="text-white text-sm font-medium truncate">{r.title}</div>
                                    <div className={r.severity === 'urgent' ? 'text-xs text-red-300 mt-0.5' : r.severity === 'warn' ? 'text-xs text-yellow-200 mt-0.5' : 'text-xs text-gray-400 mt-0.5'}>
                                       {r.dueYmd}{r.detail ? ` · ${r.detail}` : ''}
                                    </div>
                                 </div>
                                 <div className="shrink-0 text-xs">
                                    <span className={r.severity === 'urgent' ? 'text-red-400' : r.severity === 'warn' ? 'text-yellow-400' : 'text-gray-400'}>
                                       {r.severity === 'urgent' ? '緊急' : r.severity === 'warn' ? '重要' : '提示'}
                                    </span>
                                 </div>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-2">
                                 <button
                                    type="button"
                                    onClick={() => {
                                       markReminderDone(r.id);
                                       refreshReminders();
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-xs bg-primary/20 text-primary"
                                 >
                                    完成
                                 </button>
                                 <button
                                    type="button"
                                    onClick={() => {
                                       snoozeReminder(r.id, 1);
                                       refreshReminders();
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-xs bg-surface/60 text-gray-200"
                                 >
                                    延後 1 日
                                 </button>
                                 <button
                                    type="button"
                                    onClick={() => {
                                       snoozeReminder(r.id, 3);
                                       refreshReminders();
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-xs bg-surface/60 text-gray-200"
                                 >
                                    延後 3 日
                                 </button>
                                 {r.type === 'backup_export_json' ? (
                                    <button
                                       type="button"
                                       onClick={() => {
                                          // Navigate back to Settings for export (JSON export lives there)
                                          navigate('/settings');
                                       }}
                                       className="px-3 py-1.5 rounded-lg text-xs bg-surface/60 text-gray-200"
                                    >
                                       去匯出
                                    </button>
                                 ) : r.action?.kind === 'navigate' ? (
                                    <button
                                       type="button"
                                       onClick={() => navigate(r.action!.to)}
                                       className="px-3 py-1.5 rounded-lg text-xs bg-surface/60 text-gray-200"
                                    >
                                       前往
                                    </button>
                                 ) : null}
                              </div>
                           </div>
                        ))}
                     </div>
                  )}

                  {/* Backup quick action */}
                  {remSettings.enabled && remSettings.backupEnabled && (
                     <div className="mt-3">
                        <button
                           type="button"
                           onClick={() => {
                              // we can't directly call Settings' export function from here; so provide a stamp helper for now.
                              // user can export JSON from Settings; after export, they can tap this to reset the backup reminder timer.
                              const ok = window.confirm('已匯出 JSON 備份？按「確定」會將備份提醒計時重置。');
                              if (!ok) return;
                              stampBackupExportToday();
                              refreshReminders();
                           }}
                           className="w-full px-3 py-2 rounded-lg text-xs bg-surface/60 text-gray-200"
                        >
                           我已匯出備份（重置備份提醒）
                        </button>
                     </div>
                  )}
               </div>
            </div>
         </div>

         <div>
            <p className="text-gray-500 text-xs mb-2 ml-4">記帳提醒</p>
            <div className="sf-panel overflow-hidden divide-y sf-divider">
                {/* Toggle Row */}
                <div className="flex justify-between items-center p-4">
                  <span className="text-white text-base">開啟記帳提醒</span>
                  <div 
                    onClick={() => setEnabled(!enabled)}
                    className={`w-12 h-7 rounded-full relative cursor-pointer transition-colors ${enabled ? 'bg-green-500' : 'bg-gray-600'}`}
                  >
                      <div className={`w-6 h-6 bg-white rounded-full absolute top-0.5 shadow-md transition-all ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                  </div>
                </div>

                {/* Detail Rows */}
                {enabled && (
                  <>
                    <div className="flex justify-between items-center p-4 active:bg-gray-700/50 transition-colors cursor-pointer">
                      <span className="text-white">提醒頻率</span>
                      <div className="flex items-center gap-2">
                          <span className="text-gray-400">每日</span>
                          <ChevronRight size={16} className="text-gray-500" />
                      </div>
                    </div>
                    <div className="flex justify-between items-center p-4 active:bg-gray-700/50 transition-colors cursor-pointer">
                      <span className="text-white">提醒時間</span>
                      <div className="flex items-center gap-2">
                          <input 
                            type="time" 
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            className="bg-transparent text-gray-400 focus:outline-none text-right"
                          />
                          <ChevronRight size={16} className="text-gray-500" />
                      </div>
                    </div>
                  </>
                )}
            </div>
         </div>

         <div>
            <p className="text-gray-500 text-xs mb-2 ml-4">信用卡提醒</p>
            <div className="sf-panel overflow-hidden divide-y sf-divider">
                <div className="flex justify-between items-center p-4">
                  <span className="text-white text-base">開啟信用卡提醒</span>
                  <div 
                    onClick={() => setCcEnabled(!ccEnabled)}
                    className={`w-12 h-7 rounded-full relative cursor-pointer transition-colors ${ccEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
                  >
                      <div className={`w-6 h-6 bg-white rounded-full absolute top-0.5 shadow-md transition-all ${ccEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                  </div>
                </div>

                {ccEnabled && (
                  <>
                    <div className="flex justify-between items-center p-4 active:bg-gray-700/50 transition-colors">
                      <span className="text-white">提醒提前</span>
                      <select
                        value={ccAdvanceDays}
                        onChange={(e) => setCcAdvanceDays(Number(e.target.value))}
                        className="bg-transparent text-right text-gray-400 focus:outline-none cursor-pointer"
                      >
                        <option value={0}>當日</option>
                        <option value={1}>提前 1 日</option>
                        <option value={2}>提前 2 日</option>
                        <option value={3}>提前 3 日</option>
                        <option value={5}>提前 5 日</option>
                        <option value={7}>提前 7 日</option>
                      </select>
                    </div>
                    <div className="bg-background px-4 py-3 space-y-2">
                      <p className="text-xs text-gray-500">本月 / 下月（如接近月底）將加入行事曆嘅提醒</p>
                      {creditCardEvents.length ? (
                        <div className="space-y-1">
                          {creditCardEvents.map((e) => (
                            <div key={e.uid} className="flex items-center justify-between text-xs text-gray-200">
                              <span className="truncate">{e.summary}</span>
                              <span className="text-primary">{e.dt.toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">未有可用提醒（請先喺「信用卡管理」設定截數日/繳費日）</p>
                      )}
                    </div>
                  </>
                )}
            </div>
         </div>

         {enabled && (
           <div className="animate-fade-in-up">
              <button 
                onClick={addToCalendar}
                className="w-full sf-panel border border-primary/50 text-primary py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/10 active:scale-[0.98] transition-all"
              >
                <CalendarCheck size={20} />
                加入 iPhone 行事曆
              </button>
              <p className="text-gray-500 text-xs mt-3 ml-4 leading-relaxed">
                點擊上方按鈕將下載日曆檔案 (.ics)。<br/>
                在 iPhone 上開啟後，請選擇「加入行事曆」即可在每天指定時間收到系統通知。
              </p>
            </div>
         )}
      </div>
    </div>
  );
};

export default NotificationSettings;
