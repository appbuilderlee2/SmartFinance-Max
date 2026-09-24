import { test, expect } from '@playwright/test';

test('draft and receipt survive closing the tab', async ({ page, context }) => {
  await page.goto('/#/add');
  await page.getByRole('button', { name: /詳細資訊/ }).click();
  await page.getByPlaceholder('輸入備註...').fill('重新開分頁保留草稿');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'receipt.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/bdoAAAAASUVORK5CYII=', 'base64'),
  });
  await expect(page.locator('img[alt="Receipt Preview"]')).toBeVisible();
  await expect.poll(() => page.evaluate(async () => {
    return new Promise<boolean>((resolve, reject) => {
      const request = indexedDB.open('smartfinance-entry-draft');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const tx = request.result.transaction('draft', 'readonly');
        const get = tx.objectStore('draft').get('sf.entryDraft.v1');
        get.onsuccess = () => resolve(get.result?.note === '重新開分頁保留草稿' && Boolean(get.result?.receiptPreview));
        get.onerror = () => reject(get.error);
      };
    });
  })).toBe(true);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto('/#/add');
  await expect(reopened.getByPlaceholder('輸入備註...')).toHaveValue('重新開分頁保留草稿');
  await expect(reopened.locator('img[alt="Receipt Preview"]')).toBeVisible();
});

test('older tab blocks stale edits after another tab writes', async ({ page, context }) => {
  await page.goto('/#/settings');
  await expect(page.getByRole('navigation', { name: '主要導航' })).toBeVisible();
  const other = await context.newPage();
  await other.goto('/#/add');
  await other.getByRole('button', { name: '輸入金額' }).click();
  await other.getByRole('button', { name: '7', exact: true }).click();
  await other.getByRole('button', { name: '完成輸入' }).click();
  await other.getByRole('button', { name: '查看全部' }).click();
  await other.getByRole('button', { name: '餐飲', exact: true }).click();
  await other.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(other).toHaveURL(/#\/records$/);
  await expect(page.getByRole('alertdialog', { name: '另一分頁有更新' })).toBeVisible();
  await page.getByRole('button', { name: '重新載入最新資料' }).click();
  await expect(page.getByRole('alertdialog', { name: '另一分頁有更新' })).toHaveCount(0);
});
