import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Search, Pencil } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { Currency, WalletItem } from '../types';
import { walletBalance, walletStatus, walletLabels, walletIcons } from '../utils/wallet';
import { formatMoney, parseMoneyInput } from '../utils/money';
import { parseLocalYMD, toLocalYMD, parseDate } from '../utils/date';
import { makeId } from '../utils/id';
import { showAppConfirm } from '../utils/appDialog';
import { observeLocalDay } from '../utils/dayBoundary';
import { useEffect } from 'react';
import BottomSheet from '../components/BottomSheet';
import SubscriptionServiceIcon from '../components/SubscriptionServiceIcon';
import { subscriptionAmount } from '../utils/subscriptionSchedule';

type Kind = WalletItem['kind'];
export default function Wallet() {
  const { walletItems, transactions, subscriptions, currency, saveWalletItem, removeWalletItem } = useData();
  const navigate = useNavigate(), [params, setParams] = useSearchParams();
  const selected = walletItems.find(item => item.id === params.get('id'));
  const [today, setToday] = useState(() => toLocalYMD(new Date()));
  useEffect(() => observeLocalDay(setToday), []);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'subscription' | Kind>('all');
  const [status, setStatus] = useState('active');
  const [sheet, setSheet] = useState<'choose' | Kind | 'edit' | 'add' | 'use' | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); setSheet(null); } catch (e) { setError(e instanceof Error ? e.message : '未能儲存'); }
    finally { lock.current = false; setBusy(false); }
  }
  const openSheet = (value: typeof sheet) => { setError(''); setSheet(value); };
  const remaining = (item: WalletItem) => item.kind === 'stored' ? formatMoney(walletBalance(item, transactions), item.currency) : `${walletBalance(item, transactions)} ${item.kind === 'count' ? '次' : '張'}`;
  const statusLabel = (item: WalletItem) => ({ active: item.expiresOn ? `有效至 ${item.expiresOn}` : '無到期日', used: '已用完', expired: '已過期' }[walletStatus(item, transactions, today)]);
  const matches = (name: string) => name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const visible = walletItems.filter(item => (filter === 'all' || filter === item.kind) && matches(item.name) && (status === 'all' || walletStatus(item, transactions, today) === status))
    .sort((a,b) => (a.expiresOn || '9999').localeCompare(b.expiresOn || '9999') || a.name.localeCompare(b.name));
  const subs = subscriptions.filter(sub => matches(sub.name)).sort((a,b) => (a.nextBillingDate || '9999').localeCompare(b.nextBillingDate || '9999'));
  const history = selected ? [
    ...selected.events.map(event => ({ id: event.id, date: event.date, label: event.kind === 'add' ? (selected.kind === 'stored' ? '增值' : '增加數量') : '使用', amount: `${event.kind === 'add' ? '+' : '−'}${selected.kind === 'stored' ? formatMoney(event.amount, selected.currency) : event.amount}`, note: event.note, transaction: false })),
    ...transactions.filter(tx => tx.walletItemId === selected.id).map(tx => ({ id: tx.id, date: toLocalYMD(parseDate(tx.date)!), label: '支出', amount: `−${formatMoney(tx.amount, selected.currency)}`, note: tx.note, transaction: true })),
  ].sort((a,b) => b.date.localeCompare(a.date)) : [];
  return <main className="sf-wallet sf-hub-page">
    <header className="sf-wallet-header">{selected ? <><button aria-label="返回錢包" onClick={() => { setParams({}); setError(''); }}><ChevronLeft /></button><h1>{selected.name}</h1><button aria-label="編輯卡券" onClick={() => openSheet('edit')}><Pencil size={22} /></button></> : <><h1 className="sf-page-title">錢包</h1><button aria-label="新增錢包項目" onClick={() => openSheet('choose')}><Plus /></button></>}</header>
    {error && !sheet && <p role="alert" className="sf-entry-error">{error}</p>}
    {params.get('id') && !selected && <p role="status">卡券已移除<button className="text-primary p-3" onClick={() => setParams({})}>返回錢包</button></p>}
    {selected ? <>
      <section className="sf-wallet-balance sf-sub-group"><span className="sf-wallet-icon">{walletIcons[selected.kind]}</span><p>{walletLabels[selected.kind]}</p><strong>{remaining(selected)}</strong><p>{statusLabel(selected)}</p>{selected.kind === 'voucher' && <p>每張 {formatMoney(selected.faceValue || 0, selected.currency)}</p>}</section>
      <div className="sf-wallet-actions"><button className="sf-primary-button" disabled={walletStatus(selected, transactions, today) !== 'active'} onClick={() => selected.kind === 'stored' ? navigate(`/add?wallet=${encodeURIComponent(selected.id)}`) : openSheet('use')}>{selected.kind === 'stored' ? '使用並記帳' : '使用'}</button><button className="sf-control rounded-2xl" onClick={() => openSheet('add')}>{selected.kind === 'stored' ? '增值' : '增加數量'}</button></div>
      {selected.notes && <p className="sf-wallet-note">{selected.notes}</p>}
      <section><h2>使用紀錄</h2><div className="sf-sub-group">{history.length ? history.map(event => <div key={event.id} className="sf-wallet-history"><div><strong>{event.label}</strong><small>{event.date}{event.note ? ` · ${event.note}` : ''}</small></div><span>{event.amount}</span>{event.transaction ? <button aria-label="查看支出" onClick={() => navigate(`/view/${event.id}`)}><ChevronRight size={20} /></button> : <button disabled={busy} className="text-primary" onClick={() => run(async () => { if (!await showAppConfirm('移除此紀錄並重新計算餘額？', { title: '刪除紀錄', confirmLabel: '刪除', destructive: true })) return; await saveWalletItem({ ...selected, events: selected.events.filter(item => item.id !== event.id) }); })}>刪除</button>}</div>) : <p className="p-5 text-gray-400">尚未有使用紀錄</p>}</div></section>
      <button disabled={busy} className="sf-wallet-delete" onClick={() => run(async () => { if (!await showAppConfirm('將移除卡券及使用紀錄，已有支出會保留。', { title: '刪除卡券？', confirmLabel: '刪除卡券', destructive: true })) return; await removeWalletItem(selected.id); setParams({}); })}>刪除卡券</button>
    </> : <>
      <label className="sf-service-search"><Search size={20} /><input aria-label="搜尋錢包" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜尋名稱" type="search" /></label>
      <nav className="sf-service-groups" aria-label="錢包分類">{([['all','全部'],['subscription','訂閱／定期'],['stored','儲值卡'],['count','次數卡'],['voucher','禮券']] as const).map(([key,label]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</nav>
      {(filter === 'all' || filter === 'subscription') && <section><div className="sf-wallet-section-title"><h2>訂閱與定期項目</h2><button onClick={() => navigate('/subscriptions', { state: { from: '/wallet' } })}>管理全部 <ChevronRight size={16} /></button></div><div className="sf-sub-group">{subs.slice(0, filter === 'subscription' ? subs.length : 3).map(sub => <button className="sf-wallet-row" key={sub.id} onClick={() => navigate(`/subscriptions/${sub.id}/edit`, { state: { from: '/wallet' } })}><SubscriptionServiceIcon icon={sub.icon} name={sub.name} /><span><strong>{sub.name}</strong><small>{sub.status === 'paused' ? '已暫停' : sub.status === 'cancelled' ? '已取消續訂' : sub.nextBillingDate ? `下次 ${sub.nextBillingDate}` : '不再續訂'}</small></span><b>{formatMoney(subscriptionAmount(sub, sub.nextBillingDate), sub.currency || currency)}</b><ChevronRight size={18} /></button>)}{!subs.length && <button className="sf-wallet-empty" onClick={() => navigate('/add-subscription')}>{query ? '找不到訂閱' : '新增訂閱或定期項目'} <Plus size={18} /></button>}</div></section>}
      {filter !== 'subscription' && <><div className="sf-wallet-section-title"><h2>卡券</h2><select aria-label="卡券狀態" value={status} onChange={e => setStatus(e.target.value)}><option value="active">可使用</option><option value="used">已用完</option><option value="expired">已過期</option><option value="all">全部狀態</option></select></div>
      {(['stored','count','voucher'] as const).filter(kind => filter === 'all' || filter === kind).map(kind => {
        const rows = visible.filter(item => item.kind === kind);
        return rows.length ? <section key={kind}><h2>{walletLabels[kind]}</h2><div className="sf-sub-group">{rows.map(item => <button key={item.id} className="sf-wallet-row" onClick={() => { setParams({id:item.id}); setError(''); }}><span className="sf-wallet-icon">{walletIcons[kind]}</span><span><strong>{item.name}</strong><small>{statusLabel(item)}</small></span><b>{remaining(item)}</b><ChevronRight size={18} /></button>)}</div></section> : null;
      })}
      {!visible.length && <div className="sf-wallet-empty sf-sub-group">{walletItems.length ? '沒有符合條件的卡券' : '儲值卡、次數卡及禮券放喺呢度'}<button className="text-primary" onClick={() => openSheet('choose')}>新增</button></div>}</>}
    </>}
    {sheet && <BottomSheet title={sheet === 'choose' ? '新增錢包項目' : sheet === 'edit' ? '編輯卡券' : sheet === 'add' ? (selected?.kind === 'stored' ? '增值' : '增加數量') : sheet === 'use' ? '使用卡券' : `新增${walletLabels[sheet]}`} onClose={() => { if (!busy) { setSheet(null); setError(''); } }}>
      {error && <p role="alert" className="sf-entry-error">{error}</p>}
      {sheet === 'choose' ? <div className="sf-wallet-choices"><button onClick={() => navigate('/add-subscription')}>訂閱／定期項目<ChevronRight /></button>{(['stored','count','voucher'] as const).map(kind => <button key={kind} onClick={() => openSheet(kind)}>{walletIcons[kind]} {walletLabels[kind]}<ChevronRight /></button>)}</div>
      : (sheet === 'add' || sheet === 'use') && selected ? <WalletAction key={sheet} item={selected} action={sheet} busy={busy} onSave={(amount, date, note, eventId) => run(async () => {
        if (sheet === 'use' && selected.expiresOn && date > selected.expiresOn) throw new Error('使用日期已超過到期日');
        await saveWalletItem({ ...selected, events: [...selected.events.filter(event => event.id !== eventId), { id: eventId, kind: sheet, amount, date, note }] });
      })} onError={setError} />
      : <WalletForm key={sheet} original={sheet === 'edit' ? selected : undefined} kind={sheet === 'edit' ? selected!.kind : sheet as Kind} currency={currency} busy={busy} onError={setError} onSave={item => run(async () => { await saveWalletItem(item); setParams({ id: item.id }); })} />}
    </BottomSheet>}
  </main>;
}

function WalletForm({ original, kind, currency, busy, onSave, onError }: { original?: WalletItem; kind: Kind; currency: Currency; busy: boolean; onSave: (item: WalletItem) => void; onError: (message: string) => void }) {
  const id = useRef(original?.id || makeId('wallet'));
  const [name, setName] = useState(original?.name || '');
  const [unit, setUnit] = useState(original?.currency || currency);
  const [amount, setAmount] = useState(original ? String(original.openingBalance) : '');
  const [face, setFace] = useState(String(original?.faceValue || ''));
  const [expires, setExpires] = useState(original?.expiresOn || '');
  const [notes, setNotes] = useState(original?.notes || '');
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const balance = kind === 'stored' ? parseMoneyInput(amount, unit) : /^\d+$/.test(amount) ? Number(amount) : null;
    const faceValue = face ? parseMoneyInput(face, unit) : 0;
    if (!name.trim() || balance === null || balance < 0 || faceValue === null || faceValue < 0) { onError('請輸入名稱及有效餘額或數量'); return; }
    onSave({ id: id.current, name: name.trim(), kind, currency: unit, openingBalance: balance, faceValue: kind === 'voucher' ? faceValue : undefined, expiresOn: expires || undefined, notes, events: original?.events || [] });
  };
  return <form onSubmit={submit}><fieldset disabled={busy} className="sf-wallet-form">
    <label>名稱<input autoComplete="off" className="sf-field" value={name} onChange={e => setName(e.target.value)} placeholder={kind === 'stored' ? '例如超市禮品卡' : kind === 'count' ? '例如游泳十次卡' : '例如餐飲禮券'} /></label>
    <label>幣別<select className="sf-field" disabled={!!original} value={unit} onChange={e => setUnit(e.target.value as Currency)}>{Object.values(Currency).map(code => <option key={code}>{code}</option>)}</select></label>
    {!original && <label>{kind === 'stored' ? '現有餘額' : '現有數量'}<input className="sf-field" inputMode={kind === 'stored' ? 'decimal' : 'numeric'} value={amount} onChange={e => setAmount(e.target.value)} /></label>}
    {kind === 'voucher' && <label>每張面額（可留空）<input className="sf-field" inputMode="decimal" value={face} onChange={e => setFace(e.target.value)} /></label>}
    <label>到期日（可留空）<input className="sf-field" type="date" value={expires} onChange={e => setExpires(e.target.value)} /></label>
    <label>備註<input className="sf-field" value={notes} onChange={e => setNotes(e.target.value)} /></label>
    {!original && kind === 'stored' && <p className="text-sm text-gray-400">餘額及增值不計支出，使用時記帳。</p>}
    <button className="sf-primary-button" type="submit">{busy ? '儲存中…' : '儲存卡券'}</button>
  </fieldset></form>;
}
function WalletAction({ item, action, busy, onSave, onError }: { item: WalletItem; action: 'add' | 'use'; busy: boolean; onSave: (amount: number, date: string, note: string, eventId: string) => void; onError: (message: string) => void }) {
  const eventId = useRef(makeId('wallet-event'));
  const [amount, setAmount] = useState(action === 'use' ? '1' : '');
  const [date, setDate] = useState(toLocalYMD(new Date()));
  const [note, setNote] = useState('');
  return <form onSubmit={e => { e.preventDefault(); const value = item.kind === 'stored' ? parseMoneyInput(amount, item.currency) : /^\d+$/.test(amount) ? Number(amount) : null; if (value === null || value <= 0 || !parseLocalYMD(date) || date > toLocalYMD(new Date())) { onError('請輸入有效金額／整數數量及今日或之前的日期'); return; } onSave(value, date, note, eventId.current); }}><fieldset disabled={busy} className="sf-wallet-form">
    <label>{item.kind === 'stored' ? '增值金額' : '數量'}<input className="sf-field" inputMode={item.kind === 'stored' ? 'decimal' : 'numeric'} value={amount} onChange={e => setAmount(e.target.value)} /></label>
    <label>日期<input className="sf-field" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
    <label>備註<input className="sf-field" value={note} onChange={e => setNote(e.target.value)} /></label>
    {item.kind === 'stored' && <p className="text-sm text-gray-400">增值只更新餘額。</p>}
    <button className="sf-primary-button">{busy ? '儲存中…' : '確認'}</button>
  </fieldset></form>;
}
