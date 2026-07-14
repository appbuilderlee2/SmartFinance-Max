import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../constants';
import { CATEGORY_ICON_NAMES, isSupportedIcon } from './Icon';

describe('icon registry', () => {
  it('supports every selectable category icon', () => {
    expect(CATEGORY_ICON_NAMES.every(isSupportedIcon)).toBe(true);
  });

  it('supports every built-in category icon and safe fallbacks', () => {
    expect(CATEGORIES.every(category => isSupportedIcon(category.icon))).toBe(true);
    expect(isSupportedIcon('HelpCircle')).toBe(true);
    expect(isSupportedIcon('Image')).toBe(true);
    expect(isSupportedIcon('emoji:🍔')).toBe(true);
  });
});
