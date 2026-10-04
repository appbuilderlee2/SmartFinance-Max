import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { financialAgenda } from '../utils/financialAgenda';
import { loadCycles } from '../utils/creditCardCycleStorage';
import { toLocalYMD, parseLocalYMD } from '../utils/date';
import { observeLocalDay } from '../utils/dayBoundary';

export default function UpcomingAgenda() {
  const data = useData(), navigate = useNavigate();
  const [today, setToday] = useState(toLocalYMD(new Date()));
  useEffect(() => observeLocalDay(setToday), []);
  const end = parseLocalYMD(today)!; end.setDate(end.getDate() + 30);
  const events = financialAgenda(data.subscriptions, data.walletItems, data.transactions, data.creditCards, loadCycles(), today, toLocalYMD(end)).slice(0, 5);
  if (!events.length) return null;
  return <section className="sf-panel p-4"><h2 className="font-semibold mb-2">即將扣款及到期</h2>{events.map(event => <button key={event.id} onClick={() => navigate(event.path)} className="w-full flex justify-between gap-3 text-left py-3 border-b border-white/10"><span className="min-w-0 break-words">{event.name}<small className="block text-gray-400">{event.label}</small></span><span className="text-sm text-gray-400 shrink-0">{event.date.slice(5)}</span></button>)}</section>;
}
