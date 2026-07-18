import { Currency } from '../types';
import { readJson, writeJson } from './storage';

export type DateFormat = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';
export type SymbolPosition = 'before' | 'after';
export type NegativeStyle = 'minus' | 'parentheses';

export type AppPreferences = {
  enabledCurrencies: Currency[];
  dateFormat: DateFormat;
  weekStartsOn: 0 | 1;
  symbolPosition: SymbolPosition;
  negativeStyle: NegativeStyle;
};

export const ALL_CURRENCIES = Object.values(Currency);
export const DEFAULT_PREFERENCES: AppPreferences = {
  enabledCurrencies: ALL_CURRENCIES,
  dateFormat: 'YYYY-MM-DD',
  weekStartsOn: 1,
  symbolPosition: 'before',
  negativeStyle: 'minus',
};

let cached: AppPreferences | null = null;

export function loadPreferences(): AppPreferences {
  if (cached) return cached;
  const saved = readJson<Partial<AppPreferences>>('sf_preferences_v1');
  const enabled = Array.isArray(saved?.enabledCurrencies)
    ? saved.enabledCurrencies.filter((value): value is Currency => ALL_CURRENCIES.includes(value as Currency))
    : ALL_CURRENCIES;
  cached = {
    enabledCurrencies: enabled.length ? Array.from(new Set(enabled)) : ALL_CURRENCIES,
    dateFormat: ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'].includes(saved?.dateFormat || '') ? saved!.dateFormat! : DEFAULT_PREFERENCES.dateFormat,
    weekStartsOn: saved?.weekStartsOn === 0 ? 0 : 1,
    symbolPosition: saved?.symbolPosition === 'after' ? 'after' : 'before',
    negativeStyle: saved?.negativeStyle === 'parentheses' ? 'parentheses' : 'minus',
  };
  return cached;
}

export function savePreferences(value: AppPreferences): void {
  cached = value;
  writeJson('sf_preferences_v1', value);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('sf-preferences-change', { detail: value }));
}

export function formatDisplayYmd(ymd: string, format = loadPreferences().dateFormat): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return ymd;
  const [, year, month, day] = match;
  if (format === 'DD/MM/YYYY') return `${day}/${month}/${year}`;
  if (format === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
  return ymd;
}
