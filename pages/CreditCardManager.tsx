
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, CreditCard, Trash2, X, Pencil, ArrowUp, ArrowDown, Cloud, Search } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { CardCatalogItem, fetchCardCatalog } from '../services/cardCatalog';
import { makeId } from '../utils/id';
import { getCurrentYearMonth, createOpenCycle } from '../utils/creditCardCycles';
import { loadCycles, saveCycles, upsertCycle } from '../utils/creditCardCycleStorage';

interface CreditCardType {
    id: string;
    name: string;
    lastFourDigits?: string;
    annualFee: number;
    feeMonth?: number; // 1-12 (optional when annualFee=0)
    cashbackType: string;
    expiryDate: string; // YYYY-MM
    creditLimit?: number;
    imageUrl?: string;
    rewardCategories?: string[];

    statementDay?: number; // 1-31 截數日
    dueDay?: number; // 1-31 繳費日
    dueInNextMonth?: boolean; // 繳費日是否屬於截數後下一個月
    remindStatement?: boolean;
    remindDue?: boolean;
}

const CreditCardManager: React.FC = () => {
    const navigate = useNavigate();
    const { creditCards, addCreditCard, updateCreditCard, deleteCreditCard, setCreditCards } = useData();

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [catalogError, setCatalogError] = useState<string | null>(null);
    const [catalog, setCatalog] = useState<CardCatalogItem[]>([]);
    const [catalogQuery, setCatalogQuery] = useState('');
    const [formData, setFormData] = useState<Partial<CreditCardType>>({
        name: '',
        lastFourDigits: '',
        annualFee: 0,
        feeMonth: undefined,
        cashbackType: '',
        expiryDate: '',
        creditLimit: undefined,
        imageUrl: undefined,
        rewardCategories: [],
        statementDay: undefined,
        dueDay: undefined,
        dueInNextMonth: true,
        remindStatement: true,
        remindDue: true,
    });

    const openAddModal = () => {
        setEditingId(null);
        setFormData({ name: '', lastFourDigits: '', annualFee: 0, feeMonth: undefined, cashbackType: '', expiryDate: '', creditLimit: undefined, imageUrl: undefined, rewardCategories: [], statementDay: undefined, dueDay: undefined, dueInNextMonth: true, remindStatement: true, remindDue: true });
        setCatalogQuery('');
        setCatalogError(null);
        setShowModal(true);
    };

    const openEditModal = (card: CreditCardType) => {
        setEditingId(card.id);
        setFormData({ ...card });
        setCatalogQuery('');
        setCatalogError(null);
        setShowModal(true);
    };

    const loadCatalog = async () => {
        setCatalogError(null);
        setCatalogLoading(true);
        try {
            const items = await fetchCardCatalog();
            setCatalog(items);
        } catch (err: any) {
            setCatalogError(err?.message || '載入失敗');
        } finally {
            setCatalogLoading(false);
        }
    };

    const applyCatalogItem = (item: CardCatalogItem) => {
        const points = item.sellingPoints?.filter(Boolean) || item.tags?.filter(Boolean) || [];
        setFormData((prev) => ({
            ...prev,
            name: item.name,
            cashbackType: points.length ? points.join('\n') : (prev.cashbackType || ''),
            imageUrl: item.imageUrl || prev.imageUrl,
            rewardCategories: item.rewardCategories || prev.rewardCategories || [],
        }));
    };

    const handleSave = () => {
        if (!formData.name) {
            alert('請填寫卡片名稱');
            return;
        }

        if (editingId) {
            updateCreditCard(editingId, formData);
        } else {
            const newCard = {
                ...formData,
                id: makeId('card')
            } as CreditCardType;

            addCreditCard(newCard);

            // Create initial cycle for the newly-added card (current YYYY-MM) so the cycle page isn't empty.
            const { year, month0, yearMonth } = getCurrentYearMonth(new Date());
            const existingId = `ccyc_${newCard.id}_${yearMonth}`;
            const existing = loadCycles().find((c: any) => c.id === existingId);
            if (!existing) {
                const cycle = createOpenCycle(newCard, year, month0);
                const updated = upsertCycle(loadCycles(), cycle);
                saveCycles(updated);
            }
        }

        setShowModal(false);
    };

    const moveCard = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === creditCards.length - 1) return;

        const newCards = [...creditCards];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newCards[index], newCards[targetIndex]] = [newCards[targetIndex], newCards[index]];

        setCreditCards(newCards);
    };

    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <div className="min-h-screen bg-background pb-20 pt-safe-top">
            {/* Header */}
            <div className="px-4 py-3 flex justify-between items-center sf-topbar sticky top-0 z-50">
                <button onClick={() => navigate(-1)} className="flex items-center text-primary">
                    <ChevronLeft size={24} />
                </button>
                <h2 className="text-lg font-semibold text-white">信用卡管理</h2>
                <button onClick={openAddModal} className="text-primary">
                    <Plus size={24} />
                </button>
            </div>

            <div className="p-4 space-y-4">
                {creditCards.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <CreditCard size={48} className="mx-auto mb-4 opacity-50" />
                        <p>尚未新增信用卡</p>
                        <button
                            onClick={openAddModal}
                            className="mt-4 text-primary"
                        >
                            + 新增信用卡
                        </button>
                    </div>
                ) : (
                    creditCards.map((card, index) => (
                        <div key={card.id} className="sf-panel p-4 relative group">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center overflow-hidden">
                                        {card.imageUrl ? (
                                            <img src={card.imageUrl} alt={card.name} className="w-full h-full object-contain bg-black/20" />
                                        ) : (
                                            <CreditCard size={20} className="text-white" />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-white font-medium">{card.name}</h3>
                                        <p className="text-gray-500 text-sm">
                                            {card.lastFourDigits ? `**** ${card.lastFourDigits}` : '末四碼未設定'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="flex flex-col mr-2">
                                        <button
                                            onClick={() => moveCard(index, 'up')}
                                            disabled={index === 0}
                                            className={`p-1 ${index === 0 ? 'text-gray-700' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            <ArrowUp size={16} />
                                        </button>
                                        <button
                                            onClick={() => moveCard(index, 'down')}
                                            disabled={index === creditCards.length - 1}
                                            className={`p-1 ${index === creditCards.length - 1 ? 'text-gray-700' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            <ArrowDown size={16} />
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => openEditModal(card)}
                                        className="text-blue-400 p-2 hover:bg-white/5 rounded-full"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (window.confirm('確定要刪除此卡片嗎？')) {
                                                deleteCreditCard(card.id);
                                            }
                                        }}
                                        className="text-red-500 p-2 hover:bg-white/5 rounded-full"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-gray-500">年費</p>
                                    <p className="text-white">${card.annualFee.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">收費月份</p>
                                    <p className="text-white">{card.feeMonth ? `${card.feeMonth}月` : '—'}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">信用額度</p>
                                    <p className="text-white">{card.creditLimit ? `$${card.creditLimit.toLocaleString()}` : '未設定'}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-gray-500">回贈優惠</p>
                                    <p className="text-white whitespace-pre-line">{card.cashbackType || '無'}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-gray-500">回贈類別（API）</p>
                                    {card.rewardCategories?.length ? (
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {card.rewardCategories.map((c: string) => (
                                                <span
                                                    key={c}
                                                    className="text-[11px] px-2 py-1 rounded-full bg-primary/15 text-primary border border-primary/25"
                                                >
                                                    {c}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-500">未設定</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-gray-500">到期日</p>
                                    <p className="text-white">{card.expiryDate || '未設定'}</p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
                    <div className="sf-panel w-full rounded-t-3xl p-6 pb-safe-bottom animate-slide-up max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold text-white">{editingId ? '編輯信用卡' : '新增信用卡'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Catalog (API) */}
                            <div className="sf-control rounded-xl p-3 space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm text-gray-200 flex items-center gap-2">
                                        <Cloud size={16} className="text-primary" />
                                        從卡片資料庫帶入（API）
                                    </div>
                                    <button
                                        type="button"
                                        onClick={loadCatalog}
                                        className="text-xs text-primary px-2 py-1 rounded-lg hover:bg-white/5"
                                        disabled={catalogLoading}
                                    >
                                        {catalogLoading ? '載入中…' : (catalog.length ? '更新' : '載入')}
                                    </button>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Search size={16} className="text-gray-500" />
                                    <input
                                        type="text"
                                        placeholder="搜尋：卡名 / 銀行 / 標籤"
                                        value={catalogQuery}
                                        onChange={(e) => setCatalogQuery(e.target.value)}
                                        className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm"
                                    />
                                </div>

                                {catalogError && (
                                    <div className="text-xs text-red-400">{catalogError}</div>
                                )}

                                {catalog.length > 0 && (
                                    <div className="max-h-44 overflow-y-auto space-y-2 pt-1">
                                        {catalog
                                            .filter((it) => {
                                                const q = catalogQuery.trim().toLowerCase();
                                                if (!q) return true;
                                                const hay = [
                                                    it.name,
                                                    it.bank || '',
                                                    ...(it.tags || []),
                                                ].join(' ').toLowerCase();
                                                return hay.includes(q);
                                            })
                                            .slice(0, 12)
                                            .map((it) => (
                                                <button
                                                    key={it.id}
                                                    type="button"
                                                    onClick={() => applyCatalogItem(it)}
                                                    className="w-full text-left sf-panel px-3 py-2 rounded-lg hover:bg-surface/80 transition-colors"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-10 h-10 rounded-lg bg-black/20 overflow-hidden flex items-center justify-center shrink-0">
                                                            {it.imageUrl ? (
                                                                <img src={it.imageUrl} alt={it.name} className="w-full h-full object-contain" />
                                                            ) : (
                                                                <CreditCard size={18} className="text-gray-400" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-sm text-white font-medium truncate">{it.name}</div>
                                                            <div className="text-xs text-gray-500 truncate">{it.bank || it.id}</div>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>

                            {/* Reward categories */}
                            <div>
                                <label className="text-gray-400 text-sm mb-2 block">回贈類別（API）</label>
                                {formData.rewardCategories?.length ? (
                                    <div className="flex flex-wrap gap-2">
                                        {formData.rewardCategories.map((c) => (
                                            <span
                                                key={c}
                                                className="text-[11px] px-2 py-1 rounded-full bg-primary/15 text-primary border border-primary/25"
                                            >
                                                {c}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-500">未設定（可從上方 API 選卡帶入）</div>
                                )}
                            </div>

                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">卡片名稱</label>
                                <input
                                    type="text"
                                    placeholder="例如: 渣打 Simply Cash"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full sf-control rounded-xl p-3 text-white"
                                />
                            </div>

                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">卡號末四碼</label>
                                <input
                                    type="text"
                                    placeholder="1234（可不填）"
                                    maxLength={4}
                                    value={formData.lastFourDigits || ''}
                                    onChange={e => setFormData({ ...formData, lastFourDigits: e.target.value })}
                                    className="w-full sf-control rounded-xl p-3 text-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">年費</label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={formData.annualFee}
                                        onChange={e => setFormData({ ...formData, annualFee: Number(e.target.value) })}
                                        className="w-full sf-control rounded-xl p-3 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">信用額度</label>
                                    <input
                                        type="number"
                                        placeholder="例如 200000"
                                        value={formData.creditLimit ?? ''}
                                        onChange={e => setFormData({ ...formData, creditLimit: e.target.value === '' ? undefined : Number(e.target.value) })}
                                        className="w-full sf-control rounded-xl p-3 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">收費月份</label>
                                    <select
                                        value={formData.feeMonth ?? ''}
                                        onChange={e => setFormData({ ...formData, feeMonth: e.target.value === '' ? undefined : Number(e.target.value) })}
                                        className="w-full sf-control rounded-xl p-3 text-white"
                                        disabled={Number(formData.annualFee) <= 0}
                                    >
                                        <option value="">（不適用）</option>
                                        {months.map(m => (
                                            <option key={m} value={m}>{m}月</option>
                                        ))}
                                    </select>
                                    {Number(formData.annualFee) <= 0 && (
                                      <div className="text-xs text-gray-500 mt-1">年費為 0 時無需設定收費月份</div>
                                    )}
                                    
                                </div>
                            </div>

                            {/* Billing cycle dates + reminders */}
                            <div className="sf-panel rounded-xl p-4 space-y-3">
                                <div className="text-sm text-gray-200 font-semibold">信用卡帳單週期</div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-gray-400 text-sm mb-1 block">截數日（每月）</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={31}
                                            placeholder="例如 19"
                                            value={formData.statementDay ?? ''}
                                            onChange={e => {
                                                const v = e.target.value === '' ? undefined : Number(e.target.value);
                                                setFormData({ ...formData, statementDay: v });
                                            }}
                                            className="w-full sf-control rounded-xl p-3 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-gray-400 text-sm mb-1 block">繳費日（每月）</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={31}
                                            placeholder="例如 14"
                                            value={formData.dueDay ?? ''}
                                            onChange={e => {
                                                const v = e.target.value === '' ? undefined : Number(e.target.value);
                                                setFormData({ ...formData, dueDay: v });
                                            }}
                                            className="w-full sf-control rounded-xl p-3 text-white"
                                        />
                                    </div>
                                </div>

                                <label className="flex items-center gap-2 text-sm text-gray-300">
                                    <input
                                        type="checkbox"
                                        checked={formData.dueInNextMonth ?? true}
                                        onChange={e => setFormData({ ...formData, dueInNextMonth: e.target.checked })}
                                    />
                                    繳費日屬於下一個月（常見：3月截數 → 4月繳費）
                                </label>

                                <div className="grid grid-cols-2 gap-3">
                                    <label className="flex items-center gap-2 text-sm text-gray-300">
                                        <input
                                            type="checkbox"
                                            checked={formData.remindStatement ?? true}
                                            onChange={e => setFormData({ ...formData, remindStatement: e.target.checked })}
                                        />
                                        截數提醒
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-gray-300">
                                        <input
                                            type="checkbox"
                                            checked={formData.remindDue ?? true}
                                            onChange={e => setFormData({ ...formData, remindDue: e.target.checked })}
                                        />
                                        繳費提醒
                                    </label>
                                </div>

                                <div className="text-xs text-gray-500">
                                    提示：如某月份無該日期（例如 31 號），提醒會自動落到該月最後一日。
                                </div>
                            </div>

                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">回贈優惠 (每行一項)</label>
                                <textarea
                                    placeholder="例如:&#10;餐飲 4%&#10;網購 2%&#10;其他 1%"
                                    rows={3}
                                    value={formData.cashbackType}
                                    onChange={e => setFormData({ ...formData, cashbackType: e.target.value })}
                                    className="w-full sf-control rounded-xl p-3 text-white resize-none"
                                />
                            </div>

                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">到期日</label>
                                <input
                                    type="month"
                                    value={formData.expiryDate}
                                    onChange={e => setFormData({ ...formData, expiryDate: e.target.value })}
                                    className="w-full sf-control rounded-xl p-3 text-white"
                                />
                            </div>

                            <button
                                onClick={handleSave}
                                className="w-full bg-primary py-4 rounded-xl font-bold text-white mt-4 shadow-lg"
                            >
                                {editingId ? '儲存變更' : '新增'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreditCardManager;
