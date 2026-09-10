import { Transaction } from '../types';

export const normalizeTag = (value: string) => value.trim().replace(/^#+/, '').trim();
export const tagKey = (value: string) => normalizeTag(value).toLocaleLowerCase();
export function uniqueTags(values: string[]): string[] {
  const seen = new Set<string>();
  return values.map(normalizeTag).filter(value => {
    const key = tagKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
// The legacy subscription tag is system metadata only on linked subscriptions.
export const userTags = (tx: Transaction) => (tx.tags || []).filter(tag => !(tx.subscriptionId && tag === 'subscription'));
export function renameTransactionTags(rows: Transaction[], source: string, target: string): Transaction[] {
  const name = normalizeTag(target);
  if (!name) return rows;
  return rows.map(tx => {
    if (!userTags(tx).some(tag => tagKey(tag) === tagKey(source))) return tx;
    const system = tx.subscriptionId && tx.tags?.includes('subscription') ? ['subscription'] : [];
    return { ...tx, tags: [...system, ...uniqueTags(userTags(tx).map(tag => tagKey(tag) === tagKey(source) ? name : tag))] };
  });
}
