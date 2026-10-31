import { describe, expect, it } from 'vitest';
import { DEFAULT_WALLET_SECTION_ORDER, isWalletSectionOrder, moveWalletSection, normalizeWalletSectionOrder } from './walletSections';

describe('wallet section order', () => {
  it('repairs legacy, partial and duplicated values without losing a section', () => {
    expect(normalizeWalletSectionOrder(['cards', 'cards', 'unknown'])).toEqual(['cards', 'savings', 'subscriptions']);
    expect(normalizeWalletSectionOrder(null)).toEqual(DEFAULT_WALLET_SECTION_ORDER);
  });

  it('moves a section once and keeps boundaries stable', () => {
    expect(moveWalletSection(DEFAULT_WALLET_SECTION_ORDER, 'savings', 1)).toEqual(['subscriptions', 'savings', 'cards']);
    expect(moveWalletSection(DEFAULT_WALLET_SECTION_ORDER, 'savings', -1)).toEqual(DEFAULT_WALLET_SECTION_ORDER);
  });

  it('accepts only a complete unique order for restored backups', () => {
    expect(isWalletSectionOrder(['cards', 'subscriptions', 'savings'])).toBe(true);
    expect(isWalletSectionOrder(['cards', 'cards', 'savings'])).toBe(false);
  });
});
