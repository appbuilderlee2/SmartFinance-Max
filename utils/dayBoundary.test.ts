import { afterEach, expect, it, vi } from 'vitest';
import { observeLocalDay } from './dayBoundary';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('refreshes after month rollover and immediately on resume', () => {
  vi.useFakeTimers();
  const windowEvents = new EventTarget();
  Object.assign(windowEvents, { setInterval, clearInterval });
  vi.stubGlobal('window', windowEvents);
  vi.stubGlobal('document', new EventTarget());
  vi.setSystemTime(new Date(2026, 8, 30, 23, 59, 50));
  const callback = vi.fn();
  const stop = observeLocalDay(callback);
  expect(callback).toHaveBeenLastCalledWith('2026-09-30');
  vi.advanceTimersByTime(30_000);
  expect(callback).toHaveBeenLastCalledWith('2026-10-01');
  vi.setSystemTime(new Date(2026, 10, 1, 8));
  document.dispatchEvent(new Event('visibilitychange'));
  expect(callback).toHaveBeenLastCalledWith('2026-11-01');
  stop();
  const count = callback.mock.calls.length;
  window.dispatchEvent(new Event('focus'));
  vi.advanceTimersByTime(60_000);
  expect(callback).toHaveBeenCalledTimes(count);
});
