import { describe, expect, it } from 'vitest';
import { formatDisplayYmd, loadPreferences, savePreferences, DEFAULT_PREFERENCES } from './preferences';

describe('app preferences', () => {
  it('formats stored dates without changing their value', () => {
    expect(formatDisplayYmd('2026-07-18', 'DD/MM/YYYY')).toBe('18/07/2026');
    expect(formatDisplayYmd('2026-07-18', 'MM/DD/YYYY')).toBe('07/18/2026');
  });

  it('saves compatible preference data', () => {
    const next = { ...DEFAULT_PREFERENCES, weekStartsOn: 0 as const, negativeStyle: 'parentheses' as const };
    savePreferences(next);
    expect(loadPreferences()).toEqual(next);
  });
});
