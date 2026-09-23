import { test, expect } from '@playwright/test';

test('record search, currency subtotals and history survive a detail round trip', async ({ page }) => {
  await page.goto('/#/add');
  await page.getByRole('button', { name: '輸入金額' }).click();
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: '5', exact: true }).click();
  await page.getByRole('button', { name: '完成輸入' }).click();
  await page.getByLabel('搜尋分類').fill('餐');
  await page.getByRole('button', { name: '餐飲', exact: true }).click();
  await page.getByRole('button', { name: /詳細資訊/ }).click();
  await page.getByPlaceholder('輸入備註...').fill('午餐搜尋測試');
  await page.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(page).toHaveURL(/#\/records$/);
  await expect(page.locator('.sf-daily-totals')).toContainText('支出');
  await expect(page.locator('.sf-daily-totals')).toContainText('25');
  await page.getByRole('button', { name: '搜尋帳目', exact: true }).click();
  await page.getByLabel('搜尋帳目關鍵字').fill('午餐搜尋測試');
  await expect(page.locator('.sf-record-row')).toHaveCount(1);
  await page.locator('.sf-record-row').click();
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await expect(page.getByLabel('搜尋帳目關鍵字')).toHaveValue('午餐搜尋測試');
  await expect(page.locator('.sf-record-row')).toHaveCount(1);
  await page.getByLabel('搜尋帳目關鍵字').fill('找不到的帳目');
  await expect(page.getByText('沒有符合條件的帳目')).toBeVisible();
  await page.getByRole('button', { name: '清除篩選', exact: true }).click();
  await expect(page.locator('.sf-record-row')).toHaveCount(1);
});

test('switching transaction type requires a matching category', async ({ page }) => {
  await page.goto('/#/add');
  await page.getByRole('button', { name: '餐飲', exact: true }).click();
  await page.getByRole('button', { name: '收入', exact: true }).click();
  await page.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(page.getByRole('alertdialog', { name: '提示' })).toContainText('請選擇分類');
  await expect(page).toHaveURL(/#\/add$/);
});
