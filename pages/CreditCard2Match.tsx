import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, Search } from 'lucide-react';
import { useData } from '../contexts/DataContext';

type SwipeWhichCard = { id: string; name: string; issuer?: string };
type PCRCard = { id: string; slug: string; name: string; bank?: string };

type SwipeWhichData = { cards: SwipeWhichCard[] };
type PCRData = { cards: PCRCard[] };

const KEY_SW = 'sf_cc_match_source_a_v1';
const KEY_PCR = 'sf_cc_match_source_b_v1';

const safeJsonParse = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const CreditCard2Match: React.FC = () => {
  const navigate = useNavigate();
  const { creditCards } = useData();

  const [swData, setSwData] = useState<SwipeWhichData | null>(null);
  const [pcrData, setPcrData] = useState<PCRData | null>(null);

  const [q, setQ] = useState('');

  const [mapSW, setMapSW] = useState<Record<string, string>>(() => {
    return safeJsonParse<Record<string, string>>(localStorage.getItem(KEY_SW)) || {};
  });

  const [mapPCR, setMapPCR] = useState<Record<string, string>>(() => {
    return safeJsonParse<Record<string, string>>(localStorage.getItem(KEY_PCR)) || {};
  });

  useEffect(() => {
    fetch('./data/rebate_source_a_v1.json')
      .then((r) => r.json())
      .then((j) => setSwData(j))
      .catch(() => setSwData(null));

    fetch('./data/rebate_source_b_v1.json')
      .then((r) => r.json())
      .then((j) => setPcrData(j))
      .catch(() => setPcrData(null));
  }, []);

  const filteredLocal = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return creditCards || [];
    return (creditCards || []).filter((c: any) => {
      const hay = `${c.name || ''} ${c.lastFourDigits || ''}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [creditCards, q]);

  const suggest = (name: string, candidates: { id: string; name: string }[]) => {
    const n = (name || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!n) return '';
    const hit = candidates.find((c) => {
      const cn = (c.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
      return cn.includes(n) || n.includes(cn);
    });
    return hit?.id || '';
  };

  const onAutoSuggest = () => {
    const sw = swData?.cards || [];
    const pcr = pcrData?.cards || [];

    const nextSW = { ...mapSW };
    const nextPCR = { ...mapPCR };

    for (const lc of creditCards || []) {
      if (!nextSW[lc.id]) {
        const sid = suggest(lc.name, sw as any);
        if (sid) nextSW[lc.id] = sid;
      }
      if (!nextPCR[lc.id]) {
        const pid = suggest(lc.name, pcr as any);
        if (pid) nextPCR[lc.id] = pid;
      }
    }

    setMapSW(nextSW);
    setMapPCR(nextPCR);
  };

  const onSave = () => {
    localStorage.setItem(KEY_SW, JSON.stringify(mapSW || {}));
    localStorage.setItem(KEY_PCR, JSON.stringify(mapPCR || {}));
    alert('已儲存配對');
  };

  return (
    <div className="min-h-screen bg-background pt-safe-top pb-24">
      <div className="px-4 py-3 flex justify-between items-center sf-topbar sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="flex items-center text-primary">
          <ChevronLeft size={24} />
          <span>回贈助手</span>
        </button>
        <h2 className="text-lg font-semibold">信用卡配對</h2>
        <button
          type="button"
          onClick={onSave}
          className="sf-control rounded-xl px-3 py-2 text-gray-200 flex items-center gap-2"
          title="儲存"
        >
          <Save size={16} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div className="sf-panel rounded-xl p-3 text-xs text-gray-500">
          將你本地信用卡配對到 來源A / 來源B 卡庫，之後 A/B 頁面就可以準確「只顯示我有的信用卡」。
        </div>

        <div className="sf-panel rounded-xl p-3 flex items-center gap-2">
          <Search size={16} className="text-gray-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋本地信用卡名稱"
            className="w-full bg-transparent text-gray-100 placeholder-gray-500 focus:outline-none text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAutoSuggest}
            className="sf-control rounded-xl px-3 py-2 text-gray-200 text-sm"
          >
            自動建議
          </button>
          <div className="text-xs text-gray-500">
            （只係填入建議，唔會自動儲存）
          </div>
        </div>

        <div className="space-y-3">
          {(filteredLocal || []).map((lc: any) => (
            <div key={lc.id} className="sf-panel rounded-xl p-3 space-y-2">
              <div className="text-gray-100 font-semibold">{lc.name}</div>

              <div className="grid grid-cols-1 gap-2">
                <div>
                  <div className="text-xs text-gray-500 mb-1">來源A（A）</div>
                  <select
                    value={mapSW[lc.id] || ''}
                    onChange={(e) => setMapSW((prev) => ({ ...prev, [lc.id]: e.target.value }))}
                    className="w-full sf-control rounded-xl px-3 py-2 text-gray-200"
                  >
                    <option value="">（未配對）</option>
                    {(swData?.cards || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.issuer ? ` · ${c.issuer}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">來源B（B）</div>
                  <select
                    value={mapPCR[lc.id] || ''}
                    onChange={(e) => setMapPCR((prev) => ({ ...prev, [lc.id]: e.target.value }))}
                    className="w-full sf-control rounded-xl px-3 py-2 text-gray-200"
                  >
                    <option value="">（未配對）</option>
                    {(pcrData?.cards || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.bank ? ` · ${c.bank}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}

          {(!creditCards || creditCards.length === 0) && (
            <div className="text-sm text-gray-500">未有本地信用卡資料。</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreditCard2Match;
