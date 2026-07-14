
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, GripVertical, Plus, Trash2, Edit2, X } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { Icon } from '../components/Icon';
import { TransactionType, Category } from '../types';
import { makeId } from '../utils/id';

const AVAILABLE_COLORS = [
   'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500',
   'bg-teal-500', 'bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-gray-500'
];

const AVAILABLE_ICONS = [
   'Utensils', 'Car', 'Film', 'ShoppingBag', 'Home', 'Heart', 'Tag', 'Briefcase',
   'Gift', 'Plane', 'Coffee', 'Book', 'Music', 'Gamepad2', 'Dumbbell', 'Pill',
   'Wallet', 'CreditCard', 'Banknote', 'TrendingUp', 'Building2', 'Bus', 'Train'
];

const AVAILABLE_EMOJIS = [
   '🍔', '🍕', '☕', '🛒', '🏠', '💰', '💳', '🚗', '✈️', '🎬',
   '📱', '💊', '🎮', '📚', '🎵', '💪', '🐾', '👶', '🎁', '💡',
   '🔧', '🎨', '🌿', '🍺', '💄', '👔', '🏥', '🎓', '🏦', '🛠️'
];

const CategoryManager: React.FC = () => {
   const navigate = useNavigate();
   const { categories, deleteCategory, addCategory, updateCategory, reorderCategories } = useData();
   const [activeTab, setActiveTab] = useState<TransactionType>(TransactionType.EXPENSE);
   const [showModal, setShowModal] = useState(false);
   const [editingCategory, setEditingCategory] = useState<Category | null>(null);
   const [isReorderMode, setIsReorderMode] = useState(false);
   const [draggingId, setDraggingId] = useState<string | null>(null);
   const dragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   const listRef = useRef<HTMLDivElement | null>(null);
   const lastHoverIdRef = useRef<string | null>(null);
   const [orderIds, setOrderIds] = useState<string[]>([]);
   const [formData, setFormData] = useState({
      name: '',
      icon: 'Tag',
      color: 'bg-gray-500',
      order: 1
   });
   const [iconTab, setIconTab] = useState<'icons' | 'emoji'>('icons');
   const [customEmoji, setCustomEmoji] = useState('');

   const filteredCategories = categories.filter(c => c.type === activeTab);
   const displayedCategories = orderIds.length
      ? orderIds.map(id => filteredCategories.find(c => c.id === id)).filter(Boolean) as Category[]
      : filteredCategories;

   const swapCategoryOrder = (firstId: string, secondId: string) => {
      setOrderIds(prev => {
         const base = prev.length ? [...prev] : filteredCategories.map(c => c.id);
         const firstIdx = base.indexOf(firstId);
         const secondIdx = base.indexOf(secondId);
         if (firstIdx < 0 || secondIdx < 0) return base;
         [base[firstIdx], base[secondIdx]] = [base[secondIdx], base[firstIdx]];
         return base;
      });
   };

   const clearDragTimer = () => {
      if (dragTimerRef.current) {
         clearTimeout(dragTimerRef.current);
         dragTimerRef.current = null;
      }
   };

  const endDrag = () => {
    clearDragTimer();
    if (orderIds.length) {
      reorderCategories(activeTab, orderIds);
      setOrderIds([]);
    }
    setDraggingId(null);
    lastHoverIdRef.current = null;
  };

  useEffect(() => {
    if (!draggingId) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    const preventScroll = (e: TouchEvent) => {
      e.preventDefault();
    };
    window.addEventListener('touchmove', preventScroll, { passive: false });
    return () => {
      window.removeEventListener('touchmove', preventScroll);
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [draggingId]);

   useEffect(() => {
      if (draggingId) return;
      setOrderIds(filteredCategories.map(c => c.id));
   }, [filteredCategories, draggingId]);

   const startLongPress = (id: string, e?: React.PointerEvent) => {
      clearDragTimer();
      dragTimerRef.current = setTimeout(() => {
         setIsReorderMode(true);
         setDraggingId(id);
         if (e?.currentTarget && 'setPointerCapture' in e.currentTarget) {
            e.currentTarget.setPointerCapture(e.pointerId);
         }
      }, 300);
   };

   const startDragImmediate = (id: string, e: React.PointerEvent) => {
      clearDragTimer();
      setIsReorderMode(true);
      setDraggingId(id);
      if ('setPointerCapture' in e.currentTarget) {
         e.currentTarget.setPointerCapture(e.pointerId);
      }
   };

   const handlePointerMove = (e: React.PointerEvent) => {
      if (!draggingId) return;
      e.preventDefault();
      if (listRef.current) {
         const rect = listRef.current.getBoundingClientRect();
         const edgeThreshold = 48;
         const maxSpeed = 12;
         if (e.clientY < rect.top + edgeThreshold) {
            const strength = 1 - (e.clientY - rect.top) / edgeThreshold;
            listRef.current.scrollTop -= Math.ceil(maxSpeed * strength);
         } else if (e.clientY > rect.bottom - edgeThreshold) {
            const strength = 1 - (rect.bottom - e.clientY) / edgeThreshold;
            listRef.current.scrollTop += Math.ceil(maxSpeed * strength);
         }
      }
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const card = target?.closest?.('[data-cat-id]') as HTMLElement | null;
      const hoverId = card?.getAttribute('data-cat-id') || null;
      if (!hoverId || hoverId === draggingId) return;
      if (lastHoverIdRef.current === hoverId) return;
      lastHoverIdRef.current = hoverId;
      swapCategoryOrder(draggingId, hoverId);
   };
   const handleDelete = (id: string, name: string) => {
      if (window.confirm(`確定要刪除「${name}」分類嗎？`)) {
         deleteCategory(id);
      }
   };

   const openAddModal = () => {
      const maxOrder = filteredCategories.reduce((max, c) => {
         const val = typeof c.order === 'number' ? c.order : 0;
         return Math.max(max, val);
      }, 0);
      setEditingCategory(null);
      setFormData({ name: '', icon: 'Tag', color: 'bg-gray-500', order: maxOrder + 1 });
      setIconTab('icons');
      setCustomEmoji('');
      setShowModal(true);
   };

   const openEditModal = (cat: Category) => {
      setEditingCategory(cat);
      setFormData({
         name: cat.name,
         icon: cat.icon,
         color: cat.color,
         order: typeof cat.order === 'number' ? cat.order : 1
      });
      if (cat.icon.startsWith('emoji:')) {
         setIconTab('emoji');
         setCustomEmoji(cat.icon.replace('emoji:', ''));
      } else {
         setIconTab('icons');
         setCustomEmoji('');
      }
      setShowModal(true);
   };

   const handleSave = () => {
      if (!formData.name.trim()) {
         alert('請輸入分類名稱');
         return;
      }

      if (editingCategory) {
         updateCategory(editingCategory.id, {
            name: formData.name,
            icon: formData.icon,
            color: formData.color,
            order: formData.order
         });
      } else {
         addCategory({
            id: makeId('cat'),
            name: formData.name,
            icon: formData.icon,
            color: formData.color,
            type: activeTab,
            order: formData.order
         });
      }
      setShowModal(false);
   };

   return (
      <div className="min-h-screen bg-background pt-safe-top pb-20">
         <div className="px-4 py-3 flex justify-between items-center sf-topbar sticky top-0 z-50">
            <button onClick={() => navigate(-1)} className="flex items-center text-primary">
               <ChevronLeft size={24} />
            </button>
            <h2 className="text-lg font-semibold">分類管理</h2>
            <div className="flex items-center gap-3">
               <button
                  onClick={() => {
                     setIsReorderMode(v => !v);
                     endDrag();
                  }}
                  className="text-primary text-sm"
               >
                  {isReorderMode ? '完成' : '編輯'}
               </button>
               <button onClick={openAddModal} className="text-primary text-xl"><Plus /></button>
            </div>
         </div>

         {/* Tabs */}
         <div className="p-4">
            <div className="flex sf-control rounded-xl p-1">
               <button
                  onClick={() => setActiveTab(TransactionType.EXPENSE)}
                  className={`flex-1 py-2 rounded-lg text-sm transition-all ${activeTab === TransactionType.EXPENSE ? 'bg-red-500 text-white' : 'text-gray-400'
                     }`}
               >
                  支出分類
               </button>
               <button
                  onClick={() => setActiveTab(TransactionType.INCOME)}
                  className={`flex-1 py-2 rounded-lg text-sm transition-all ${activeTab === TransactionType.INCOME ? 'bg-green-500 text-white' : 'text-gray-400'
                     }`}
               >
                  收入分類
               </button>
            </div>
         </div>

         <div
            ref={listRef}
            className={`px-4 space-y-3 overflow-y-auto ${draggingId ? 'touch-none' : ''}`}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
         >
            {displayedCategories.map(cat => (
               <div
                  key={cat.id}
                  data-cat-id={cat.id}
                  className={`sf-panel rounded-xl p-4 flex items-center justify-between group active:scale-[0.99] transition-transform ${draggingId === cat.id ? 'ring-2 ring-primary shadow-xl scale-[1.04] bg-surface/80' : ''}`}
               >
                  <div className="flex items-center gap-3">
                     {isReorderMode && (
                        <button
                           onPointerDown={(e) => startDragImmediate(cat.id, e)}
                           onPointerUp={clearDragTimer}
                           onPointerLeave={clearDragTimer}
                           className={`text-gray-500 hover:text-gray-300 cursor-move ${draggingId === cat.id ? 'text-primary' : ''}`}
                           aria-label="Drag"
                        >
                           <GripVertical size={18} />
                        </button>
                     )}
                     <div
                        onPointerDown={(e) => startLongPress(cat.id, e)}
                        onPointerUp={clearDragTimer}
                        onPointerLeave={clearDragTimer}
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${cat.color} text-white ${isReorderMode ? 'cursor-move' : ''}`}
                     >
                        {cat.icon.startsWith('emoji:')
                           ? <span className="text-lg">{cat.icon.replace('emoji:', '')}</span>
                           : <Icon name={cat.icon} size={20} />}
                     </div>
                     <span className="text-white font-medium">{cat.name}</span>
                  </div>
                  <div className="flex gap-2 text-gray-400 items-center">
                     <button onClick={() => openEditModal(cat)} className="hover:text-blue-400"><Edit2 size={20} /></button>
                     <button onClick={() => handleDelete(cat.id, cat.name)} className="hover:text-red-400"><Trash2 size={20} /></button>
                  </div>
               </div>
            ))}

            {filteredCategories.length === 0 && (
               <div className="text-center text-gray-500 py-10">尚無{activeTab === TransactionType.EXPENSE ? '支出' : '收入'}分類</div>
            )}
         </div>

         {/* Add/Edit Modal */}
         {showModal && (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
               <div className="sf-panel w-full rounded-t-3xl p-6 pb-safe-bottom animate-slide-up">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="text-lg font-semibold text-white">
                        {editingCategory ? '編輯分類' : '新增分類'}
                     </h3>
                     <button onClick={() => setShowModal(false)} className="text-gray-400">
                        <X size={24} />
                     </button>
                  </div>

                  <div className="space-y-4">
                     <div>
                        <label className="text-gray-400 text-sm mb-1 block">分類名稱</label>
                        <input
                           type="text"
                           placeholder="輸入名稱"
                           value={formData.name}
                           onChange={e => setFormData({ ...formData, name: e.target.value })}
                           className="w-full sf-control rounded-xl p-3 text-white"
                        />
                     </div>

                     <div>
                        <label className="text-gray-400 text-sm mb-2 block">選擇圖示</label>
                        <div className="flex gap-2 mb-3">
                           <button
                              onClick={() => setIconTab('icons')}
                              className={`flex-1 py-1.5 text-xs rounded-lg ${iconTab === 'icons' ? 'bg-primary text-white' : 'sf-control text-gray-400'}`}
                           >
                              圖示
                           </button>
                           <button
                              onClick={() => setIconTab('emoji')}
                              className={`flex-1 py-1.5 text-xs rounded-lg ${iconTab === 'emoji' ? 'bg-primary text-white' : 'sf-control text-gray-400'}`}
                           >
                              表情符號
                           </button>
                        </div>
                        {iconTab === 'icons' ? (
                           <div className="grid grid-cols-8 gap-2 max-h-32 overflow-y-auto">
                              {AVAILABLE_ICONS.map(icon => (
                                 <button
                                    key={icon}
                                    onClick={() => setFormData({ ...formData, icon })}
                                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${formData.icon === icon ? 'bg-primary text-white' : 'sf-control text-gray-400'}`}
                                 >
                                    <Icon name={icon} size={20} />
                                 </button>
                              ))}
                           </div>
                        ) : (
                           <div className="space-y-2">
                              <div className="sf-control rounded-xl px-3 py-2">
                                 <input
                                    type="text"
                                    inputMode="text"
                                    value={customEmoji}
                                    onChange={(e) => {
                                       const value = e.target.value;
                                       setCustomEmoji(value);
                                       const trimmed = value.trim();
                                       if (trimmed) {
                                          setFormData({ ...formData, icon: `emoji:${trimmed}` });
                                       }
                                    }}
                                    placeholder="輸入表情符號"
                                    className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm"
                                 />
                              </div>
                              <div className="grid grid-cols-8 gap-2 max-h-32 overflow-y-auto">
                                 {AVAILABLE_EMOJIS.map(emoji => (
                                    <button
                                       key={emoji}
                                       onClick={() => {
                                          setCustomEmoji(emoji);
                                          setFormData({ ...formData, icon: `emoji:${emoji}` });
                                       }}
                                       className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all ${formData.icon === `emoji:${emoji}` ? 'bg-primary' : 'sf-control'}`}
                                    >
                                       {emoji}
                                    </button>
                                 ))}
                              </div>
                           </div>
                        )}
                     </div>

                     <div>
                        <label className="text-gray-400 text-sm mb-2 block">選擇顏色</label>
                        <div className="flex gap-2 flex-wrap">
                           {AVAILABLE_COLORS.map(color => (
                              <button
                                 key={color}
                                 onClick={() => setFormData({ ...formData, color })}
                                 className={`w-8 h-8 rounded-full ${color} transition-all ${formData.color === color ? 'ring-2 ring-white scale-110' : ''
                                    }`}
                              />
                           ))}
                        </div>
                     </div>

                     <button
                        onClick={handleSave}
                        className="w-full bg-primary py-4 rounded-xl font-bold text-white mt-4"
                     >
                        {editingCategory ? '儲存變更' : '新增分類'}
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};

export default CategoryManager;
