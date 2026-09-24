import { expect, test } from '@playwright/test';

test('custom Unicode emoji and pasted image icons persist in category management', async ({ page }) => {
  await page.goto('/#/categories');
  await page.getByRole('button', { name: '新增分類', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '新增分類' });
  await dialog.getByPlaceholder('輸入名稱').fill('表情測試');
  await dialog.getByRole('button', { name: '表情符號' }).click();
  await dialog.getByPlaceholder('輸入表情符號').fill('🫶');
  await expect(dialog.getByText('已選圖示')).toContainText('🫶');
  await dialog.getByRole('button', { name: '新增分類' }).click();
  await expect(page.getByText('表情測試')).toBeVisible();

  await page.getByRole('button', { name: '新增分類', exact: true }).click();
  const imageDialog = page.getByRole('dialog', { name: '新增分類' });
  await imageDialog.getByPlaceholder('輸入名稱').fill('圖像測試');
  await imageDialog.getByRole('button', { name: '表情符號' }).click();
  await imageDialog.locator('input[type="file"]').setInputFiles({
    name: 'sticker.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/bdoAAAAASUVORK5CYII=', 'base64'),
  });
  await expect(imageDialog.getByText('已選圖示')).toBeVisible();
  await expect(imageDialog.locator('img[src^="data:image/png"]')).toBeVisible();
  await imageDialog.getByRole('button', { name: '新增分類' }).click();
  await expect(page.getByText('圖像測試')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '已儲存' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('圖像測試').locator('..').locator('img')).toBeVisible();
});
