import { test, expect } from '@playwright/test';

test('add transaction uses the same six-item navigation as calendar', async ({ page }) => {
  await page.goto('/#/calendar');
  const nav = page.getByRole('navigation', { name: '主要導航' });
  await expect(nav.getByRole('button')).toHaveText(['記帳', '總覽', '月曆', '信用卡', '錢包', '設定']);
  await nav.getByRole('button', { name: '記帳', exact: true }).click();
  await expect(page.getByRole('heading', { name: '新增帳目' })).toBeVisible();
  await expect(nav.getByRole('button')).toHaveText(['記帳', '總覽', '月曆', '信用卡', '錢包', '設定']);
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

test('Settings opens a dedicated Notifications page with browser-appropriate controls', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByRole('button', { name: '通知', exact: true }).click();
  await expect(page).toHaveURL(/#\/settings\/notifications$/);
  await expect(page.getByRole('heading', { name: '通知', exact: true })).toBeVisible();
  for (const name of ['每日記帳提醒', '信用卡截數提醒', '輸入信用卡應繳金額提醒', '信用卡繳費提醒', '訂閱續期提醒', '預算提醒']) {
    await expect(page.getByRole('checkbox', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByLabel('提醒時間', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '啟用 iPhone 通知' })).toHaveCount(0);
  await page.getByRole('checkbox', { name: '訂閱續期提醒' }).uncheck();
  await expect(page.getByRole('status').filter({ hasText: '已儲存' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: '訂閱續期提醒' })).not.toBeChecked();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await expect(page).toHaveURL(/#\/settings$/);
});
