import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight, CreditCard as CardIcon, CalendarDays, FileText, Pencil, Bell, CheckCircle2 } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { CreditCardCycle, createOpenCycle, getCreditCardCycleAlerts, getCurrentYearMonth, getNextYearMonth } from '../utils/creditCardCycles';
import { loadCycles, saveCycles, upsertCycle } from '../utils/creditCardCycleStorage';
import { parseMoneyInput, sumMoney } from '../utils/money';
import { Currency } from '../types';
import BottomSheet from '../components/BottomSheet';
import { flushStorage, getSaveStatus, retryStorage } from '../utils/storage';
import { showAppConfirm } from '../utils/appDialog';

const Manager = lazy(() => import('./CreditCardManager'));
const dateLabel = (date?: string) => date ? date.replace(/^\d{4}-0?/, '').replace('-0', '/') .replace('-', '/') : '未設定';

export default function CreditCardCenter() {
  const { creditCards, currency } = useData();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'overview';
  const selectedCard = creditCards.find(c => c.id === params.get('card'));
  const [cycles, setCycles] = useState(loadCycles);
  const [unit, setUnit] = useState<string>(currency);
  const [month, setMonth] = useState(getCurrentYearMonth().yearMonth);
  const [status, setStatus] = useState('all');
  const [editor, setEditor] = useState<string | null>(null);
  const [amountSheet, setAmountSheet] = useState(false);
  const [amount, setAmount] = useState('');
  const [amountUnit, setAmountUnit] = useState<string>(currency);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const liveCycles = useMemo(() => {
    const ids = new Set(creditCards.map(c => c.id));
    return cycles.filter(c => ids.has(c.cardId));
  }, [cycles, creditCards]);
  const selectedCycles = selectedCard ? liveCycles.filter(c => c.cardId === selectedCard.id).sort((a,b) => b.yearMonth.localeCompare(a.yearMonth)) : [];
  const cycle = selectedCycles.find(c => c.id === params.get('cycle')) || selectedCycles.find(c => c.status !== 'closed') || selectedCycles[0];
  const cardCurrency = (cardId: string) => creditCards.find(card => card.id === cardId)?.currency || currency;
  const cycleCurrency = (item?: CreditCardCycle) => item?.currency || (item ? cardCurrency(item.cardId) : currency);
  const pending = liveCycles.filter(c => c.status !== 'closed' && cycleCurrency(c) === unit).sort((a,b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  const known = pending.filter(c => typeof c.amountDue === 'number');
  const money = (value: number, code = unit) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: code }).format(value);
  const cycleMoney = (c?: CreditCardCycle) => c?.amountDue == null ? '未輸入金額' : money(c.amountDue, cycleCurrency(c));
  const units = Array.from(new Set([currency, ...creditCards.map(card => card.currency || currency), ...liveCycles.map(cycleCurrency)]));
  const alertCounts = pending.reduce((counts, item) => {
    const alerts = getCreditCardCycleAlerts(item);
    if (alerts.overdue) counts.overdue++;
    if (alerts.upcoming) counts.upcoming++;
    if (alerts.missingAmount) counts.missing++;
    return counts;
  }, { overdue: 0, upcoming: 0, missing: 0 });
  const alertBadges = (item: CreditCardCycle) => {
    const alerts = getCreditCardCycleAlerts(item);
    return <span className="sf-credit-alerts">{alerts.overdue && <small className="sf-credit-alert sf-credit-alert-overdue">逾期</small>}{alerts.upcoming && <small className="sf-credit-alert sf-credit-alert-upcoming">即將到期</small>}{alerts.missingAmount && <small className="sf-credit-alert sf-credit-alert-missing">未輸入金額</small>}{!alerts.overdue && !alerts.upcoming && !alerts.missingAmount && <small className="sf-credit-alert">待繳</small>}</span>;
  };
  const openCard = (cardId: string, cycleId?: string) => setParams(p => { p.set('card', cardId); if (cycleId) p.set('cycle', cycleId); else p.delete('cycle'); return p; });
  const back = () => setParams(p => { p.delete('card'); p.delete('cycle'); return p; }, { replace: true });
  const persist = async (next: CreditCardCycle): Promise<boolean> => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      if (getSaveStatus() === 'error') await retryStorage();
      await flushStorage();
      const updated = upsertCycle(loadCycles(), next);
      if (!await saveCycles(updated)) throw new Error('帳單未能儲存，請重試。');
      await flushStorage();
      setCycles(updated);
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '帳單未能儲存，請重試。');
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const create = (next: boolean) => {
    if (!selectedCard) return;
    const ym = next && cycle ? getNextYearMonth(cycle.year, cycle.month0) : getCurrentYearMonth();
    const fresh = createOpenCycle(selectedCard, ym.year, ym.month0);
    const existing = loadCycles().find(c => c.id === fresh.id);
    if (existing) { openCard(selectedCard.id, fresh.id); return; }
    void persist(fresh).then(saved => { if (saved) openCard(selectedCard.id, fresh.id); }); // Never overwrite a saved amount or paid status.
  };
  const togglePaid = async () => {
    if (!cycle) return;
    if (!await showAppConfirm(cycle.status === 'closed' ? '取消已繳款標記？' : '只更新記錄，不會實際扣款。', { title: cycle.status === 'closed' ? '取消已繳款？' : '標記已繳款？', confirmLabel: cycle.status === 'closed' ? '取消標記' : '標記已繳', destructive: true })) return;
    await persist({ ...cycle, status: cycle.status === 'closed' ? 'open' : 'closed', paidAt: cycle.status === 'closed' ? undefined : new Date().toISOString() });
  };
  const changeMonth = (delta: number) => {
    const [y,m] = month.split('-').map(Number), d = new Date(y,m-1+delta,1);
    setMonth(getCurrentYearMonth(d).yearMonth);
  };
  const bills = liveCycles.filter(c => (c.dueDate?.slice(0,7) || c.yearMonth) === month && cycleCurrency(c) === unit && (status === 'all' || (status === 'paid' ? c.status === 'closed' : c.status !== 'closed'))).sort((a,b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  const cardArt = (name: string, digits?: string, large = false) => <div className={large ? 'sf-credit-art sf-credit-art-large' : 'sf-credit-art'}>{large ? <><strong>{name}</strong><span>•••• {digits?.slice(-4) || '未設定'}</span></> : <CardIcon size={28} />}</div>;
  return <main className="sf-credit-center">
    <header className="sf-credit-header">{selectedCard ? <><button className="text-primary flex items-center" onClick={back}><ChevronLeft size={20} />信用卡</button><h1>{selectedCard.name}</h1><button aria-label="編輯卡片" onClick={() => setEditor(selectedCard.id)}><Pencil size={20} /></button></> : <><h1>信用卡</h1><button aria-label="新增信用卡" className="text-primary" onClick={() => setEditor('new')}><Plus /></button></>}</header>
    {saveError && <p role="alert" className="sf-credit-panel mt-3 text-sm text-red-300">{saveError}</p>}
    {saving && <p role="status" className="mt-2 text-sm text-gray-400">帳單儲存中…</p>}
    {!selectedCard && <nav className="sf-credit-tabs" aria-label="信用卡檢視">{[['overview','總覽'],['cycles','週期'],['manage','管理']].map(([id,label]) => <button key={id} aria-pressed={tab === id} onClick={() => setParams({tab:id})}>{label}</button>)}</nav>}
    {selectedCard ? <>
      {cardArt(selectedCard.name, selectedCard.lastFourDigits, true)}<p className="sf-credit-note">卡片幣別 · {selectedCard.currency || currency}</p>
      <section className="sf-credit-panel mt-4">
        <p className="text-sm">{cycle?.status === 'closed' ? '本期已繳款' : '本期待繳'}</p>{cycle && cycle.status !== 'closed' && alertBadges(cycle)}<strong className="sf-credit-amount">{cycleMoney(cycle)}</strong>
        {cycle ? <><div className="sf-credit-dates"><div><small>結帳日</small><span>{dateLabel(cycle.statementDate)}</span></div><div><small>繳款日</small><span>{dateLabel(cycle.dueDate)}</span></div></div><p className="text-sm text-gray-400 mb-4">截數月份 {cycle.yearMonth}</p>
          <button className="sf-primary-button w-full" disabled={saving} onClick={() => void togglePaid()}>{cycle.status === 'closed' ? '取消已繳款' : '標記已繳款'}</button>
          <button className="text-primary w-full mt-2 disabled:opacity-50" disabled={saving} onClick={() => { setAmount(cycle.amountDue?.toString() || ''); setAmountUnit(cycleCurrency(cycle)); setError(''); setAmountSheet(true); }}>輸入／修改應繳金額</button>
        </> : <button className="sf-primary-button w-full mt-4" disabled={saving} onClick={() => create(false)}>建立本期帳單</button>}
      </section>
      <p className="sf-credit-note">只更新記錄，不會實際扣款</p>
      <section className="sf-credit-panel sf-credit-actions">
        <label><FileText size={20} /><span>帳單紀錄</span><select aria-label="選擇帳單" value={cycle?.id || ''} onChange={e => openCard(selectedCard.id, e.target.value)}>{selectedCycles.map(c => <option key={c.id} value={c.id}>{c.yearMonth} · {c.status === 'closed' ? '已繳' : '待繳'}</option>)}</select></label>
        {[[Pencil,'編輯卡片'],[CalendarDays,'週期設定'],[Bell,'提醒設定']].map(([Icon,label]) => { const Component = Icon as typeof Pencil; return <button key={String(label)} onClick={() => setEditor(selectedCard.id)}><Component size={20} /><span>{String(label)}</span><ChevronRight size={18} /></button>; })}
        {cycle && <button onClick={() => create(true)}><Plus size={20} /><span>建立／查看下一期</span><ChevronRight size={18} /></button>}
      </section><p className="sf-credit-note">卡片只顯示末四位 · 修改設定不會改寫歷史帳單</p>
    </> : tab === 'manage' ? <Suspense fallback={<p>載入管理…</p>}><Manager embedded onDone={() => setCycles(loadCycles())} /></Suspense> : <>
      {tab === 'overview' && <section className="sf-credit-panel sf-credit-summary"><p>{unit} 待繳總額</p><strong className="sf-credit-amount">{money(sumMoney(known.map(c => c.amountDue!), unit as Currency))}</strong><p className="text-sm text-gray-400">{pending.length} 張待繳帳單 · 每種幣別獨立計算</p><div className="sf-credit-alert-summary"><span className={alertCounts.overdue ? 'text-red-400' : ''}>逾期 {alertCounts.overdue}</span><span className={alertCounts.upcoming ? 'text-amber-300' : ''}>即將到期 {alertCounts.upcoming}</span><span className={alertCounts.missing ? 'text-blue-300' : ''}>未輸入金額 {alertCounts.missing}</span></div>{pending[0]?.dueDate && <button className="sf-credit-due" onClick={() => openCard(pending[0].cardId, pending[0].id)}><CalendarDays size={18} /><span>最早到期 · {pending[0].dueDate}</span><ChevronRight size={18} /></button>}</section>}
      <div className="sf-credit-toolbar"><select aria-label="信用卡幣別" value={unit} onChange={e => setUnit(e.target.value)}>{units.map(u => <option key={u}>{u}</option>)}</select><span>{tab === 'overview' ? '待繳帳單按到期日排列' : '按繳款月份查看'}</span></div>
      {tab === 'cycles' ? <>
        <div className="sf-credit-month"><button aria-label="上一個月" onClick={() => changeMonth(-1)}><ChevronLeft /></button><strong>{month.replace('-', '年')}月</strong><button aria-label="下一個月" onClick={() => changeMonth(1)}><ChevronRight /></button></div>
        <div className="sf-credit-tabs" aria-label="帳單狀態">{[['all','全部'],['open','待繳'],['paid','已繳']].map(([value,label]) => <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</button>)}</div>
        <div className="sf-credit-timeline">{bills.map(c => { const card = creditCards.find(x => x.id === c.cardId)!; return <section key={c.id}><h2>{c.dueDate || '未設定繳款日'}</h2><button className="sf-credit-card-row" onClick={() => openCard(card.id,c.id)}>{cardArt(card.name)}<div className="flex-1 min-w-0"><strong>{card.name}</strong><small>•••• {card.lastFourDigits?.slice(-4) || '未設定'} · {cycleCurrency(c)}</small><small>截數 {c.statementDate || c.yearMonth}</small></div><div className="text-right">{c.status === 'closed' ? <small className="text-green-400">已繳</small> : alertBadges(c)}<strong>{cycleMoney(c)}</strong><small className="text-primary">查看帳單 ›</small></div></button></section>; })}</div>
        {!bills.length && <p className="sf-credit-empty">此月份沒有符合條件的帳單</p>}
        <aside className="sf-credit-panel mt-5"><strong>結帳日 ≠ 繳款日</strong><p className="text-sm text-gray-400 mt-2">結帳日決定本期帳單，繳款日是付款期限。未設定繳款日的帳單按截數月份顯示。</p></aside>
      </> : <>
        {pending.map(c => { const card = creditCards.find(x => x.id === c.cardId)!; return <button className="sf-credit-card-row" key={c.id} onClick={() => openCard(card.id,c.id)}>{cardArt(card.name)}<div className="flex-1 min-w-0"><strong>{card.name}</strong><small>•••• {card.lastFourDigits?.slice(-4) || '未設定'} · {cycleCurrency(c)}</small><small>結帳 {dateLabel(c.statementDate)} · 繳款 {dateLabel(c.dueDate)}</small></div><div className="text-right">{alertBadges(c)}<strong>{cycleMoney(c)}</strong></div><ChevronRight size={18} /></button>; })}
        {creditCards.filter(card => !pending.some(c => c.cardId === card.id)).map(card => <button className="sf-credit-card-row" key={card.id} onClick={() => openCard(card.id)}>{cardArt(card.name)}<div className="flex-1 min-w-0"><strong>{card.name}</strong><small>查看卡片與其他帳單</small></div><ChevronRight size={18} /></button>)}
        {!!liveCycles.filter(c => c.status === 'closed' && cycleCurrency(c) === unit).length && <button className="sf-credit-paid" onClick={() => { setStatus('paid'); setParams({tab:'cycles'}); }}><CheckCircle2 size={20} />查看已繳帳單<ChevronRight size={18} /></button>}
        {!creditCards.length && <div className="sf-credit-empty"><CardIcon size={40} /><h2>尚未新增信用卡</h2><button className="text-primary" onClick={() => setEditor('new')}>新增第一張信用卡</button></div>}
        <p className="sf-credit-note">每張卡及每期帳單保留獨立幣別，不同幣別不會合併計算。</p>
      </>}
    </>}
    {editor && <BottomSheet title={editor === 'new' ? '新增信用卡' : '卡片設定'} onClose={() => { setEditor(null); setCycles(loadCycles()); }}><Suspense fallback={<p>載入表單…</p>}><Manager embedded adding={editor === 'new'} editId={editor === 'new' ? undefined : editor} onDone={() => { setEditor(null); setCycles(loadCycles()); }} /></Suspense></BottomSheet>}
    {amountSheet && cycle && <BottomSheet title="本期應繳金額" onClose={() => { if (!saving) setAmountSheet(false); }}><fieldset disabled={saving} className="space-y-4 disabled:opacity-60"><label>金額<input className="sf-field" inputMode="decimal" value={amount} onChange={e => { setAmount(e.target.value); setError(''); }} /></label><label>幣別<select className="sf-field" value={amountUnit} onChange={e => { setAmountUnit(e.target.value); setError(''); }}>{Object.values(Currency).map(u => <option key={u}>{u}</option>)}</select></label>{error && <p role="alert" className="text-red-400">{error}</p>}{saveError && <p role="alert" className="text-red-300">{saveError}</p>}<button type="button" className="sf-primary-button w-full mt-4" onClick={() => { const n = parseMoneyInput(amount, amountUnit as Currency); if (n === null || n < 0) { setError(amountUnit === Currency.JPY ? '請輸入 0 或以上的整數金額' : '請輸入 0 或以上，最多兩位小數'); return; } void persist({...cycle,amountDue:n,currency:amountUnit,amountDueEnteredAt:new Date().toISOString()}).then(saved => { if (saved) setAmountSheet(false); }); }}>{saving ? '儲存中…' : '儲存金額'}</button></fieldset></BottomSheet>}
  </main>;
}
