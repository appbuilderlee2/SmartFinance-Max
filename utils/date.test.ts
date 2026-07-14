import { describe, expect, it } from 'vitest';
import { parseLocalYMD, toLocalYMD } from './date';

describe('local dates', () => {
  it('accepts real calendar dates', () => {
    const date = parseLocalYMD('2026-02-28');
    expect(date && toLocalYMD(date)).toBe('2026-02-28');
  });

  it('rejects dates that JavaScript would silently roll over', () => {
    expect(parseLocalYMD('2026-02-29')).toBeNull();
    expect(parseLocalYMD('2026-04-31')).toBeNull();
    expect(parseLocalYMD('2026-13-01')).toBeNull();
  });
});
