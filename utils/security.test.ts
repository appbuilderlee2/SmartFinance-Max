import { describe, expect, it } from 'vitest';
import { createPinSecurity, verifyPin, DEFAULT_SECURITY_SETTINGS } from './security';

describe('PIN security', () => {
  it('stores a derived hash and verifies without retaining the PIN', async () => {
    const settings = await createPinSecurity('2468', DEFAULT_SECURITY_SETTINGS);
    expect(settings.pinHash).not.toContain('2468');
    expect(settings.pinSalt).toBeTruthy();
    await expect(verifyPin('2468', settings)).resolves.toBe(true);
    await expect(verifyPin('0000', settings)).resolves.toBe(false);
  });
});
