import { describe, expect, it } from 'vitest';
import { createOpenCycle, getCreditCardCycleAlerts, type CreditCardCycle } from './creditCardCycles';
import { migrateCreditCardCurrencies } from './creditCardCycleStorage';

const cycle = (updates: Partial<CreditCardCycle> = {}): CreditCardCycle => ({
  id: 'ccyc_card-1_2026-09', cardId: 'card-1', year: 2026, month0: 8,
  yearMonth: '2026-09', dueDate: '2026-09-18', status: 'open', amountDue: 100,
  ...updates,
});

describe('credit-card currencies and due alerts', () => {
  it('copies the card currency only when a new cycle is created', () => {
    const created = createOpenCycle({ id: 'card-1', currency: 'AUD', statementDay: 3, dueDay: 18 }, 2026, 8);
    expect(created.currency).toBe('AUD');
  });

  it('stamps legacy cards and cycles once without changing explicit history', () => {
    const result = migrateCreditCardCurrencies(
      [{ id: 'card-1' }, { id: 'card-2', currency: 'USD' }],
      [cycle({ currency: undefined }), cycle({ id: 'old-usd', cardId: 'card-2', currency: 'HKD' })],
      'AUD'
    );
    expect(result.cards).toEqual([{ id: 'card-1', currency: 'AUD' }, { id: 'card-2', currency: 'USD' }]);
    expect(result.cycles.map(item => item.currency)).toEqual(['AUD', 'HKD']);
  });

  it('distinguishes overdue, upcoming and missing amounts independently', () => {
    const now = new Date(2026, 8, 11, 12);
    expect(getCreditCardCycleAlerts(cycle({ dueDate: '2026-09-10', amountDue: undefined }), now)).toEqual({ overdue: true, upcoming: false, missingAmount: true });
    expect(getCreditCardCycleAlerts(cycle({ dueDate: '2026-09-18' }), now)).toEqual({ overdue: false, upcoming: true, missingAmount: false });
    expect(getCreditCardCycleAlerts(cycle({ dueDate: '2026-09-19' }), now)).toEqual({ overdue: false, upcoming: false, missingAmount: false });
    expect(getCreditCardCycleAlerts(cycle({ status: 'closed', amountDue: undefined }), now)).toEqual({ overdue: false, upcoming: false, missingAmount: false });
  });
});
