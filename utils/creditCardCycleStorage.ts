// utils/creditCardCycleStorage.ts

import { readJson, writeJson } from './storage';
import { CreditCardCycle, CYCLES_KEY, getCurrentYearMonth, createOpenCycle } from './creditCardCycles';

export function loadCycles(): CreditCardCycle[] {
  return readJson<CreditCardCycle[]>(CYCLES_KEY) ?? [];
}

export function saveCycles(cycles: CreditCardCycle[]): void {
  writeJson(CYCLES_KEY, cycles);
}

export function upsertCycle(cycles: CreditCardCycle[], cycle: CreditCardCycle): CreditCardCycle[] {
  const idx = cycles.findIndex(c => c.id === cycle.id);
  if (idx >= 0) {
    const next = [...cycles];
    next[idx] = cycle;
    return next;
  }
  return [...cycles, cycle];
}

export function getOrCreateCurrentCycle(card: any, cycles: CreditCardCycle[], now = new Date()): { cycle: CreditCardCycle; cycles: CreditCardCycle[] } {
  const { year, month0, yearMonth } = getCurrentYearMonth(now);

  // Prefer an open cycle if it exists (e.g. when user already advanced to next month).
  const open = cycles
    .filter(c => c.cardId === card.id && c.status !== 'closed')
    .sort((a, b) => (a.yearMonth < b.yearMonth ? 1 : -1))[0];
  if (open) return { cycle: open, cycles };

  const id = `ccyc_${card.id}_${yearMonth}`;
  const existing = cycles.find(c => c.id === id);
  if (existing) return { cycle: existing, cycles };

  const created = createOpenCycle(card, year, month0);
  return { cycle: created, cycles: [...cycles, created] };
}
