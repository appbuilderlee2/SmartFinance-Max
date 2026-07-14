
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { Currency, TransactionType } from '../types';
import { getCurrencySymbol } from '../utils/currency';
import { Icon } from '../components/Icon';

const Calendar: React.FC = () => {
    const navigate = useNavigate();
    const { transactions, currency, getCategory } = useData();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const yearsWindow = useMemo(() => {
        const base = new Date().getFullYear();
        return Array.from({ length: 50 }, (_, i) => base - 19 + i); // past 19 yrs + current + ~30 future yrs
    }, []);
    const monthsList = Array.from({ length: 12 }, (_, i) => i);

    // Get first day of month and number of days
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Calculate daily totals for the month
    const dailyTotals = useMemo(() => {
        const totals: { [day: number]: { income: number; expense: number } } = {};

        transactions.forEach(tx => {
            const txDate = new Date(tx.date);
            const txCurrency = (tx.currency as Currency) || currency;
            if (txCurrency !== currency) return;
            if (txDate.getFullYear() === year && txDate.getMonth() === month) {
                const day = txDate.getDate();
                if (!totals[day]) {
                    totals[day] = { income: 0, expense: 0 };
                }
                if (tx.type === TransactionType.EXPENSE) {
                    totals[day].expense += tx.amount;
                } else {
                    totals[day].income += tx.amount;
                }
            }
        });

        return totals;
    }, [transactions, year, month, currency]);

    // Monthly totals
    const monthlyTotals = useMemo(() => {
        return transactions.reduce(
            (acc, tx) => {
                const txDate = new Date(tx.date);
                const txCurrency = (tx.currency as Currency) || currency;
                if (txCurrency !== currency) return acc;
                if (txDate.getFullYear() === year && txDate.getMonth() === month) {
                    if (tx.type === TransactionType.EXPENSE) {
                        acc.expense += tx.amount;
                    } else {
                        acc.income += tx.amount;
                    }
                }
                return acc;
            },
            { income: 0, expense: 0 }
        );
    }, [transactions, year, month, currency]);

    // Monthly transactions (all transactions for the month)
    const monthlyTransactions = useMemo(() => {
        return transactions
            .filter(tx => {
                const txDate = new Date(tx.date);
                const txCurrency = (tx.currency as Currency) || currency;
                if (txCurrency !== currency) return false;
                return txDate.getFullYear() === year && txDate.getMonth() === month;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, year, month, currency]);

    // Transactions for selected day
    const selectedDayTransactions = useMemo(() => {
        if (selectedDay === null) return [];
        return transactions.filter(tx => {
            const txDate = new Date(tx.date);
            const txCurrency = (tx.currency as Currency) || currency;
            if (txCurrency !== currency) return false;
            return txDate.getFullYear() === year &&
                txDate.getMonth() === month &&
                txDate.getDate() === selectedDay;
        });
    }, [transactions, year, month, selectedDay, currency]);

    // Display transactions based on selection
    const displayTransactions = selectedDay !== null ? selectedDayTransactions : monthlyTransactions;
    const hasOtherCurrenciesThisMonth = useMemo(() => {
        return transactions.some(tx => {
            const txDate = new Date(tx.date);
            if (txDate.getFullYear() !== year || txDate.getMonth() !== month) return false;
            const txCurrency = (tx.currency as Currency) || currency;
            return txCurrency !== currency;
        });
    }, [transactions, year, month, currency]);

    const prevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
        setSelectedDay(null);
    };

    const nextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
        setSelectedDay(null);
    };

    const clearSelection = () => {
        setSelectedDay(null);
    };

    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    const renderCalendarDays = () => {
        const days = [];

        // Empty cells for days before the first day of month
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(<div key={`empty-${i}`} className="h-12" />);
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dayData = dailyTotals[day];
            const hasExpense = dayData?.expense > 0;
            const hasIncome = dayData?.income > 0;
            const isSelected = selectedDay === day;
            const isToday = new Date().getDate() === day &&
                new Date().getMonth() === month &&
                new Date().getFullYear() === year;

            days.push(
                <button
                    key={day}
                    onClick={(e) => { e.stopPropagation(); setSelectedDay(day); }}
                    className={`h-16 rounded-lg flex flex-col items-center justify-center text-sm transition-all px-1
            ${isSelected ? 'bg-primary text-white' : 'hover:bg-surface/80'}
            ${isToday && !isSelected ? 'ring-1 ring-primary' : ''}
          `}
                >
                    <span className={isSelected ? 'text-white' : 'text-gray-300'}>{day}</span>
                    {(hasExpense || hasIncome) && (
                        <div className="flex flex-col items-center mt-0.5 space-y-0.5 leading-tight max-w-[64px] text-center">
                            {hasExpense && (
                                <span className="text-[10px] text-red-400 truncate w-full">
                                    -{dayData?.expense.toLocaleString()}
                                </span>
                            )}
                            {hasIncome && (
                                <span className="text-[10px] text-emerald-400 truncate w-full">
                                    +{dayData?.income.toLocaleString()}
                                </span>
                            )}
                        </div>
                    )}
                </button>
            );
        }

        return days;
    };

    return (
        <div className="min-h-screen bg-background pb-24 pt-safe-top">
            {/* Header */}
            <div className="px-4 py-3 flex justify-between items-center sf-topbar sticky top-0 z-50">
                <button onClick={prevMonth} className="p-2 text-primary">
                    <ChevronLeft size={24} />
                </button>
                <div className="flex items-center gap-2 w-48">
                    <select
                        value={year}
                        onChange={(e) => { setCurrentDate(new Date(Number(e.target.value), month, 1)); setSelectedDay(null); }}
                        className="sf-control text-white text-sm rounded-lg px-3 py-1 flex-1"
                    >
                        {yearsWindow.map(y => (
                            <option key={y} value={y}>{y} 年</option>
                        ))}
                    </select>
                    <select
                        value={month}
                        onChange={(e) => { setCurrentDate(new Date(year, Number(e.target.value), 1)); setSelectedDay(null); }}
                        className="sf-control text-white text-sm rounded-lg px-3 py-1 flex-1"
                    >
                        {monthsList.map(m => (
                            <option key={m} value={m}>{m + 1} 月</option>
                        ))}
                    </select>
                </div>
                <button onClick={nextMonth} className="p-2 text-primary">
                    <ChevronRight size={24} />
                </button>
            </div>

            {/* Calendar Grid */}
            <div className="p-4">
                {/* Week day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {weekDays.map(day => (
                        <div key={day} className="text-center text-xs text-gray-500 py-2">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar days */}
                <div
                    className="grid grid-cols-7 gap-1"
                    onClick={() => setSelectedDay(null)}
                >
                    {renderCalendarDays()}
                </div>
            </div>

            {/* Monthly Summary */}
            <div className="px-4 mb-4">
                {hasOtherCurrenciesThisMonth && (
                    <div className="sf-panel p-3 text-xs text-gray-300 mb-3">
                        本頁統計以 {currency} 計算，已排除其他幣別交易。
                    </div>
                )}
                <div className="sf-panel p-4">
                    <h3 className="text-sm text-gray-400 mb-3">本月摘要</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-gray-500">收入</p>
                            <p className="text-lg font-semibold text-green-500">
                                +{getCurrencySymbol(currency)} {monthlyTotals.income.toLocaleString()}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">支出</p>
                            <p className="text-lg font-semibold text-red-500">
                                -{getCurrencySymbol(currency)} {monthlyTotals.expense.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transaction Details */}
            <div className="px-4">
                <div className="sf-panel p-4">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm text-gray-400">
                            {selectedDay !== null
                                ? `${month + 1}月${selectedDay}日 明細`
                                : `${month + 1}月 全月明細`}
                        </h3>
                        {selectedDay !== null && (
                            <button onClick={clearSelection} className="text-gray-500 hover:text-white">
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    {displayTransactions.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-4">無記錄</p>
                    ) : (
                        <div className="space-y-2 overflow-y-auto">
                            {displayTransactions.map(tx => {
                                const category = getCategory(tx.categoryId);
                                return (
                                    <div
                                        key={tx.id}
                                        onClick={() => navigate(`/view/${tx.id}`)}
                                        className="flex justify-between items-center py-2 cursor-pointer hover:bg-surface/80 rounded-lg px-2"
                                    >
                                        <div className="flex items-center gap-2">
                                            {selectedDay === null && (
                                                <span className="text-xs text-gray-500 w-8">
                                                    {new Date(tx.date).getDate()}日
                                                </span>
                                            )}
                                            {category && (
                                                <div className={`w-6 h-6 rounded-full ${category.color} flex items-center justify-center text-xs`}>
                                                    {category.icon.startsWith('emoji:')
                                                        ? category.icon.replace('emoji:', '')
                                                        : <Icon name={category.icon} size={14} />}
                                                </div>
                                            )}
                                            <span className="text-white text-sm">{category?.name || '未分類'}</span>
                                        </div>
                                        <span className={`font-semibold ${tx.type === TransactionType.EXPENSE ? 'text-red-500' : 'text-green-500'}`}>
                                            {tx.type === TransactionType.EXPENSE ? '-' : '+'}{getCurrencySymbol(currency)} {tx.amount.toLocaleString()}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Calendar;
