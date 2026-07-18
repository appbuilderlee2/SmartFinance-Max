import { Currency } from '../types';
import { getCurrencySymbol } from './currency';
import { loadPreferences } from './preferences';
import { loadSecuritySettings } from './security';

export function getCurrencyFractionDigits(currency: Currency): number {
  return currency === Currency.JPY ? 0 : 2;
}

export function toMinorUnits(amount: number, currency: Currency): number {
  if (!Number.isFinite(amount)) throw new Error('Invalid money amount');
  const digits = getCurrencyFractionDigits(currency);
  const negative = amount < 0;
  const fixed = Math.abs(amount).toFixed(digits + 6);
  const [whole, fraction = ''] = fixed.split('.');
  const kept = fraction.slice(0, digits).padEnd(digits, '0');
  const nextDigit = Number(fraction[digits] || '0');
  let minor = Number(whole) * (10 ** digits) + Number(kept || '0');
  if (nextDigit >= 5) minor += 1;
  if (!Number.isSafeInteger(minor)) throw new Error('Money amount is too large');
  return negative ? -minor : minor;
}

export function fromMinorUnits(amount: number, currency: Currency): number {
  if (!Number.isSafeInteger(amount)) throw new Error('Invalid minor-unit amount');
  return amount / (10 ** getCurrencyFractionDigits(currency));
}

export function roundMoney(amount: number, currency: Currency): number {
  return fromMinorUnits(toMinorUnits(amount, currency), currency);
}

export function sumMoney(values: Iterable<number>, currency: Currency): number {
  let total = 0;
  for (const value of values) total += toMinorUnits(value, currency);
  if (!Number.isSafeInteger(total)) throw new Error('Money total is too large');
  return fromMinorUnits(total, currency);
}

export function addMoney(left: number, right: number, currency: Currency): number {
  return sumMoney([left, right], currency);
}

export function parseMoneyInput(value: string, currency: Currency): number | null {
  const trimmed = value.trim();
  const digits = getCurrencyFractionDigits(currency);
  const pattern = digits === 0 ? /^\d+$/ : new RegExp(`^\\d+(?:\\.\\d{1,${digits}})?$`);
  if (!pattern.test(trimmed)) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount)) return null;
  return roundMoney(amount, currency);
}

export function formatMoneyNumber(amount: number, currency: Currency): string {
  if (loadSecuritySettings().privacyMode) return '••••';
  const digits = getCurrencyFractionDigits(currency);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(roundMoney(amount, currency));
}

export function formatMoney(amount: number, currency: Currency): string {
  if (loadSecuritySettings().privacyMode) return '••••';
  const preferences = loadPreferences();
  const absolute = formatMoneyNumber(Math.abs(amount), currency);
  const value = preferences.symbolPosition === 'after'
    ? `${absolute} ${getCurrencySymbol(currency)}`
    : `${getCurrencySymbol(currency)} ${absolute}`;
  if (amount >= 0) return value;
  return preferences.negativeStyle === 'parentheses' ? `(${value})` : `-${value}`;
}
