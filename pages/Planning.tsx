import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Plus } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { AnnualReserve, Currency } from '../types';
import { incomeBySource, nextAnnualDate, reserveProgress } from '../utils/planning';
import { formatMoney, parseMoneyInput, sumMoney } from '../utils/money';
import { parseDate, toLocalYMD } from '../utils/date';
import { observeLocalDay } from '../utils/dayBoundary';
import { makeId } from '../utils/id';
import { showAppConfirm } from '../utils/appDialog';
import BottomSheet from '../components/BottomSheet';

export default function Planning() {
  const { transactions, currency, annualReserves, saveAnnualReserve, removeAnnualReserve } = useData();
  const navigate = useNavigate(), [params, setParams] = useSearchParams();
  const reserves = params.get('tab') === 'reserves';
  const [unit, setUnit] = useState(currency);
  const [today, setToday] = useState(() => toLocalYMD(new Date()));
  useEffect(() => observeLocalDay(setToday), []);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [editing, setEditing] = useState<AnnualReserve | 'new' | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const income = useMemo(() => incomeBySource(transactions, month, unit, currency), [transactions, month, unit, currency]);
  const plans = useMemo(() => annualReserves.filter(plan => plan.currency === unit).sort((a,b) => a.dueDate.localeCompare(b.dueDate)), [annualReserves, unit]);
  const required = sumMoney(plans.map(plan => reserveProgress(plan, today).monthly), unit);
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); setEditing(null); } catch (e) { setError(e instanceof Error ? e.message : '未能儲存'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <main className="sf-planning sf-hub-page">
    <header className="flex items-center gap-3"><button aria-label="返回總覽" className="p-2" onClick={() => navigate('/')}><ChevronLeft /></button><h1 className="sf-page-title">收支規劃</h1></header>
    <nav aria-label="規劃分頁" className="sf-hub-tabs mt-4"><button aria-current={!reserves ? 'page' : undefined} onClick={() => setParams({tab:'income'})}>收入追蹤</button><button aria-current={reserves ? 'page' : undefined} onClick={() => setParams({tab:'reserves'})}>年度支出預留</button></nav>
    <div className="sf-planning-filters">
      {!reserves && <label>月份<input aria-label="收入月份" className="sf-field" type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>}
      <label>幣別<select aria-label="規劃幣別" className="sf-field" value={unit} onChange={e => setUnit(e.target.value as Currency)}>{Object.values(Currency).map(code => <option key={code}>{code}</option>)}</select></label>
    </div>
    {error && !editing && <p role="alert" className="sf-entry-error">{error}</p>}
    {!reserves ? <>
      <section className="sf-sub-group sf-plan-summary"><h2>本月已記錄收入</h2><strong data-testid="income-total">{formatMoney(income.total, unit)}</strong><small>按帳目日期計算</small></section>
      {!income.groups.length && <p className="sf-plan-empty">此月份未有收入。記帳時選「收入」，填入來源即可。</p>}
      {income.groups.map(group => <details key={group.source} className="sf-sub-group sf-income-group"><summary><span><span>{group.source}</span><small>{group.rows.length} 筆 · {group.share.toFixed(1)}%</small></span><strong>{formatMoney(group.amount, unit)}</strong></summary><div className="sf-plan-transactions">{group.rows.map(tx => <button key={tx.id} onClick={() => navigate(`/view/${tx.id}`)}><span>{tx.note || '收入帳目'}<small>{toLocalYMD(parseDate(tx.date)!)}</small></span><b>{formatMoney(tx.amount, unit)}</b></button>)}</div></details>)}
    </> : <>
      <section className="sf-sub-group sf-plan-summary"><h2>每月建議預留</h2><strong data-testid="reserve-monthly">{formatMoney(required, unit)}</strong><small>預留只作規劃，不會扣款或計入支出。</small></section>
      <button className="sf-primary-button w-full flex items-center justify-center gap-2 my-4" onClick={() => { setError(''); setEditing('new'); }}><Plus size={18} />新增年度項目</button>
      {!plans.length && <p className="sf-plan-empty">新增車保、Rego 或年費，分月準備下一筆費用。</p>}
      {plans.map(plan => {
        const progress = reserveProgress(plan, today);
        return <article key={plan.id} className="sf-sub-group sf-reserve-card">
          <div className="flex justify-between gap-3 items-start"><h2>{plan.name}</h2><button className="text-primary" aria-label={`編輯${plan.name}`} onClick={() => { setError(''); setEditing(plan); }}>編輯</button></div>
          <p className={progress.overdue ? 'text-amber-500' : ''}>{progress.overdue ? '已到期 · ' : '到期 '}{plan.dueDate}</p>
          <strong>{formatMoney(plan.reserved, unit)} <small>／ {formatMoney(plan.target, unit)}</small></strong>
          <progress aria-label={`${plan.name}預留進度`} max={100} value={progress.percent} />
          <div className="sf-reserve-numbers"><span>尚欠<b>{formatMoney(progress.remaining, unit)}</b></span><span>{progress.overdue ? '需補足' : '每月建議'}<b>{formatMoney(progress.monthly, unit)}</b></span></div>
          {!progress.overdue && progress.remaining > 0 && <small>今月起分 {progress.months} 期，於到期月份前備妥；本月到期則需一次補足。</small>}
          <div className="sf-reserve-actions"><button disabled={busy} className="text-primary" onClick={() => run(async () => { if (!await showAppConfirm('到期日順延一年，已預留金額歸零。此操作不會新增付款帳目；實際支出請另行記帳。', {title:'開始下一年計劃？',confirmLabel:'開始下一年'})) return; await saveAnnualReserve({...plan,dueDate:nextAnnualDate(plan.dueDate),reserved:0}); })}>開始下一年</button><button disabled={busy} onClick={() => run(async () => { if (await showAppConfirm('只刪除預留計劃，不影響收支帳目。',{title:'刪除年度項目？',confirmLabel:'刪除',destructive:true})) await removeAnnualReserve(plan.id); })}>刪除</button></div>
        </article>;
      })}
    </>}
    {editing && <BottomSheet title={editing === 'new' ? '新增年度項目' : '編輯年度項目'} onClose={() => { if (!busy) setEditing(null); }}>
      {error && <p role="alert" className="sf-entry-error">{error}</p>}
      <ReserveForm original={editing === 'new' ? undefined : editing} currency={unit} busy={busy} onError={setError} onSave={plan => run(() => saveAnnualReserve(plan))} />
    </BottomSheet>}
  </main>;
}

function ReserveForm({original,currency,busy,onError,onSave}:{original?:AnnualReserve;currency:Currency;busy:boolean;onError:(error:string)=>void;onSave:(plan:AnnualReserve)=>void}) {
  const id = useRef(original?.id || makeId('reserve'));
  const [name,setName] = useState(original?.name || '');
  const [unit,setUnit] = useState(original?.currency || currency);
  const [target,setTarget] = useState(original ? String(original.target) : '');
  const [reserved,setReserved] = useState(original ? String(original.reserved) : '0');
  const [dueDate,setDueDate] = useState(original?.dueDate || '');
  return <form onSubmit={e => { e.preventDefault(); try { const amount = parseMoneyInput(target,unit), saved = parseMoneyInput(reserved,unit); if (amount === null || saved === null) throw new Error('請輸入有效金額'); onSave({id:id.current,name:name.trim(),currency:unit,target:amount,reserved:saved,dueDate}); } catch(e) {onError(e instanceof Error ? e.message : '金額不正確');} }}><fieldset disabled={busy} className="sf-wallet-form">
    <label>名稱<input className="sf-field" aria-label="年度項目名稱" value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder="例如車保、Rego、信用卡年費" /></label>
    <label>幣別<select className="sf-field" aria-label="年度項目幣別" disabled={!!original} value={unit} onChange={e => setUnit(e.target.value as Currency)}>{Object.values(Currency).map(code => <option key={code}>{code}</option>)}</select></label>
    <label>目標金額<input className="sf-field" inputMode="decimal" value={target} onChange={e => setTarget(e.target.value)} /></label>
    <label>已預留金額<input className="sf-field" inputMode="decimal" value={reserved} onChange={e => setReserved(e.target.value)} /></label>
    <label>下次到期日<input className="sf-field" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
    <button className="sf-primary-button">{busy ? '儲存中…' : '儲存年度項目'}</button>
  </fieldset></form>;
}
