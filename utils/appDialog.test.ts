import { afterEach, describe, expect, it } from 'vitest';
import { getActiveAppDialog, resolveAppDialog, showAppAlert, showAppConfirm, showAppPrompt } from './appDialog';

afterEach(() => {
  if (getActiveAppDialog()) resolveAppDialog(null);
});

describe('app dialog queue', () => {
  it('keeps dialogs ordered and resolves each request with the selected result', async () => {
    const confirmation = showAppConfirm('Continue?');
    const alert = showAppAlert('Saved');
    expect(getActiveAppDialog()?.type).toBe('confirm');

    resolveAppDialog(true);
    await expect(confirmation).resolves.toBe(true);
    expect(getActiveAppDialog()?.type).toBe('alert');

    resolveAppDialog(undefined);
    await expect(alert).resolves.toBeUndefined();
    expect(getActiveAppDialog()).toBeNull();
  });

  it('returns null when a prompt is cancelled', async () => {
    const prompt = showAppPrompt('Enter PIN');
    resolveAppDialog(null);
    await expect(prompt).resolves.toBeNull();
  });
});
