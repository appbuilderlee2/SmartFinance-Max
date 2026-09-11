import { test, expect } from '@playwright/test';

test('add transaction uses the same six-item navigation as calendar', async ({ page }) => {
  await page.goto('/#/calendar');
  const nav = page.getByRole('navigation', { name: '主要導航' });
  await expect(nav.getByRole('button')).toHaveText(['記帳', '月曆', '統計', '記錄', '信用卡', '設定']);
  await nav.getByRole('button', { name: '記帳', exact: true }).click();
  await expect(page.getByRole('heading', { name: '新增帳目' })).toBeVisible();
  await expect(nav.getByRole('button')).toHaveText(['記帳', '月曆', '統計', '記錄', '信用卡', '設定']);
  await expect(nav.getByRole('button', { name: '記帳', exact: true })).toHaveAttribute('aria-current', 'page');
  const action = page.getByTestId('navigation-action');
  await expect(action.getByRole('button', { name: '儲存', exact: true })).toBeVisible();
  const actionBox = await action.boundingBox(), navBox = await nav.boundingBox();
  expect(actionBox).not.toBeNull(); expect(navBox).not.toBeNull();
  expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(navBox!.y);
  await nav.getByRole('button', { name: '信用卡', exact: true }).click();
  await expect(page).toHaveURL(/#\/cards$/);
  await expect(nav.getByRole('button', { name: '信用卡', exact: true })).toHaveAttribute('aria-current', 'page');
});
