
import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Plus, Pencil } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { getCurrencySymbol } from '../utils/currency';
import { toLocalYMD } from '../utils/date';

const Subscriptions: React.FC = () => {
   const navigate = useNavigate();
   const location = useLocation();
   const { subscriptions, currency, categories } = useData();

   const categoryById = useMemo(() => {
      return new Map(categories.map(c => [c.id, c] as const));
   }, [categories]);
   const [filterCategory, setFilterCategory] = useState<string>('all');
   const fromPath = (location.state as any)?.from || '/settings';

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

   // Calculate monthly total roughly
   const filteredSubs = useMemo(() => {
      const base = filterCategory === 'all' ? subscriptions : subscriptions.filter(s => s.categoryId === filterCategory);
      const today = toLocalYMD(new Date());
      return [...base].sort((a, b) => {
         const ad = a.nextBillingDate || '';
         const bd = b.nextBillingDate || '';
         if (!ad && !bd) return 0;
         if (!ad) return 1;
         if (!bd) return -1;
         // Sort by absolute proximity to today, then earlier date first
         const aDiff = Math.abs(new Date(ad).getTime() - new Date(today).getTime());
         const bDiff = Math.abs(new Date(bd).getTime() - new Date(today).getTime());
         if (aDiff === bDiff) return new Date(ad).getTime() - new Date(bd).getTime();
         return aDiff - bDiff;
      });
   }, [subscriptions, filterCategory]);

   const totalMonthly = filteredSubs.reduce((acc, sub) => {
      if (sub.billingCycle === 'Weekly') return acc + (sub.amount * 4);
      if (sub.billingCycle === 'Monthly') return acc + sub.amount;
      if (sub.billingCycle === 'BiWeekly') return acc + (sub.amount * 2);
      if (sub.billingCycle === 'Yearly') return acc + (sub.amount / 12);
      return acc;
   }, 0);

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
            <div className="flex gap-4">
               {/* Sort Icon placeholder */}
            </div>
         </div>

         <div className="p-4 space-y-6">
            <div className="text-center mb-6">
               <p className="text-gray-400 text-sm">每月總計 (估算：每週×4、每2週×2、每年÷12)</p>
               <h1 className="text-4xl font-bold mt-1">{getCurrencySymbol(currency)} {Math.round(totalMonthly).toLocaleString()}</h1>
            </div>

            <div className="sf-panel rounded-xl p-3 flex items-center justify-between text-sm">
               <span className="text-gray-300">分類篩選</span>
               <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="sf-control text-white rounded-lg px-3 py-2 text-sm"
               >
                  <option value="all">全部</option>
                  {categories.filter(c => c.type === 'EXPENSE').map(cat => (
                     <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
               </select>
            </div>

            <div className="space-y-3">
               {filteredSubs.length === 0 ? (
                  <div className="text-center text-gray-500 py-10">尚無訂閱</div>
               ) : (
                  filteredSubs.map(sub => {
                     const catName = categoryById.get(sub.categoryId || '')?.name || '未分類';
                     const daysLeft = sub.nextBillingDate
                        ? Math.ceil((new Date(sub.nextBillingDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                        : null;
                     const iconEmoji = sub.icon?.startsWith('emoji:') ? sub.icon.replace('emoji:', '') : (sub.icon || getSubIcon(sub.name));
                     return (
                     <div key={sub.id} className="sf-panel p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center text-white font-bold text-lg shadow-lg uppercase">
                              {iconEmoji || sub.name[0]}
                           </div>
                           <div>
                              <h3 className="font-semibold">{sub.name}</h3>
                              <p className="text-xs text-gray-500">下次扣款: {sub.nextBillingDate || '已停用續訂'}</p>
                              <p className="text-xs text-gray-400">分類: {catName}</p>
                              {daysLeft !== null && (
                                 <p className="text-[11px] text-primary mt-1">
                                    {daysLeft < 0 ? `已逾期 ${Math.abs(daysLeft)} 天` : `距扣款還有 ${daysLeft} 天`}
                                 </p>
                              )}
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="font-bold">{getCurrencySymbol(currency)} {sub.amount}</p>
                           <p className="text-xs text-gray-500">
                              {sub.billingCycle === 'Weekly'
                                 ? '每週（約每月×4）'
                                 : sub.billingCycle === 'BiWeekly'
                                    ? '每2週（約每月×2）'
                                    : sub.billingCycle === 'Monthly'
                                       ? '每月'
                                       : '每年（約每月÷12）'}
                           </p>
                           <button
                              onClick={() => navigate(`/subscriptions/${sub.id}/edit`, { state: { from: fromPath, returnTo: '/subscriptions' } })}
                              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                           >
                              <Pencil size={14} /> 編輯
                           </button>
                        </div>
                     </div>
                  )})
               )}
            </div>

            <button
               onClick={() => navigate('/add-subscription', { state: { from: fromPath, returnTo: '/subscriptions' } })}
               className="fixed bottom-24 right-6 w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg text-white active:scale-95 transition-transform"
            >
               <Plus size={30} />
            </button>
         </div>
      </div>
   );
};

export default Subscriptions;
