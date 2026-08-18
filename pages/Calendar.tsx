
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { Currency, TransactionType } from '../types';
import { Icon } from '../components/Icon';
import { formatMoney, formatMoneyNumber, fromMinorUnits, toMinorUnits } from '../utils/money';
import { loadPreferences } from '../utils/preferences';

const Calendar: React.FC = () => {
    const navigate = useNavigate();
    const { transactions, currency, getCategory } = useData();
    const [visibleMonth, setVisibleMonth] = useState(() => {
        const today = new Date();
        return today.getFullYear() * 12 + today.getMonth();
    });
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    const year = Math.floor(visibleMonth / 12);
    const month = visibleMonth % 12;
    const yearsWindow = useMemo(() => {
        const base = new Date().getFullYear();
        return Array.from({ length: 50 }, (_, i) => base - 19 + i); // past 19 yrs + current + ~30 future yrs
    }, []);
    const monthsList = Array.from({ length: 12 }, (_, i) => i);

    // Get first day of month and number of days
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Build the selected month's calendar, summary and transaction list in one pass.
    // Keeping these values in one snapshot prevents the summary from doing separate
    // work after the calendar has already moved to a new month.
    const monthView = useMemo(() => {
        const dailyMinorTotals: { [day: number]: { income: number; expense: number } } = {};
        const totalMinor = { income: 0, expense: 0 };
        const monthTransactions = [] as typeof transactions;
        let hasOtherCurrencies = false;

        for (const tx of transactions) {
            const txDate = new Date(tx.date);
            if (txDate.getFullYear() !== year || txDate.getMonth() !== month) continue;

            const txCurrency = (tx.currency as Currency) || currency;
            if (txCurrency !== currency) {
                hasOtherCurrencies = true;
                continue;
            }

            monthTransactions.push(tx);
            const day = txDate.getDate();
            const dayTotal = dailyMinorTotals[day] ?? { income: 0, expense: 0 };
            const amount = toMinorUnits(tx.amount, currency);
            if (tx.type === TransactionType.EXPENSE) {
                dayTotal.expense += amount;
                totalMinor.expense += amount;
            } else {
                dayTotal.income += amount;
                totalMinor.income += amount;
            }
            dailyMinorTotals[day] = dayTotal;
        }

        monthTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const dailyTotals = Object.fromEntries(
            Object.entries(dailyMinorTotals).map(([day, value]) => [day, {
                income: fromMinorUnits(value.income, currency),
                expense: fromMinorUnits(value.expense, currency),
            }])
        );

        return {
            dailyTotals,
            monthlyTotals: {
                income: fromMinorUnits(totalMinor.income, currency),
                expense: fromMinorUnits(totalMinor.expense, currency),
            },
            monthlyTransactions: monthTransactions,
            hasOtherCurrenciesThisMonth: hasOtherCurrencies,
        };
    }, [transactions, year, month, currency]);

    const { dailyTotals, monthlyTotals, monthlyTransactions, hasOtherCurrenciesThisMonth } = monthView;

    // Transactions for selected day
    const selectedDayTransactions = useMemo(() => {
        if (selectedDay === null) return [];
        return monthlyTransactions.filter(tx => {
            const txDate = new Date(tx.date);
            return txDate.getDate() === selectedDay;
        });
    }, [monthlyTransactions, selectedDay]);

    // Display transactions based on selection
    const displayTransactions = selectedDay !== null ? selectedDayTransactions : monthlyTransactions;
    const prevMonth = () => {
        setVisibleMonth(previous => previous - 1);
        setSelectedDay(null);
    };

    const nextMonth = () => {
        setVisibleMonth(previous => previous + 1);
        setSelectedDay(null);
    };

    const clearSelection = () => {
        setSelectedDay(null);
    };

    const weekStartsOn = loadPreferences().weekStartsOn;
    const weekDays = weekStartsOn === 1 ? ['一', '二', '三', '四', '五', '六', '日'] : ['日', '一', '二', '三', '四', '五', '六'];

    const renderCalendarDays = () => {
        const days = [];

        // Empty cells for days before the first day of month
        const leadingDays = (firstDayOfMonth - weekStartsOn + 7) % 7;
        for (let i = 0; i < leadingDays; i++) {
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
                                    -{formatMoneyNumber(dayData?.expense || 0, currency)}
                                </span>
                            )}
                            {hasIncome && (
                                <span className="text-[10px] text-emerald-400 truncate w-full">
                                    +{formatMoneyNumber(dayData?.income || 0, currency)}
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
                <button onClick={prevMonth} aria-label="上個月" className="p-2 text-primary">
                    <ChevronLeft size={24} />
                </button>
                <div className="flex items-center gap-2 w-48">
                    <select
                        value={year}
                        onChange={(e) => { setVisibleMonth(Number(e.target.value) * 12 + month); setSelectedDay(null); }}
                        className="sf-control text-white text-sm rounded-lg px-3 py-1 flex-1"
                    >
                        {yearsWindow.map(y => (
                            <option key={y} value={y}>{y} 年</option>
                        ))}
                    </select>
                    <select
                        value={month}
                        onChange={(e) => { setVisibleMonth(year * 12 + Number(e.target.value)); setSelectedDay(null); }}
                        className="sf-control text-white text-sm rounded-lg px-3 py-1 flex-1"
                    >
                        {monthsList.map(m => (
                            <option key={m} value={m}>{m + 1} 月</option>
                        ))}
                    </select>
                </div>
                <button onClick={nextMonth} aria-label="下個月" className="p-2 text-primary">
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
                <div
                    key={visibleMonth}
                    data-month-key={`${year}-${String(month + 1).padStart(2, '0')}`}
                    className="sf-panel p-4"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    <h3 className="text-sm text-gray-400 mb-3">{year}年{month + 1}月摘要</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-gray-500">收入</p>
                            <p className="text-lg font-semibold text-green-500">
                                +{formatMoney(monthlyTotals.income, currency)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">支出</p>
                            <p className="text-lg font-semibold text-red-500">
                                -{formatMoney(monthlyTotals.expense, currency)}
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
                                            {tx.type === TransactionType.EXPENSE ? '-' : '+'}{formatMoney(tx.amount, currency)}
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
