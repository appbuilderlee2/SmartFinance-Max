
import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Plus, Pencil } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { toLocalYMD, calendarDaysUntil } from '../utils/date';
import { formatMoney, roundMoney, sumMoney } from '../utils/money';
import { Currency } from '../types';
import { subscriptionMonthly, subscriptionForecast, subscriptionCycleLabel, subscriptionActive } from '../utils/subscriptionSchedule';
import { downloadSubscriptionCalendar } from '../utils/subscriptionCalendar';
import SubscriptionServiceIcon from '../components/SubscriptionServiceIcon';

const Subscriptions: React.FC = () => {
   const navigate = useNavigate();
   const location = useLocation();
   const { subscriptions, currency, categories } = useData();

   const categoryById = useMemo(() => {
      return new Map(categories.map(c => [c.id, c] as const));
   }, [categories]);
   const [filterCategory, setFilterCategory] = useState<string>('all');
   const [status, setStatus] = useState('active');
   const [query, setQuery] = useState('');
   const [card, setCard] = useState('');
   const { creditCards } = useData();
   const [selectedCurrency, setSelectedCurrency] = useState<Currency>(currency);
   const fromPath = (location.state as any)?.from || '/wallet';

   const getSubIcon = (name: string) => {
      const lower = name.toLowerCase();
      if (lower.includes('netflix')) return '🎬';
      if (lower.includes('spotify')) return '🎵';
      if (lower.includes('youtube')) return '▶️';
      if (lower.includes('disney')) return '🧞';
      if (lower.includes('icloud') || lower.includes('apple')) return '🍎';
      if (lower.includes('hbo') || lower.includes('max')) return '📺';
      if (lower.includes('prime')) return '📦';
      if (lower.includes('chatgpt') || lower.includes('openai')) return '🤖';
      if (lower.includes('dropbox')) return '🗄️';
      return null;
   };

   const availableCurrencies = useMemo(() => {
      const values = new Set<Currency>([currency]);
      subscriptions.forEach(sub => values.add(sub.currency || currency));
      return Array.from(values);
   }, [subscriptions, currency]);

   const filteredSubs = useMemo(() => {
      const base = subscriptions.filter((subscription) => {
         if (status !== 'all' && (subscription.status || 'active') !== status) return false;
         if (query && !subscription.name.toLowerCase().includes(query.toLowerCase())) return false;
         if (card && subscription.cardId !== card) return false;
         if ((subscription.currency || currency) !== selectedCurrency) return false;
         return filterCategory === 'all' || subscription.categoryId === filterCategory;
      });
      return [...base].sort((a, b) => {
         const ad = a.nextBillingDate || '';
         const bd = b.nextBillingDate || '';
         if (!ad && !bd) return 0;
         if (!ad) return 1;
         if (!bd) return -1;
         return ad.localeCompare(bd);
      });
   }, [subscriptions, filterCategory, selectedCurrency, currency, status, query, card]);

   const monthlyAmounts = filteredSubs.map((sub) => {
      return roundMoney(subscriptionMonthly(sub, toLocalYMD(new Date())), selectedCurrency);
   });
   const totalMonthly = sumMoney(monthlyAmounts, selectedCurrency);
   const today = toLocalYMD(new Date());
   const endDate = new Date(); endDate.setDate(endDate.getDate() + 29);
   const upcoming = sumMoney(filteredSubs.flatMap(s => subscriptionForecast(s, today, toLocalYMD(endDate))).map(r => r.amount), selectedCurrency);

   return (
      <div className="min-h-screen bg-background pb-24 pt-safe-top">
         <div className="px-4 py-3 flex justify-between items-center sf-topbar sticky top-0 z-50">
            <button
               onClick={() => navigate(fromPath, { replace: true })}
               className="flex items-center text-primary"
            >
               <ChevronLeft size={24} />
            </button>
            <h2 className="text-lg font-semibold">訂閱服務</h2>
            <button
               onClick={() => navigate('/add-subscription', { state: { from: fromPath, returnTo: '/subscriptions' } })}
               aria-label="新增訂閱"
               className="w-11 h-11 flex items-center justify-center text-primary"
            >
               <Plus size={24} />
            </button>
         </div>

         <div className="p-4 space-y-6">
            <div className="text-center mb-6">
               <p className="text-gray-400 text-sm">每月平均開支</p>
               <h1 className="text-4xl font-bold mt-1">{formatMoney(totalMonthly, selectedCurrency)}</h1>
               <p className="mt-4 text-sm text-gray-400">未來 30 日預計扣款</p><p className="text-2xl font-semibold">{formatMoney(upcoming, selectedCurrency)}</p>
            </div>
            <input aria-label="搜尋訂閱" className="sf-field w-full" placeholder="搜尋訂閱" value={query} onChange={e => setQuery(e.target.value)} />
            <div className="flex gap-2 overflow-x-auto">{[['active','使用中'],['paused','已暫停'],['cancelled','已取消'],['all','全部']].map(([key,label]) => <button key={key} className={`shrink-0 px-4 py-2 rounded-xl text-sm ${status === key ? 'bg-primary text-white' : 'sf-control'}`} onClick={() => setStatus(key)}>{label}</button>)}</div>

            <div className="sf-panel rounded-xl p-3 grid grid-cols-2 gap-3 text-sm">
               <label className="space-y-1">
                  <span className="text-xs text-gray-400">幣別</span>
                  <select
                     value={selectedCurrency}
                     aria-label="訂閱幣別篩選"
                     onChange={(e) => setSelectedCurrency(e.target.value as Currency)}
                     className="sf-control text-white rounded-lg px-3 py-2 text-sm w-full"
                  >
                     {availableCurrencies.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
               </label>
               <label className="space-y-1">
                  <span className="text-xs text-gray-400">分類</span>
                  <select
                     value={filterCategory}
                     aria-label="訂閱分類篩選"
                     onChange={(e) => setFilterCategory(e.target.value)}
                     className="sf-control text-white rounded-lg px-3 py-2 text-sm w-full"
                  >
                     <option value="all">全部</option>
                     {categories.filter(c => c.type === 'EXPENSE').map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                     ))}
                  </select>
               </label>
            </div>
            <select aria-label="付款信用卡篩選" className="sf-field w-full" value={card} onChange={e => setCard(e.target.value)}><option value="">所有付款方式</option>{creditCards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>

            <div className="space-y-3">
               {filteredSubs.length === 0 ? (
                  <div className="text-center text-gray-500 py-10">尚無訂閱</div>
               ) : (
                  filteredSubs.map(sub => {
                     const catName = categoryById.get(sub.categoryId || '')?.name || '未分類';
                     const daysLeft = calendarDaysUntil(sub.nextBillingDate);
                     const iconEmoji = sub.icon?.startsWith('emoji:') ? sub.icon.replace('emoji:', '') : (sub.icon || getSubIcon(sub.name));
                     return (
                     <div key={sub.id} className="sf-panel p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <SubscriptionServiceIcon icon={sub.icon || iconEmoji || undefined} name={sub.name} />
                           <div>
                              <h3 className="font-semibold">{sub.name}</h3>
                              <p className="text-xs text-gray-500">{sub.status === 'paused' ? '已暫停' : sub.status === 'cancelled' ? (sub.serviceEndDate ? (sub.serviceEndDate < today ? '服務已到期' : `有效至 ${sub.serviceEndDate}`) : '已取消續訂') : `下次扣款: ${sub.nextBillingDate || '已結束'}`}</p>
                              <p className="text-xs text-gray-400">分類: {catName}</p>
                              {daysLeft !== null && subscriptionActive(sub) && (
                                 <p className="text-[11px] text-primary mt-1">
                                    {daysLeft < 0 ? `已逾期 ${Math.abs(daysLeft)} 天` : `距扣款還有 ${daysLeft} 天`}
                                 </p>
                              )}
                              {sub.trialEndDate && sub.trialEndDate > today && <p className="text-xs text-primary">試用至 {sub.trialEndDate}</p>}
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="font-bold">{formatMoney(sub.amount, sub.currency || currency)}</p>
                           <p className="text-xs text-gray-500">
                              {subscriptionCycleLabel(sub)}
                           </p>
                           <button
                              onClick={() => navigate(`/subscriptions/${sub.id}/edit`, { state: { from: fromPath, returnTo: '/subscriptions' } })}
                              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                           >
                              <Pencil size={14} /> 編輯
                           </button>
                           {subscriptionActive(sub) && <button className="block mt-2 text-xs text-primary" onClick={() => downloadSubscriptionCalendar(sub)}>加入日曆</button>}
                        </div>
                     </div>
                  )})
               )}
            </div>

         </div>
      </div>
   );
};

export default Subscriptions;
