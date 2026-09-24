import { useMemo, useState, useLayoutEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, SlidersHorizontal, Download } from 'lucide-react';
import { useLedger } from '../contexts/DataContext';
import { Currency, TransactionType } from '../types';
import { formatMoney, addMoney, sumMoney } from '../utils/money';
import { toLocalYMD, parseDate } from '../utils/date';
import { monthRange, reportTotals, selectReportRows, ReportFilter } from '../utils/reporting';
import { userTags } from '../utils/tags';
import BottomSheet from '../components/BottomSheet';

interface ReportViewState {
  month: number; preset: string; filter: ReportFilter;
  tab: 'overview' | 'categories' | 'trend'; kind: TransactionType;
  detail: string | null; visible: number; scrollY: number;
}

export default function Reports() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  const saved = (location.state as { reportView?: ReportViewState } | null)?.reportView;
  const { transactions, categories, currency, budgets } = useLedger();
  const now = new Date(), thisMonth = now.getFullYear() * 12 + now.getMonth();
  const [month, setMonth] = useState(saved?.month ?? thisMonth);
  const [preset, setPreset] = useState(saved?.preset ?? 'month');
  const initialTag = params.get('tag');
  const [filter, setFilter] = useState<ReportFilter>(() => saved?.filter ?? ({ ...monthRange(thisMonth), currency, note: '', tags: initialTag ? [initialTag] : [], categories: [], min: '', max: '' }));
  const [draft, setDraft] = useState(filter);
  const [draftPreset, setDraftPreset] = useState(preset);
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'categories' | 'trend'>(saved?.tab ?? 'overview');
  const [kind, setKind] = useState(saved?.kind ?? TransactionType.EXPENSE);
  const [detail, setDetail] = useState<string | null>(saved?.detail ?? null);
  const [visible, setVisible] = useState(saved?.visible ?? 50);
  useLayoutEffect(() => { if (saved) window.scrollTo(0, saved.scrollY); }, []);
  const leaveReport = (path: string) => {
    const reportView: ReportViewState = { month, preset, filter, tab, kind, detail, visible, scrollY: window.scrollY };
    navigate(location.pathname + location.search, { replace: true, state: { reportView } });
    navigate(path, { state: { fromReport: true } });
  };
  const names = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
  const currencies = useMemo(() => Array.from(new Set([currency, ...transactions.map(t => t.currency || currency)])), [transactions, currency]);
  const tags = useMemo(() => Array.from(new Set(transactions.flatMap(userTags))).sort(), [transactions]);
  const rows = useMemo(() => selectReportRows(transactions, filter, currency), [transactions, filter, currency]);
  const totals = useMemo(() => reportTotals(rows, filter.currency), [rows, filter.currency]);
  const money = (amount: number) => formatMoney(amount, filter.currency);
  const groups = useMemo(() => {
    const grouped = new Map<string, number[]>();
    rows.filter(t => t.type === kind).forEach(t => { const values = grouped.get(t.categoryId) || []; values.push(t.amount); grouped.set(t.categoryId, values); });
    return Array.from(grouped, ([id, values]) => ({ id, total: sumMoney(values, filter.currency), count: values.length })).sort((a, b) => b.total - a.total);
  }, [rows, kind, filter.currency]);
  const trend = useMemo(() => {
    const grouped = new Map<string, typeof rows>();
    rows.forEach(t => { const date = parseDate(t.date)!; const day = toLocalYMD(date); const key = preset === 'month' ? day.slice(5) : day.slice(0, 7); const values = grouped.get(key) || []; values.push(t); grouped.set(key, values); });
    return Array.from(grouped, ([label, values]) => ({ label, ...reportTotals(values, filter.currency) })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, filter.currency, preset]);
  const detailRows = useMemo(() => rows.filter(t => t.categoryId === detail && t.type === kind).sort((a, b) => b.date.localeCompare(a.date)), [rows, detail, kind]);
  const amountTotal = kind === TransactionType.EXPENSE ? totals.expense : totals.income;
  const budget = sumMoney(budgets.map(b => b.limit), currency);
  const extras = !!(filter.note || filter.tags.length || filter.categories.length || filter.min || filter.max);
  const title = preset === 'month' ? `${Math.floor(month / 12)}年${month % 12 + 1}月` : preset === 'year' ? `${now.getFullYear()}年` : preset === 'all' ? '全部期間' : '自訂期間';
  function moveMonth(next: number) { setMonth(next); setPreset('month'); setFilter(f => ({ ...f, ...monthRange(next) })); setDetail(null); }
  function exportCSV() {
    const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = [['日期','分類','類型','金額','幣別','備註','標籤'], ...rows.map(t => [toLocalYMD(parseDate(t.date)!), names.get(t.categoryId), t.type === TransactionType.EXPENSE ? '支出' : '收入', t.amount, filter.currency, t.note, userTags(t).join(' / ')])];
    const blob = new Blob(['\ufeff' + lines.map(line => line.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `報告-${title}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const trendMax = Math.max(1, ...trend.map(p => Math.max(p.income, p.expense)));
  const chart = <div className="space-y-3" aria-label="收支走勢">
    <div className="flex justify-between"><h2 className="font-semibold">{preset === 'month' ? '每日' : '每月'}收支走勢</h2><span className="text-xs text-gray-400">收入 / 支出</span></div>
    <div className="flex items-end gap-2 overflow-x-auto pb-2" style={{ height: 145 }}>{trend.map(point => {
      const max = trendMax;
      return <div key={point.label} className="flex-1 min-w-[38px] text-center"><div className="h-24 flex items-end justify-center gap-1"><div className="w-3 bg-emerald-400 rounded-t" style={{ height: `${point.income / max * 100}%` }} /><div className="w-3 bg-primary rounded-t" style={{ height: `${point.expense / max * 100}%` }} /></div><span className="text-[10px] text-gray-400">{point.label}</span></div>;
    })}</div>
    {tab === 'trend' && <div>{trend.map(p => <div className="sf-report-row text-sm" key={p.label}><span className="flex-1">{p.label}</span><span className="text-emerald-400">{money(p.income)}</span><span>{money(p.expense)}</span></div>)}</div>}
  </div>;
  return <main className="sf-report sf-reports-page">
    <header className="flex items-center justify-between py-2 gap-3"><button className="text-primary flex items-center" onClick={() => detail ? setDetail(null) : navigate('/settings')}><ChevronLeft size={20} />{detail ? '返回報告' : '返回設定'}</button><h1 className="font-semibold">報告統計</h1><button aria-label="匯出報告 CSV" onClick={exportCSV}><Download size={20} /></button></header>
    <div className="flex items-center gap-2 py-3"><div className="flex items-center justify-between flex-1 sf-control rounded-xl"><button aria-label="上一個月" onClick={() => moveMonth(month - 1)}><ChevronLeft size={18} /></button><span className="text-sm">{title}</span><button aria-label="下一個月" onClick={() => moveMonth(month + 1)}><ChevronRight size={18} /></button></div><select aria-label="報告幣別" value={filter.currency} onChange={e => setFilter(f => ({ ...f, currency: e.target.value as Currency }))} className="sf-control rounded-xl px-2 h-11 max-w-[100px]">{currencies.map(c => <option key={c}>{c}</option>)}</select><button aria-label="篩選報告" className="p-2 sf-control rounded-xl" onClick={() => { setDraft(filter); setDraftPreset(preset); setError(''); setSheet(true); }}><SlidersHorizontal size={20} /></button></div>
    <p className="text-xs text-gray-400 mb-3">{filter.start || '最早記錄'} — {filter.end || '最新記錄'} · 僅計算 {filter.currency}</p>
    {extras && <div className="flex items-center gap-2 text-xs mb-3"><span className="flex-1 break-words">已篩選 · {rows.length} 筆{filter.tags.length ? ` · ${filter.tags.join('、')}` : ''}</span><button className="text-primary" onClick={() => setFilter(f => ({ ...f, note: '', tags: [], categories: [], min: '', max: '' }))}>清除篩選</button></div>}
    {!detail && <nav aria-label="報告檢視" className="flex sf-control rounded-xl p-1 mb-5">{([['overview','總覽'],['categories','分類'],['trend','趨勢']] as const).map(([value, label]) => <button aria-pressed={tab === value} key={value} className={`flex-1 rounded-lg ${tab === value ? 'bg-primary text-white' : 'text-gray-400'}`} onClick={() => { setTab(value); setKind(TransactionType.EXPENSE); }}>{label}</button>)}</nav>}
    {!rows.length ? <section className="sf-report-surface text-center py-10"><h2 className="font-semibold">呢段期間未有交易</h2><p className="text-sm text-gray-400 my-3">試下查看其他期間，或清除篩選。</p><div className="flex justify-center gap-4"><button className="text-primary" onClick={() => moveMonth(month - 1)}>查看上月</button><button className="text-primary" onClick={() => { setPreset('all'); setFilter(f => ({ ...f, start: '', end: '' })); }}>全部期間</button></div></section> : detail ? <section>
      <h2 className="text-xl font-semibold mt-4">{names.get(detail) || '未分類'}</h2><div className="text-4xl font-semibold sf-report-value mt-3">{money(sumMoney(detailRows.map(t => t.amount), filter.currency))}</div><p className="text-sm text-gray-400 mt-2 mb-6">{kind === TransactionType.EXPENSE ? '支出' : '收入'} · {detailRows.length} 筆交易</p>
      <h3 className="font-semibold">交易明細</h3>{detailRows.slice(0, visible).map(tx => <button className="sf-report-row" key={tx.id} onClick={() => leaveReport(`/view/${tx.id}`)}><div className="flex-1 min-w-0"><div className="truncate">{tx.note || names.get(tx.categoryId)}</div><div className="text-xs text-gray-400 mt-1">{toLocalYMD(parseDate(tx.date)!)}{tx.subscriptionId ? ' · 訂閱' : tx.recurrenceSourceId || tx.isRecurring ? ' · 週期記帳' : ''}</div><div className="text-xs text-primary break-words">{userTags(tx).join(' · ')}</div></div><span>{money(tx.amount)}</span><ChevronRight size={16} /></button>)}{detailRows.length > visible && <button className="w-full text-primary" onClick={() => setVisible(v => v + 50)}>載入更多交易</button>}
    </section> : <div className="space-y-6">
      {tab === 'overview' && <><section><p className="text-gray-400">{title}支出</p><div className="text-4xl sm:text-5xl font-semibold text-red-400 sf-report-value mt-2">{money(totals.expense)}</div><div className="sf-report-surface grid grid-cols-2 gap-4 mt-5"><div><p className="text-xs text-gray-400">收入</p><strong className="text-emerald-400 sf-report-value">{money(totals.income)}</strong></div><div><p className="text-xs text-gray-400">結餘</p><strong className="sf-report-value">{money(addMoney(totals.income, -totals.expense, filter.currency))}</strong></div></div></section>{chart}
      {preset === 'month' && month === thisMonth && filter.currency === currency && !extras && budget > 0 && <div className="sf-report-surface"><div className="flex justify-between text-sm"><span>{totals.expense > budget ? '預算超出' : '預算剩餘'}</span><strong>{money(Math.abs(addMoney(budget, -totals.expense, currency)))}</strong></div><progress aria-label="預算使用" className="w-full mt-3 accent-blue-500" max={budget} value={Math.min(budget, totals.expense)} /><p className="text-xs text-gray-400">已使用 {Math.round(totals.expense / budget * 100)}%</p></div>}</>}
      {tab === 'trend' ? chart : <section><div className="flex items-center justify-between"><h2 className="font-semibold">{tab === 'overview' ? '錢花在哪裡' : '分類分佈'}</h2>{tab === 'overview' ? <button className="text-primary text-sm" onClick={() => setTab('categories')}>查看全部 ›</button> : <select aria-label="分類收支類型" className="sf-control p-2 rounded-lg" value={kind} onChange={e => setKind(e.target.value as TransactionType)}><option value={TransactionType.EXPENSE}>支出</option><option value={TransactionType.INCOME}>收入</option></select>}</div>
      {!groups.length && <p className="text-gray-400 py-5">此期間沒有{kind === TransactionType.EXPENSE ? '支出' : '收入'}。</p>}{groups.slice(0, tab === 'overview' ? 5 : undefined).map(group => <button className="sf-report-row" key={group.id} onClick={() => { setDetail(group.id); setVisible(50); }}><div className="flex-1 min-w-0"><span className="block truncate">{names.get(group.id) || '未分類'}</span><div className="h-1.5 bg-gray-500/15 rounded mt-2"><div className="bg-primary h-full rounded" style={{ width: `${amountTotal ? group.total / amountTotal * 100 : 0}%` }} /></div></div><div className="text-right"><strong className="text-sm">{money(group.total)}</strong><div className="text-xs text-gray-400">{amountTotal ? Math.round(group.total / amountTotal * 100) : 0}%</div></div><ChevronRight size={16} /></button>)}</section>}
      <button className="text-primary text-sm" onClick={() => leaveReport('/settings/tags')}>查看標籤統計與管理 ›</button>
    </div>}
    {sheet && <BottomSheet title="篩選報告" onClose={() => setSheet(false)}><div className="space-y-4"><div className="flex flex-wrap gap-2">{[['month','本月'],['last','上月'],['year','今年'],['all','全部'],['custom','自訂']].map(([value,label]) => <button key={value} className={`sf-tag ${draftPreset === value ? 'bg-primary text-white' : ''}`} onClick={() => { setDraftPreset(value); const range = value === 'month' || value === 'last' ? monthRange(thisMonth - (value === 'last' ? 1 : 0)) : value === 'year' ? { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` } : { start: '', end: '' }; setDraft(d => ({ ...d, ...range })); }}>{label}</button>)}</div>
    {draftPreset === 'custom' && <div className="grid grid-cols-2 gap-3"><label className="text-sm">開始日期<input type="date" className="sf-field" value={draft.start} onChange={e => setDraft(d => ({ ...d, start: e.target.value }))} /></label><label className="text-sm">結束日期<input type="date" className="sf-field" value={draft.end} onChange={e => setDraft(d => ({ ...d, end: e.target.value }))} /></label></div>}
    <label className="block text-sm">搜尋備註<input className="sf-field mt-2" placeholder="只搜尋備註文字" value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} /></label>
    <details><summary className="py-3 cursor-pointer">分類 · {draft.categories.length || '全部'}</summary><div className="flex flex-wrap gap-2">{categories.map(c => <button key={c.id} aria-pressed={draft.categories.includes(c.id)} className={`sf-tag ${draft.categories.includes(c.id) ? 'bg-primary text-white' : ''}`} onClick={() => setDraft(d => ({ ...d, categories: d.categories.includes(c.id) ? d.categories.filter(v => v !== c.id) : [...d.categories, c.id] }))}>{c.name}</button>)}</div></details>
    <details><summary className="py-3 cursor-pointer">標籤 · {draft.tags.length || '全部'}</summary><p className="text-xs text-gray-400 mb-2">多選時顯示符合任一標籤的交易。</p><div className="flex flex-wrap gap-2">{tags.map(tag => <button key={tag} aria-pressed={draft.tags.includes(tag)} className={`sf-tag ${draft.tags.includes(tag) ? 'bg-primary text-white' : ''}`} onClick={() => setDraft(d => ({ ...d, tags: d.tags.includes(tag) ? d.tags.filter(v => v !== tag) : [...d.tags, tag] }))}>{tag}</button>)}</div></details>
    <details><summary className="py-3 cursor-pointer">金額範圍</summary><div className="grid grid-cols-2 gap-3"><input aria-label="最小金額" type="number" min="0" className="sf-field" placeholder="最小金額" value={draft.min} onChange={e => setDraft(d => ({ ...d, min: e.target.value }))} /><input aria-label="最大金額" type="number" min="0" className="sf-field" placeholder="最大金額" value={draft.max} onChange={e => setDraft(d => ({ ...d, max: e.target.value }))} /></div></details>
    {error && <p role="alert" className="text-red-400">{error}</p>}<button className="sf-primary-button" onClick={() => {
      if ((draft.start && draft.end && draft.start > draft.end) || (draftPreset === 'custom' && (!draft.start || !draft.end))) { setError('請選擇有效的開始及結束日期'); return; }
      if ([draft.min, draft.max].some(v => v !== '' && (!Number.isFinite(Number(v)) || Number(v) < 0)) || (draft.min && draft.max && Number(draft.min) > Number(draft.max))) { setError('請檢查金額範圍'); return; }
      setFilter(draft); setPreset(draftPreset === 'last' ? 'month' : draftPreset); if (draftPreset === 'last' || draftPreset === 'month') setMonth(thisMonth - (draftPreset === 'last' ? 1 : 0)); setDetail(null); setSheet(false);
    }}>套用篩選</button><button className="w-full text-gray-400" onClick={() => { setDraft({ ...monthRange(thisMonth), currency, note: '', tags: [], categories: [], min: '', max: '' }); setDraftPreset('month'); }}>重設</button></div></BottomSheet>}
  </main>;
}
