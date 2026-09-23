import { expect, it, vi } from 'vitest';
import { saveCycles } from './creditCardCycleStorage';
import { writeJson } from './storage';

vi.mock('./storage', () => ({ readJson: vi.fn(), writeJson: vi.fn() }));

it('returns the database result to the cycle editor', async () => {
  vi.mocked(writeJson).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  expect(await saveCycles([])).toBe(false);
  expect(await saveCycles([])).toBe(true);
  expect(writeJson).toHaveBeenCalledWith('smartfinance_creditcard_cycles', []);
});
