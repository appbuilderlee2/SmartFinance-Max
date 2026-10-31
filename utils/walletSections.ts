export const WALLET_SECTION_ORDER_KEY = 'smartfinance_wallet_section_order';

export const WALLET_SECTIONS = ['savings', 'subscriptions', 'cards'] as const;
export type WalletSection = typeof WALLET_SECTIONS[number];

export const DEFAULT_WALLET_SECTION_ORDER: WalletSection[] = [...WALLET_SECTIONS];

export function isWalletSectionOrder(value: unknown): value is WalletSection[] {
  return Array.isArray(value)
    && value.length === WALLET_SECTIONS.length
    && new Set(value).size === WALLET_SECTIONS.length
    && value.every(section => WALLET_SECTIONS.includes(section as WalletSection));
}

export function normalizeWalletSectionOrder(value: unknown): WalletSection[] {
  if (!Array.isArray(value)) return [...DEFAULT_WALLET_SECTION_ORDER];
  const known = value.filter((section): section is WalletSection =>
    typeof section === 'string' && WALLET_SECTIONS.includes(section as WalletSection));
  return [...new Set(known), ...WALLET_SECTIONS.filter(section => !known.includes(section))];
}

export function moveWalletSection(order: WalletSection[], section: WalletSection, direction: -1 | 1): WalletSection[] {
  const normalized = normalizeWalletSectionOrder(order);
  const from = normalized.indexOf(section);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= normalized.length) return normalized;
  const next = [...normalized];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
