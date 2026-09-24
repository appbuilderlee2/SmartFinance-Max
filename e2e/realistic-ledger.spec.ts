import { expect, test } from '@playwright/test';

// Synthetic data matching the shape and scale of a real 180-row backup.
// Personal transactions, labels, card details and amounts never enter this fixture.
test('six entry points and management screens render with a full-sized ledger', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('status').filter({ hasText: '已儲存' })).toBeVisible();
  await page.evaluate(async () => {
    const counts = [30, 24, 11, 20, 12, 22, 19, 18, 14, 10];
    const categories = Array.from({ length: 20 }, (_, index) => ({
      id: `sample-category-${index}`,
      name: `測試分類 ${index + 1}`,
      type: index < 16 ? 'EXPENSE' : 'INCOME',
      icon: index === 0 ? 'emoji-image:data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/bdoAAAAASUVORK5CYII=' : index === 1 ? 'emoji:🫶' : 'Tag',
      color: 'bg-blue-500', order: index,
    }));
    let sequence = 0;
    const rows = counts.flatMap((count, offset) => Array.from({ length: count }, () => {
      const index = sequence++;
      const type = index % 6 === 0 ? 'INCOME' : 'EXPENSE';
      const date = new Date(2025, 11 + offset, 1 + index % 25, 12);
      return {
        id: `sample-row-${index}`, type, amount: index + 1.25,
        categoryId: `sample-category-${type === 'INCOME' ? 16 + index % 4 : index % 16}`,
        date: date.toISOString(), note: `測試帳目 ${index}`, tags: index % 6 === 0 ? ['樣本'] : [],
        ...(index < 13 ? { isRecurring: true } : { currency: 'AUD' }),
      };
    }));
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('smartfinance-max');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const database = open.result;
        const tx = database.transaction(['transactions', 'app-data'], 'readwrite');
        const store = tx.objectStore('transactions');
        store.clear(); rows.forEach(row => store.put(row));
        tx.objectStore('app-data').put(JSON.stringify(categories), 'smartfinance_categories');
        tx.objectStore('app-data').put(JSON.stringify(categories.map(c => ({ categoryId: c.id, limit: 1000, spent: 0 }))), 'smartfinance_budgets');
        tx.objectStore('app-data').put('AUD', 'smartfinance_currency');
        tx.oncomplete = () => { database.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
    localStorage.setItem('smartfinance_has_onboarded', 'true');
  });
  await page.reload();

  const screens = [
    ['/', '統計總覽'], ['/calendar', '月曆'], ['/reports', '報告統計'],
    ['/records', '帳目明細'], ['/cards', '信用卡'], ['/settings', '設定'],
    ['/add', '新增帳目'], ['/categories', '分類管理'], ['/budget', '月預算設定'],
    ['/settings/tags', '標籤管理'], ['/subscriptions', '訂閱服務'],
  ] as const;
  for (const [route, heading] of screens) {
    await page.goto(`/#${route}`);
    await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), route).toBe(true);
  }
  await page.goto('/#/budget');
  await expect(page.getByText('測試分類 1', { exact: true })).toBeVisible();
  await expect(page.getByText('測試分類 17', { exact: true })).toHaveCount(0);
  await page.goto('/#/categories');
  await expect(page.locator('img[src^="data:image/png"]')).toBeVisible();
  await page.goto('/#/records');
  await expect(page.getByText('180 筆帳目')).toBeVisible();
  await page.getByRole('button', { name: '搜尋帳目' }).click();
  await page.getByRole('textbox', { name: '搜尋帳目關鍵字' }).fill('測試帳目 179');
  await expect(page.getByText('1 筆符合條件的帳目')).toBeVisible();
  expect(errors).toEqual([]);
});
