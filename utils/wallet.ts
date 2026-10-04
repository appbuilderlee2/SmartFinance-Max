import { Currency, Transaction, TransactionType, WalletItem } from '../types';
import { parseLocalYMD, toLocalYMD, parseDate } from './date';
import { toMinorUnits, fromMinorUnits, parseMoneyInput } from './money';

export const WALLET_KEY = 'smartfinance_wallet';
export const walletLabels = { stored: '儲值卡', count: '次數卡', voucher: '禮券' };
export const walletIcons = { stored: '💳', count: '🎟️', voucher: '🎁' };
export function walletBalance(item: WalletItem, transactions: Transaction[]) {
  const unit = (amount: number) => item.kind === 'stored' ? toMinorUnits(amount, item.currency) : amount;
  let total = unit(item.openingBalance);
  for (const event of item.events) total += (event.kind === 'add' ? 1 : -1) * unit(event.amount);
  for (const tx of transactions) if (tx.walletItemId === item.id) total -= unit(tx.amount);
  if (!Number.isSafeInteger(total)) throw new Error('卡券餘額或數量過大');
  return item.kind === 'stored' ? fromMinorUnits(total, item.currency) : total;
}
export function walletStatus(item: WalletItem, transactions: Transaction[], today = toLocalYMD(new Date())) {
  if (walletBalance(item, transactions) <= 0) return 'used';
  return item.expiresOn && item.expiresOn < today ? 'expired' : 'active';
}
export function validateWalletItem(item: WalletItem) {
  if (!item || typeof item.id !== 'string' || !item.id || typeof item.name !== 'string' || !item.name.trim() || !['stored', 'count', 'voucher'].includes(item.kind)) throw new Error('請輸入有效卡券名稱及類型');
  if (!Object.values(Currency).includes(item.currency) || typeof item.notes !== 'string') throw new Error('卡券資料不正確');
  const valid = (v: number) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && (item.kind === 'stored' ? parseMoneyInput(String(v), item.currency) !== null : Number.isSafeInteger(v));
  if (!valid(item.openingBalance)) throw new Error('請輸入有效餘額或整數數量');
  if (item.faceValue !== undefined && (typeof item.faceValue !== 'number' || item.faceValue < 0 || !Number.isFinite(item.faceValue) || parseMoneyInput(String(item.faceValue), item.currency) === null)) throw new Error('禮券面額不正確');
  if (item.expiresOn && !parseLocalYMD(item.expiresOn)) throw new Error('到期日不正確');
  if (!Array.isArray(item.events)) throw new Error('使用紀錄不正確');
  const ids = new Set<string>();
  for (const event of item.events) {
    if (!event || typeof event.id !== 'string' || !event.id || ids.has(event.id) || !valid(event.amount) || event.amount <= 0 || !['add','use'].includes(event.kind) || !parseLocalYMD(event.date) || typeof event.note !== 'string' || (item.kind === 'stored' && event.kind === 'use')) throw new Error('使用紀錄不正確');
    ids.add(event.id);
  }
}
export function validateWalletLedger(items: WalletItem[], transactions: Transaction[]) {
  const byId = new Map(items.map(item => [item.id, item]));
  if (byId.size !== items.length) throw new Error('卡券 ID 重複');
  items.forEach(validateWalletItem);
  for (const tx of transactions) {
    if (!tx.walletItemId) continue;
    const item = byId.get(tx.walletItemId);
    if (!item || item.kind !== 'stored' || tx.type !== TransactionType.EXPENSE || tx.currency !== item.currency || tx.isRecurring || tx.recurrenceSourceId || tx.subscriptionId) throw new Error('儲值卡只可用於同幣別的單筆支出');
  }
  if (items.some(item => walletBalance(item, transactions) < 0)) throw new Error('卡券餘額不足');
}
export function validateWalletPayment(row: Transaction, items: WalletItem[], transactions: Transaction[], original?: Transaction) {
  validateWalletLedger(items, [row, ...transactions.filter(tx => tx.id !== row.id)]);
  if (!row.walletItemId) return;
  const item = items.find(item => item.id === row.walletItemId)!;
  const date = parseDate(row.date);
  if (!date) throw new Error('交易日期不正確');
  if (item.expiresOn && toLocalYMD(date) > item.expiresOn && (!original || original.date !== row.date || original.walletItemId !== row.walletItemId || original.amount !== row.amount)) throw new Error('交易日期已超過卡券到期日');
}
