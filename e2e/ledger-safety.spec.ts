import { expect, test, type Page } from '@playwright/test';

const row = { id: 'old', amount: 100, date: '2025-01-10', type: 'EXPENSE', categoryId: 'food', note: '原有帳目', tags: ['舊標籤'] };
async function seed(page: Page) {
  await page.addInitScript(value => {
    if (localStorage.getItem('safety_seed')) return;
    localStorage.setItem('safety_seed', 'true');
    localStorage.setItem('smartfinance_currency', 'AUD');
    localStorage.setItem('smartfinance_has_onboarded', 'true');
    localStorage.setItem('smartfinance_transactions', JSON.stringify([value]));
    localStorage.setItem('smartfinance_deleted_transaction_ids', '["deleted"]');
  }, row);
}
async function rows(page: Page) {
  return page.evaluate(() => new Promise<any[]>((resolve, reject) => {
    const open = indexedDB.open('smartfinance-max');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const request = database.transaction('transactions', 'readonly').objectStore('transactions').getAll();
      request.onsuccess = () => { database.close(); resolve(request.result); };
      request.onerror = () => reject(request.error);
    };
  }));
}

test('legacy currency is pinned and tag navigation includes historical records', async ({ page }) => {
  await seed(page);
  await page.goto('/#/settings/tags');
  await page.getByRole('button', { name: /舊標籤.*1 筆交易/ }).click();
  await expect(page.getByText('全部期間支出')).toBeVisible();
  await expect(page.getByText(/已篩選 · 1 筆/)).toBeVisible();
  expect((await rows(page))[0].currency).toBe('AUD');
  await page.goto('/#/settings?section=preferences');
  await page.getByRole('combobox').first().selectOption('HKD');
  await page.reload();
  expect((await rows(page))[0].currency).toBe('AUD');
});

test('old dated recurring entry can start next period without backfilling', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-27T12:00:00Z'));
  await page.goto('/#/add');
  await page.getByRole('button', { name: '輸入金額' }).click();
  await page.getByRole('button', { name: '9', exact: true }).click();
  await page.getByRole('button', { name: '完成輸入' }).click();
  await page.getByRole('button', { name: '餐飲', exact: true }).click();
  await page.getByLabel('交易日期').fill('2026-01-10');
  await page.getByRole('button', { name: /詳細資訊/ }).click();
  await page.getByRole('button', { name: '每月', exact: true }).click();
  await page.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '週期帳目預覽' })).toContainText('8 筆');
  await page.getByRole('button', { name: '只由下一期開始' }).click();
  await expect(page).toHaveURL(/#\/records$/);
  await page.reload();
  expect(await rows(page)).toHaveLength(1);
});

test('merge preview keeps newer values and known deletions, and a JSON export restores intact', async ({ page }) => {
  await seed(page);
  await page.goto('/#/settings?section=data');
  const backup = { format: 'smartfinance-backup', backupVersion: 2, appVersion: 'test', storage: {
    smartfinance_currency: 'AUD',
    smartfinance_transactions: JSON.stringify([{ ...row, amount: 1 }, { ...row, id: 'deleted' }, { ...row, id: 'new', note: '新帳目' }]),
  } };
  await page.locator('input[accept="application/json,.json"]').setInputFiles({ name: 'sample.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole('button', { name: '合併資料', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '預覽合併' })).toContainText('內容衝突 1 項');
  await page.getByRole('button', { name: '保留現有版本並合併' }).click();
  await page.getByRole('button', { name: '維持刪除' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '好', exact: true }).click();
  await expect(page.getByRole('heading', { name: '資料與備份' })).toBeVisible();
  await expect.poll(async () => (await rows(page)).length).toBe(2);
  expect((await rows(page)).find(value => value.id === 'old').amount).toBe(100);
  expect((await rows(page)).some(value => value.id === 'deleted')).toBe(false);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出 JSON', exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  await page.locator('input[accept="application/json,.json"]').setInputFiles(path!);
  await page.getByRole('button', { name: '取代並還原' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '好', exact: true }).click();
  await expect(page.getByRole('heading', { name: '資料與備份' })).toBeVisible();
  await expect.poll(async () => (await rows(page)).length).toBe(2);
  expect((await rows(page)).every(value => value.currency === 'AUD')).toBe(true);
});
