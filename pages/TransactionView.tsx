
import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Trash2, Edit2 } from 'lucide-react';
import { Icon } from '../components/Icon';
import { useData } from '../contexts/DataContext';
import { Currency, TransactionType } from '../types';
import { getCurrencySymbol } from '../utils/currency';

const TransactionView: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { transactions, categories, deleteTransaction, currency } = useData();

  const categoryById = useMemo(() => {
    return new Map(categories.map(c => [c.id, c] as const));
  }, [categories]);

  // Find transaction from dynamic state
  const transaction = transactions.find(t => t.id === id);

  if (!transaction) {
    return <div className="text-white p-10 pt-safe-top">Transaction Not Found</div>;
  }

  const category = categoryById.get(transaction.categoryId);
  const txCurrency = (transaction.currency as Currency) || currency;

  const isExpense = transaction.type === TransactionType.EXPENSE;
  const formattedDate = new Date(transaction.date).toLocaleString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  });

  const handleDelete = () => {
    if (window.confirm('確定要刪除這筆帳目嗎？')) {
      deleteTransaction(transaction.id);
      navigate(-1);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header - Sticky with Safe Area Padding & Backdrop Blur */}
      <div className="pt-safe-top px-4 py-3 flex justify-between items-center sf-topbar sticky top-0 z-50 transition-all">
        <button onClick={() => navigate(-1)} className="flex items-center text-primary text-base active:opacity-70 transition-opacity">
          <ChevronLeft size={24} />
          <span>返回</span>
        </button>
        <h2 className="text-lg font-semibold text-white">帳目明細</h2>
        <div className="w-16"></div> {/* Spacer for alignment */}
      </div>

      {/* Content Container */}
      <div className="flex-1 p-4 flex flex-col pb-safe-bottom">
        <div className="space-y-6">
          {/* Big Total Card */}
          <div className="text-center py-8 animate-fade-in-up">
            <span className={`text-4xl font-bold font-sans tracking-tight ${isExpense ? 'text-red-500' : 'text-green-500'}`}>
              {isExpense ? '-' : '+'} {getCurrencySymbol(txCurrency)} {transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </span>
            <div className="flex items-center justify-center gap-2 mt-3 text-gray-400">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${category?.color} text-white`}>
                <Icon name={category?.icon || 'HelpCircle'} size={14} />
              </div>
              <span className="text-base">{category?.name}</span>
            </div>
          </div>

          {/* Details List */}
          <div className="sf-panel rounded-xl overflow-hidden divide-y sf-divider">
            <div className="flex justify-between p-4">
              <span className="text-white">日期</span>
              <span className="text-gray-400">{formattedDate}</span>
            </div>

            <div className="p-4">
              <span className="text-white block mb-1">備註</span>
              <span className="text-gray-400">{transaction.note || '無備註'}</span>
            </div>

            <div className="flex justify-between items-center p-4">
              <span className="text-white">標籤</span>
              <div className="flex gap-2">
                {transaction.tags && transaction.tags.length > 0 ? (
                  transaction.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 text-xs rounded-full bg-primary/15 text-primary border border-primary/30">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-500 text-sm">無標籤</span>
                )}
              </div>
            </div>

            {/* Receipt Section */}
            <div className="p-4">
              <span className="text-white block mb-3">收據</span>
              <div className="relative inline-block group cursor-pointer w-full">
                {transaction.receiptUrl ? (
                  <img
                    src={transaction.receiptUrl}
                    alt="Receipt"
                    className="rounded-lg w-full max-h-64 object-cover border border-gray-700 shadow-lg"
                  />
                ) : (
                  <div className="w-full h-32 rounded-lg sf-control border-dashed flex flex-col items-center justify-center text-gray-500 gap-2">
                    <Icon name="Image" size={24} />
                    <span className="text-xs">無照片</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons (Stacked at bottom) */}
        <div className="mt-auto pt-8 flex flex-col gap-3">
          <button
            onClick={handleDelete}
            className="w-full sf-panel border border-red-500/30 text-red-500 hover:bg-red-500/10 py-3.5 rounded-xl font-bold shadow-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            <Trash2 size={20} />
            刪除帳目
          </button>
          <button
            onClick={() => navigate(`/edit/${transaction.id}`)}
            className="w-full sf-panel hover:bg-surface/80 text-white py-3.5 rounded-xl font-medium active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            <Edit2 size={20} className="text-gray-400" />
            編輯
          </button>
        </div>

      </div>
    </div>
  );
};

export default TransactionView;
