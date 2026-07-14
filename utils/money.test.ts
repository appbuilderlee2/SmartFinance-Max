import { describe, expect, it } from 'vitest';
import { Currency } from '../types';
import {
  addMoney,
  formatMoney,
  getCurrencyFractionDigits,
  parseMoneyInput,
  roundMoney,
  sumMoney,
  toMinorUnits,
} from './money';

describe('money arithmetic', () => {
  it('adds decimal currency without binary floating-point residue', () => {
    expect(addMoney(0.1, 0.2, Currency.AUD)).toBe(0.3);
    expect(sumMoney([10.1, 20.2, 30.3], Currency.HKD)).toBe(60.6);
  });

  it('rounds half-up at the currency precision', () => {
    expect(roundMoney(1.005, Currency.USD)).toBe(1.01);
    expect(toMinorUnits(9.999, Currency.AUD)).toBe(1000);
  });

  it('uses whole units for JPY', () => {
    expect(getCurrencyFractionDigits(Currency.JPY)).toBe(0);
    expect(roundMoney(100.6, Currency.JPY)).toBe(101);
    expect(parseMoneyInput('100.5', Currency.JPY)).toBeNull();
  });

  it('rejects excess decimal places at input boundaries', () => {
    expect(parseMoneyInput('12.34', Currency.HKD)).toBe(12.34);
    expect(parseMoneyInput('12.345', Currency.HKD)).toBeNull();
    expect(parseMoneyInput('-1', Currency.HKD)).toBeNull();
  });

  it('formats symbols and valid fraction digits consistently', () => {
    expect(formatMoney(1234.5, Currency.AUD)).toBe('A$ 1,234.5');
    expect(formatMoney(1234.5, Currency.JPY)).toBe('¥ 1,235');
  });
});
