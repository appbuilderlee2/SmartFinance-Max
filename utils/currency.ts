import { Currency } from '../types';

export const getCurrencySymbol = (currency: Currency): string => {
    switch (currency) {
        case Currency.TWD: return 'NT$';
        case Currency.HKD: return 'HK$';
        case Currency.USD: return '$';
        case Currency.AUD: return 'A$';
        case Currency.RMB: return '¥';
        case Currency.JPY: return '¥';
        case Currency.EUR: return '€';
        case Currency.GBP: return '£';
        default: return '$';
    }
};
