import React, { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { Currency, Subscription, TransactionType } from '../types';
import { parseLocalYMD, parseDate, toLocalYMD } from '../utils/date';
import { parseMoneyInput } from '../utils/money';
import { makeId } from '../utils/id';
import { showAppConfirm } from '../utils/appDialog';
import { advanceSubscriptionDate, subscriptionAmount, subscriptionForecast } from '../utils/subscriptionSchedule';
import { useVisibleViewport } from '../components/useVisibleViewport';
import SubscriptionServicePicker from '../components/SubscriptionServicePicker';
import SubscriptionServiceIcon from '../components/SubscriptionServiceIcon';
import { findSubscriptionService, SubscriptionService } from '../data/subscriptionServices';
import { getCurrencySymbol } from '../utils/currency';

const AddSubscription: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const selectedService = findSubscriptionService(params.get('service'));
  const showForm = Boolean(id) || params.get('step') === 'details';
  const viewport = useVisibleViewport();
  const { subscriptions, categories, creditCards, transactions, currency, saveSubscription, removeSubscription, linkSubscription } = useData();
  const original = subscriptions.find(s => s.id === id);
  const [form, setForm] = useState<Subscription>(() => original || { id: makeId('sub'), name: selectedService?.name || '', icon: selectedService ? `service:${selectedService.id}` : undefined, amount: 0, currency, billingCycle: 'Monthly', nextBillingDate: toLocalYMD(new Date()), categoryId: categories.find(c => c.type === TransactionType.EXPENSE)?.id, status: 'active', recordingMode: 'track', autoRenewal: true });
  const [amount, setAmount] = useState(original ? String(original.amount) : '');
  const [price, setPrice] = useState(original?.priceChange ? String(original.priceChange.amount) : '');
  const [priceDate, setPriceDate] = useState(original?.priceChange?.effectiveDate || '');
  const [trial, setTrial] = useState(Boolean(original?.trialEndDate));
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [linkId, setLinkId] = useState('');
  const update = (patch: Partial<Subscription>) => setForm(current => ({ ...current, ...patch }));
  const openService = (service: SubscriptionService) => {
    update({ name: service.name, icon: `service:${service.id}` });
    setError('');
    setParams({ step: 'details', service: service.id });
    window.scrollTo(0, 0);
  };
  const openCustom = (name: string) => {
    update({ name: name || (form.icon?.startsWith('service:') ? '' : form.name), icon: form.icon?.startsWith('service:') ? undefined : form.icon });
    setError('');
    setParams({ step: 'details' });
    window.scrollTo(0, 0);
  };
  const goBack = () => {
    if (!id && showForm) { setParams({}, { replace: true }); setError(''); window.scrollTo(0, 0); }
    else navigate('/subscriptions');
  };
  const unit = form.currency || currency;
  const today = toLocalYMD(new Date());
  const active = !form.status || form.status === 'active';
  const expenseCategories = categories.filter(c => c.type === TransactionType.EXPENSE);
  const candidates = original ? transactions.filter(t => t.type === TransactionType.EXPENSE && !t.subscriptionId && !t.walletItemId && (t.currency || currency) === unit && t.amount === subscriptionAmount(original, original.nextBillingDate)).slice(0,50) : [];
  const run = async (action: () => Promise<void>) => { if (busy) return; setBusy(true); setError(''); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : '未能儲存，請重試'); } finally { setBusy(false); } };
  const save = () => run(async () => {
    const value = parseMoneyInput(amount, unit);
    if (!form.name.trim() || value === null || value <= 0) throw new Error('請輸入名稱及有效金額');
    if (active && !(form.autoRenewal === false && !form.nextBillingDate) && !parseLocalYMD(form.nextBillingDate)) throw new Error('請選擇扣款日期');
    if (!expenseCategories.some(c => c.id === form.categoryId)) throw new Error('請選擇支出分類');
    if (form.managementUrl && !/^https?:\/\//i.test(form.managementUrl)) throw new Error('管理連結須以 https:// 或 http:// 開始');
    if (form.billingCycle === 'Custom' && (!Number.isInteger(form.intervalCount) || form.intervalCount! < 1 || form.intervalCount! > 365)) throw new Error('週期間隔須為 1 至 365');
    if (original?.status && original.status !== 'active' && active && form.nextBillingDate < today) throw new Error('恢復時請選擇今日或之後的扣款日期');
    if (trial && !parseLocalYMD(form.trialEndDate || '')) throw new Error('請選擇試用完結日');
    if (form.serviceEndDate && !parseLocalYMD(form.serviceEndDate)) throw new Error('請選擇有效服務到期日');
    if (price && priceDate < today && priceDate !== original?.priceChange?.effectiveDate) throw new Error('改價生效日不可早於今日');
    const newPrice = price ? parseMoneyInput(price, unit) : null;
    if (price && (newPrice === null || newPrice <= 0 || !parseLocalYMD(priceDate))) throw new Error('請輸入有效新價格及生效日');
    const next: Subscription = { ...form, name: form.name.trim(), amount: value, billingAnchorDay: original && original.nextBillingDate === form.nextBillingDate ? original.billingAnchorDay : parseLocalYMD(form.nextBillingDate)?.getDate(), trialEndDate: trial ? form.trialEndDate : undefined, priceChange: price ? { amount: newPrice!, effectiveDate: priceDate } : undefined };
    if (active && next.recordingMode !== 'track' && (!original || original.recordingMode === 'track' || original.nextBillingDate !== next.nextBillingDate)) {
      const due = subscriptionForecast(next, '1900-01-01', today);
      if (due.length && !await showAppConfirm(`將建立 ${due.length} 期支出。請先確認沒有重複帳目。`, { title: '到期自動記帳', confirmLabel: '確認記帳' })) return;
    }
    await saveSubscription(next); navigate('/subscriptions', { replace: true });
  });
  if (id && !original) return <div className="p-6 pt-safe-top">找不到訂閱<button onClick={() => navigate('/subscriptions')}>返回</button></div>;
  return <div className="sf-sub-page min-h-screen bg-background">
    <header className="sf-sub-header sf-topbar"><div><button type="button" disabled={busy} aria-label={!id && showForm ? '返回選擇服務' : '返回訂閱'} onClick={goBack}><ChevronLeft size={24} /><span>返回</span></button><h1>{id ? '訂閱詳情' : showForm ? '新增訂閱' : '選擇服務'}</h1><span className="sf-sub-header-spacer" /></div></header>
    {!id && <div hidden={showForm}><SubscriptionServicePicker onSelect={openService} onCustom={openCustom} /></div>}
    <fieldset hidden={!showForm} disabled={busy} className="sf-sub-content sf-sub-form disabled:opacity-60">
      <div className="sf-sub-group sf-sub-identity">
        <SubscriptionServiceIcon icon={form.icon} name={form.name} />
        <input aria-label="訂閱名稱" value={form.name} onChange={e => update({ name: e.target.value })} placeholder="服務名稱" autoComplete="off" />
      </div>
      <div className="sf-sub-group sf-sub-amount">
        <label htmlFor="subscription-amount">金額</label>
        <div className="sf-sub-amount-line"><span aria-hidden="true">{getCurrencySymbol(unit)}</span><input id="subscription-amount" aria-label="訂閱金額" type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /><select aria-label="訂閱幣別" value={unit} onChange={e => update({ currency: e.target.value as Currency })}>{Object.values(Currency).map(c => <option key={c}>{c}</option>)}</select></div>
      </div>
      <div className="sf-sub-group">
        <label className="sf-sub-row"><span>扣款週期</span><select aria-label="扣款週期" value={form.billingCycle} onChange={e => update({ billingCycle: e.target.value as Subscription['billingCycle'], intervalCount: form.intervalCount || 3, intervalUnit: form.intervalUnit || 'months' })}><option value="Monthly">每月</option><option value="Yearly">每年</option><option value="Weekly">每週</option><option value="BiWeekly">每兩週</option><option value="Custom">自訂</option></select><ChevronRight size={18} aria-hidden="true" /></label>
        {form.billingCycle === 'Custom' && <div className="sf-sub-custom-cycle"><input aria-label="週期間隔" type="number" min="1" max="365" value={form.intervalCount || 1} onChange={e => update({ intervalCount: Number(e.target.value) })} className="sf-field" /><select aria-label="週期單位" className="sf-field" value={form.intervalUnit || 'months'} onChange={e => update({ intervalUnit: e.target.value as 'days' | 'months' })}><option value="months">個月</option><option value="days">日</option></select></div>}
        <label className="sf-sub-row"><span>{trial ? '試用完結' : '下次扣款'}</span><input aria-label="扣款日期" type="date" value={form.nextBillingDate} onChange={e => update({ nextBillingDate: e.target.value, ...(trial ? { trialEndDate: e.target.value } : {}) })} /><ChevronRight size={18} aria-hidden="true" /></label>
      </div>
      <div className="sf-sub-group">
        <label className="sf-sub-row"><span>記帳方式</span><select aria-label="記帳方式" value={form.recordingMode || 'auto'} onChange={e => update({ recordingMode: e.target.value as 'auto' | 'track' })}><option value="track">只追蹤</option><option value="auto">自動記帳</option></select><ChevronRight size={18} aria-hidden="true" /></label>
        {form.recordingMode !== 'track' && <p className="px-4 pb-4 text-xs text-gray-400">開啟 App 時記帳，不代表銀行已扣款。</p>}
      </div>
      <button type="button" className="sf-sub-group sf-sub-disclosure" aria-expanded={details} aria-controls="subscription-details" onClick={() => setDetails(!details)}><span>詳細資訊</span><ChevronRight size={18} aria-hidden="true" className={details ? 'rotate-90' : ''} /></button>
      {details && <div id="subscription-details" className="sf-sub-group p-4 space-y-4">
        <label className="flex items-center justify-between text-sm">免費試用<input type="checkbox" checked={trial} onChange={e => { setTrial(e.target.checked); update({ trialEndDate: e.target.checked ? form.nextBillingDate : undefined }); }} /></label>
        <label className="block text-sm">服務圖示<input aria-label="服務圖示" className="sf-field w-full mt-2" value={form.icon?.startsWith('service:') ? '' : form.icon?.replace(/^emoji:/, '') || ''} onChange={e => update({ icon: e.target.value ? `emoji:${e.target.value}` : '' })} placeholder={form.icon?.startsWith('service:') ? '使用服務圖示' : '輸入表情符號'} /></label>
        <label className="block text-sm">分類<select aria-label="訂閱分類" className="sf-field w-full mt-2" value={form.categoryId} onChange={e => update({ categoryId: e.target.value })}>{expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="block text-sm">付款信用卡<select aria-label="付款信用卡" className="sf-field w-full mt-2" value={form.cardId || ''} onChange={e => update({ cardId: e.target.value || undefined })}><option value="">未指定</option>{creditCards.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
        <label className="block text-sm">管理訂閱連結<input type="url" aria-label="管理訂閱連結" className="sf-field w-full mt-2" value={form.managementUrl || ''} onChange={e => update({ managementUrl: e.target.value })} placeholder="https://" /></label>
        {form.managementUrl && /^https?:\/\//i.test(form.managementUrl) && <a className="text-primary block" href={form.managementUrl} target="_blank" rel="noopener noreferrer">前往服務網站 ↗</a>}
        <label className="block text-sm">備註<textarea className="sf-field w-full mt-2" value={form.notes || ''} onChange={e => update({ notes: e.target.value })} /></label>
        <label className="flex justify-between text-sm">自動續訂<input type="checkbox" checked={form.autoRenewal !== false} onChange={e => update({ autoRenewal: e.target.checked })} /></label>
        <label className="block text-sm">狀態<select aria-label="訂閱狀態" className="sf-field w-full mt-2" value={form.status || 'active'} onChange={e => update({ status: e.target.value as Subscription['status'] })}><option value="active">使用中</option><option value="paused">已暫停</option><option value="cancelled">已取消續訂</option></select></label>
        {form.status === 'cancelled' && <><p className="text-xs text-gray-400">只更新本機記錄；請到服務網站取消。</p><label className="block text-sm">服務到期日<input type="date" aria-label="服務到期日" className="sf-field w-full mt-2" value={form.serviceEndDate || ''} onChange={e => update({ serviceEndDate: e.target.value })} /></label></>}
        <div className="border-t border-white/10 pt-4"><p className="text-sm mb-2">預定改價</p><input aria-label="新價格" className="sf-field w-full" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="新價格（留空不設定）" />{price && <input aria-label="改價生效日" type="date" className="sf-field mt-2 w-full" value={priceDate} onChange={e => setPriceDate(e.target.value)} />}</div>
      </div>}
      {original && <details className="sf-panel p-4"><summary>付款歷史 · {transactions.filter(t => t.subscriptionId === id).length} 筆</summary><div className="mt-3 space-y-2 text-sm">{transactions.filter(t => t.subscriptionId === id).sort((a,b) => b.date.localeCompare(a.date)).slice(0,30).map(t => <div key={t.id} className="sf-control p-3 rounded-xl">{toLocalYMD(parseDate(t.date)!)} · {t.currency} {t.amount}</div>)}</div>
        {original.nextBillingDate && <div className="mt-4 space-y-2"><label className="text-sm">連結本期現有支出<select aria-label="連結現有支出" className="sf-field w-full mt-2" value={linkId} onChange={e => setLinkId(e.target.value)}><option value="">選擇同幣別、同金額支出</option>{candidates.map(t => <option key={t.id} value={t.id}>{toLocalYMD(parseDate(t.date)!)} · {t.note || '未填備註'} · {t.amount}</option>)}</select></label><button disabled={!linkId} className="sf-control p-3 rounded-xl w-full" onClick={() => run(async () => { if (!await showAppConfirm(`連結至 ${original.nextBillingDate} 這一期，並移至下一期。未儲存的編輯不會套用。`, { title: '連結支出', confirmLabel: '確認連結' })) return; const date = parseLocalYMD(original.nextBillingDate)!; await linkSubscription(original.id, linkId, original.autoRenewal === false ? '' : toLocalYMD(advanceSubscriptionDate(date, { ...original, billingAnchorDay: original.billingAnchorDay || date.getDate() }))); navigate('/subscriptions', { replace: true }); })}>連結現有支出</button></div>}
      </details>}
      {original && <button className="w-full p-3 text-red-400" onClick={() => run(async () => { if (!await showAppConfirm('保留已有支出，停止往後記帳。', { title: '刪除訂閱？', confirmLabel: '刪除訂閱', destructive: true })) return; await removeSubscription(original.id); navigate('/subscriptions', { replace: true }); })}>刪除訂閱</button>}
    </fieldset>
    {showForm && <div style={viewport ? { bottom: viewport.bottom } : undefined} className="sf-sub-footer"><div>{error && <p role="alert" className="sf-entry-error">{error}</p>}<button disabled={busy} onClick={save} className="sf-primary-button">{busy ? '儲存中…' : id ? '更新' : '儲存'}</button></div></div>}
  </div>;
};
export default AddSubscription;
