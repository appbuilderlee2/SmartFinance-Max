import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, DollarSign, Undo2, ChevronRight, CalendarDays, PlusCircle } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { loadCycles, saveCycles, upsertCycle } from '../utils/creditCardCycleStorage';
import { getNextYearMonth, createOpenCycle, getCurrentYearMonth } from '../utils/creditCardCycles';

const CreditCardCycles: React.FC = () => {
  const navigate = useNavigate();
  const { creditCards, setCreditCards } = useData();

  const [cycles, setCycles] = useState(() => loadCycles());

  // UI-selected cycle per card (YYYY-MM)
  const [selectedYmByCard, setSelectedYmByCard] = useState<Record<string, string>>({});

  const cardCycles = useMemo(() => {
    const byCard: Record<string, any[]> = {};
    for (const c of cycles || []) {
      if (!byCard[c.cardId]) byCard[c.cardId] = [];
      byCard[c.cardId].push(c);
    }
    // sort ascending for easy prev/next
    for (const cardId of Object.keys(byCard)) {
      byCard[cardId].sort((a, b) => (a.yearMonth < b.yearMonth ? -1 : a.yearMonth > b.yearMonth ? 1 : 0));
    }
    return byCard;
  }, [cycles]);

  const current = useMemo(() => {
    const now = new Date();
    const { yearMonth: nowYm } = getCurrentYearMonth(now);

    return (creditCards || []).map((card) => {
      const list = cardCycles[card.id] || [];
      const selected = selectedYmByCard[card.id];

      // default selection: current month if exists, else latest existing, else current month (will be created on demand)
      const defaultYm =
        list.find((x) => x.yearMonth === nowYm)?.yearMonth ||
        (list.length ? list[list.length - 1].yearMonth : nowYm);

      const ym = selected || defaultYm;

      // find existing cycle for selected ym (do NOT auto-create except when user explicitly creates)
      const id = `ccyc_${card.id}_${ym}`;
      const cycle = list.find((x) => x.id === id) || null;

      return { card, ym, cycle, list };
    });
  }, [creditCards, cardCycles, selectedYmByCard]);

  const setAmountDue = (cardId: string, yearMonth: string) => {
    const card = creditCards.find((c) => c.id === cardId);
    if (!card) return;

    const id = `ccyc_${cardId}_${yearMonth}`;
    const existing = cycles.find((c) => c.id === id);
    if (!existing) {
      alert('呢一期未建立。請先「建立下一期」或先揀一個已存在嘅週期。');
      return;
    }

    const raw = window.prompt(
      `輸入 ${card.name}（${yearMonth}）本期應繳金額`,
      typeof existing.amountDue === 'number' ? existing.amountDue.toString() : ''
    );
    if (raw == null) return;
    const trimmed = raw.trim();
    if (trimmed === '') {
      alert('請輸入金額');
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) {
      alert('金額不正確（請輸入 0 或以上數字）');
      return;
    }

    const next = {
      ...existing,
      amountDue: n,
      amountDueEnteredAt: new Date().toISOString(),
      status: existing.status || 'open',
    };

    const updated = upsertCycle(cycles, next);
    setCycles(updated);
    saveCycles(updated);
  };

  const markPaidOnly = (cardId: string, yearMonth: string) => {
    const id = `ccyc_${cardId}_${yearMonth}`;
    const existing = cycles.find((c) => c.id === id);
    if (!existing) {
      alert('搵唔到呢一期資料');
      return;
    }

    if (existing.status === 'closed') {
      alert('呢一期已經標記咗繳費');
      return;
    }

    const amt = typeof existing.amountDue === 'number' ? existing.amountDue : null;
    if (amt == null) {
      const ok = window.confirm('你仲未輸入本期應繳金額，確定要直接標記「已繳費」？');
      if (!ok) return;
    } else if (amt <= 0) {
      const ok = window.confirm('本期應繳金額為 0，確定要標記「已繳費」？');
      if (!ok) return;
    }

    const nextClosed = {
      ...existing,
      status: 'closed' as const,
      paidAt: new Date().toISOString(),
    };

    const updated = upsertCycle(cycles, nextClosed);
    setCycles(updated);
    saveCycles(updated);
  };

  const ensureNextCycle = (cardId: string, yearMonth: string) => {
    const card = creditCards.find((c) => c.id === cardId);
    if (!card) return;

    const id = `ccyc_${cardId}_${yearMonth}`;
    const existing = cycles.find((c) => c.id === id);
    if (!existing) {
      alert('搵唔到呢一期資料');
      return;
    }

    const nextYm = getNextYearMonth(existing.year, existing.month0);
    const nextOpen = createOpenCycle(card, nextYm.year, nextYm.month0);

    const updated = upsertCycle(cycles, nextOpen);
    setCycles(updated);
    saveCycles(updated);

    setSelectedYmByCard((prev) => ({ ...prev, [cardId]: nextOpen.yearMonth }));
  };

  const cancelPaid = (cardId: string, yearMonth: string) => {
    const card = creditCards.find(c => c.id === cardId);
    if (!card) return;

    const id = `ccyc_${cardId}_${yearMonth}`;
    const existing = cycles.find(c => c.id === id);
    if (!existing) {
      alert('搵唔到呢一期資料');
      return;
    }

    if (existing.status !== 'closed') {
      alert('呢一期未標記繳費');
      return;
    }

    const ok = window.confirm('確定要取消「已繳費」？');
    if (!ok) return;

    const reopened = { ...existing, status: 'open' as const, paidAt: undefined };
    const updated = upsertCycle(cycles, reopened);
    setCycles(updated);
    saveCycles(updated);
    setTimeout(() => setCycles(loadCycles()), 0);
  };

  return (
    <div className="min-h-screen bg-background pt-safe-top pb-24">
      <div className="px-4 py-3 flex justify-between items-center sf-topbar sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="flex items-center text-primary">
          <ChevronLeft size={24} />
          <span>設定</span>
        </button>
        <h2 className="text-lg font-semibold">信用卡週期</h2>
        <div className="w-16" />
      </div>

      <div className="p-4 space-y-4">
        <div className="text-xs text-gray-500">
          以「截數月」為一期。你可以手動建立下一期；亦可以用上/下一期按鈕查閱之前週期。
        </div>

        {(current || []).map(({ card, ym, cycle, list }, cardIndex) => {
          const yms = (list || []).map((x: any) => x.yearMonth);
          const selectedIndex = yms.indexOf(ym);
          const hasPrev = selectedIndex > 0;
          const hasNext = selectedIndex >= 0 && selectedIndex < yms.length - 1;

          return (
            <div key={card.id} className="sf-panel rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-gray-100 font-semibold truncate">{card.name}</div>

                <div className="flex items-center gap-2">
                  {/* Card order controls (same as CreditCardManager) */}
                  <button
                    type="button"
                    onClick={() => {
                      if (cardIndex === 0) return;
                      const next = [...creditCards];
                      [next[cardIndex - 1], next[cardIndex]] = [next[cardIndex], next[cardIndex - 1]];
                      setCreditCards(next);
                    }}
                    disabled={cardIndex === 0}
                    className="sf-control rounded-xl px-2 py-2 text-gray-200 disabled:opacity-40"
                    aria-label="信用卡上移"
                    title="上移"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (cardIndex >= creditCards.length - 1) return;
                      const next = [...creditCards];
                      [next[cardIndex], next[cardIndex + 1]] = [next[cardIndex + 1], next[cardIndex]];
                      setCreditCards(next);
                    }}
                    disabled={cardIndex >= creditCards.length - 1}
                    className="sf-control rounded-xl px-2 py-2 text-gray-200 disabled:opacity-40"
                    aria-label="信用卡下移"
                    title="下移"
                  >
                    ↓
                  </button>


                  <button
                    type="button"
                    onClick={() => {
                      if (!hasPrev) return;
                      setSelectedYmByCard((prev) => ({ ...prev, [card.id]: yms[selectedIndex - 1] }));
                    }}
                    disabled={!hasPrev}
                    className="sf-control rounded-xl px-2 py-2 text-gray-200 disabled:opacity-40"
                    aria-label="上一期"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <div className="flex items-center gap-2">
                    <CalendarDays size={16} className="text-gray-400" />
                    <select
                      value={ym}
                      onChange={(e) => setSelectedYmByCard((prev) => ({ ...prev, [card.id]: e.target.value }))}
                      className="sf-control rounded-xl px-3 py-2 text-gray-200"
                    >
                      {yms.length ? (
                        yms.map((m: string) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))
                      ) : (
                        <option value={ym}>{ym}</option>
                      )}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!hasNext) return;
                      setSelectedYmByCard((prev) => ({ ...prev, [card.id]: yms[selectedIndex + 1] }));
                    }}
                    disabled={!hasNext}
                    className="sf-control rounded-xl px-2 py-2 text-gray-200 disabled:opacity-40"
                    aria-label="下一期"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {!cycle && (
                <div className="text-sm text-gray-500">
                  呢一期未建立。你可以先切換到已存在嘅週期，或者用「建立下一期」建立新一期。
                </div>
              )}

              {cycle && (
                <>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                    <div>
                      截數：<span className="text-gray-100">{cycle.statementDate || '-'}</span>
                    </div>
                    <div>
                      繳費：<span className="text-gray-100">{cycle.dueDate || '-'}</span>
                    </div>
                    <div>
                      應繳：<span className="text-gray-100">{typeof cycle.amountDue === 'number' ? cycle.amountDue : '-'}</span>
                    </div>
                    <div>
                      狀態：<span className={cycle.status === 'closed' ? 'text-green-400' : 'text-yellow-400'}>{cycle.status}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setAmountDue(card.id, cycle.yearMonth)}
                      className="sf-control rounded-xl p-3 text-gray-200 flex items-center justify-center gap-2"
                    >
                      <DollarSign size={16} />
                      輸入應繳
                    </button>

                    <button
                      type="button"
                      onClick={() => markPaidOnly(card.id, cycle.yearMonth)}
                      className="sf-control rounded-xl p-3 text-gray-200 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={16} />
                      已繳費
                    </button>

                    <button
                      type="button"
                      onClick={() => ensureNextCycle(card.id, cycle.yearMonth)}
                      className="sf-control rounded-xl p-3 text-gray-200 flex items-center justify-center gap-2"
                    >
                      <PlusCircle size={16} />
                      建立下一期
                    </button>

                    <button
                      type="button"
                      onClick={() => cancelPaid(card.id, cycle.yearMonth)}
                      className="sf-control rounded-xl p-3 text-gray-200 flex items-center justify-center gap-2"
                      disabled={cycle.status !== 'closed'}
                      title={cycle.status !== 'closed' ? '只可以對已繳費（closed）週期使用' : ''}
                    >
                      <Undo2 size={16} />
                      取消已繳費
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {(!creditCards || creditCards.length === 0) && (
          <div className="text-sm text-gray-500">未有信用卡資料。</div>
        )}
      </div>
    </div>
  );
};

export default CreditCardCycles;
