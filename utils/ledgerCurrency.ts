import { Currency } from '../types';

export function pinCurrency<T extends { currency?: Currency }>(rows: T[], fallback: Currency): T[] {
  return rows.map(row => row.currency ? row : { ...row, currency: fallback });
}

export function pinSnapshotCurrencies(snapshot: Record<string, string>): Record<string, string> {
  const result = { ...snapshot };
  const fallback = (snapshot.smartfinance_currency || Currency.HKD) as Currency;
  for (const key of ['smartfinance_transactions', 'smartfinance_subscriptions', 'smartfinance_creditcards']) {
    if (result[key]) result[key] = JSON.stringify(pinCurrency(JSON.parse(result[key]), fallback));
  }
  return result;
}
