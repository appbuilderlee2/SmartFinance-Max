import { expect, test } from '@playwright/test';

test('first-time user can complete onboarding', async ({ page }) => {
  await page.goto('/#/welcome');
  await expect(page).toHaveTitle('SmartFinance');
  await expect(page.getByRole('heading', { name: '歡迎使用' })).toBeVisible();
  await page.getByRole('button', { name: '開始使用' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('heading', { name: '統計總覽' })).toBeVisible();
  await expect(page.evaluate(() => localStorage.getItem('smartfinance_has_onboarded'))).resolves.toBe('true');
});

test('transaction survives navigation and reload', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('smartfinance_has_onboarded', 'true');
  });
  await page.goto('/#/add');

  await page.getByRole('button', { name: '輸入金額' }).click();
  await page.getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: '完成輸入' }).click();
  await page.getByRole('button', { name: '餐飲' }).click();
  await page.getByRole('button', { name: /詳細資訊/ }).click();
  await page.getByPlaceholder('輸入備註...').fill('E2E 午餐');
  await page.getByRole('button', { name: '每月', exact: true }).click();
  await page.getByRole('button', { name: '儲存', exact: true }).click();

  await expect(page).toHaveURL(/#\/records$/);
  await expect(page.getByText('E2E 午餐')).toBeVisible();
  await expect(page.getByText('每月', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('E2E 午餐')).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('smartfinance_transactions') || '[]'));
  expect(stored).toHaveLength(1);
  expect(stored[0].amount).toBe(123);
  expect(stored[0].recurrence).toBe('monthly');
});

test('subscription keeps its own currency', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('smartfinance_has_onboarded', 'true');
  });
  await page.goto('/#/subscriptions');
  await page.getByRole('button', { name: '新增訂閱' }).click();
  await page.getByRole('textbox', { name: '訂閱名稱' }).fill('E2E Australian service');
  await page.getByRole('spinbutton', { name: '訂閱金額' }).fill('12.50');
  await page.getByRole('combobox', { name: '訂閱幣別' }).selectOption('AUD');
  await page.getByRole('button', { name: '儲存', exact: true }).click();

  await expect(page).toHaveURL(/#\/subscriptions$/);
  await page.getByRole('combobox', { name: '訂閱幣別篩選' }).selectOption('AUD');
  await expect(page.getByText('E2E Australian service')).toBeVisible();
  await expect(page.getByText('A$ 12.5')).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('smartfinance_subscriptions') || '[]'));
  expect(stored).toHaveLength(1);
  expect(stored[0].currency).toBe('AUD');
});
