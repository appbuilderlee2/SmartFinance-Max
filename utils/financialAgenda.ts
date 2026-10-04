import { Subscription, WalletItem, Transaction } from '../types';
import type { CreditCard } from '../contexts/DataContext';
import type { CreditCardCycle } from './creditCardCycles';
import { subscriptionForecast } from './subscriptionSchedule';
import { walletBalance } from './wallet';

export function financialAgenda(subscriptions: Subscription[], items: WalletItem[], transactions: Transaction[], cards: CreditCard[], cycles: CreditCardCycle[], from: string, end: string) {
  const events: { id: string; date: string; name: string; label: string; path: string }[] = [];
  for (const sub of subscriptions) for (const due of subscriptionForecast(sub, from, end)) {
    if (!transactions.some(tx => tx.subscriptionId === sub.id && tx.subscriptionOccurrenceDate === due.date)) events.push({ id: `sub-${sub.id}-${due.date}`, date: due.date, name: sub.name, label: '預計扣款', path: `/subscriptions/${sub.id}/edit` });
  }
  for (const item of items) if (item.expiresOn && item.expiresOn >= from && item.expiresOn <= end && walletBalance(item, transactions) > 0) events.push({ id: item.id, date: item.expiresOn, name: item.name, label: '卡券到期', path: `/wallet?id=${encodeURIComponent(item.id)}` });
  for (const cycle of cycles) {
    const card = cards.find(card => card.id === cycle.cardId);
    if (card && cycle.status !== 'closed' && cycle.dueDate && cycle.dueDate >= from && cycle.dueDate <= end) events.push({ id: cycle.id, date: cycle.dueDate, name: card.name, label: '信用卡繳款', path: `/cards?card=${encodeURIComponent(card.id)}&cycle=${encodeURIComponent(cycle.id)}` });
  }
  return events.sort((a,b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}
