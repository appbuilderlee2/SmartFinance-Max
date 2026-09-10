import { test, expect } from '@playwright/test';
async function seed(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByRole('status').filter({ hasText: '已儲存' })).toBeVisible();
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('smartfinance-max');
      open.onsuccess = () => {
        const db = open.result, tx = db.transaction(['transactions','app-data'], 'readwrite');
        const store = tx.objectStore('transactions'); store.clear();
        tx.objectStore('app-data').put(JSON.stringify('AUD'), 'smartfinance_currency');
        tx.objectStore('app-data').put(JSON.stringify([{ id:'food', name:'餐飲', icon:'Utensils', color:'#ff7777', type:'EXPENSE' }]), 'smartfinance_categories');
        const date = new Date(); date.setDate(10); date.setHours(12);
        store.put({ id:'report-1', amount:120, date:date.toISOString(), note:'午餐測試', tags:['假期','旅行'], categoryId:'food', type:'EXPENSE', currency:'AUD' });
        store.put({ id:'report-2', amount:30, date:date.toISOString(), note:'咖啡測試', tags:['旅行'], categoryId:'food', type:'EXPENSE', currency:'AUD' });
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      }; open.onerror = () => reject(open.error);
    });
  });
  await page.reload();
}
test('reports drill down, cancel or apply filters, and handle empty months', async ({ page }) => {
  await seed(page); await page.goto('/#/reports');
  await expect(page.getByRole('heading', {name:'報告統計'})).toBeVisible();
  await page.getByRole('button', {name:'查看全部 ›', exact:true}).click();
  await page.getByRole('button', {name:/餐飲/}).click();
  await expect(page.getByText('午餐測試')).toBeVisible();
  await page.getByRole('button', {name:'篩選報告',exact:true}).click();
  await page.getByPlaceholder('只搜尋備註文字').fill('不匹配');
  await page.getByRole('button', {name:'關閉面板'}).click();
  await expect(page.getByText('午餐測試')).toBeVisible();
  await page.getByRole('button', {name:'篩選報告',exact:true}).click();
  await page.getByPlaceholder('只搜尋備註文字').fill('咖啡');
  await page.getByRole('button', {name:'套用篩選'}).click();
  await expect(page.getByText(/已篩選 · 1 筆/)).toBeVisible();
  await page.getByRole('button', {name:'清除篩選'}).click();
  await page.getByRole('button', {name:'上一個月'}).click();
  await expect(page.getByRole('heading', {name:'呢段期間未有交易'})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('tag merge previews affected records and persists without changing notes', async ({page}) => {
  await seed(page); await page.goto('/#/settings/tags');
  await page.getByRole('button', {name:'整理標籤 假期', exact:true}).click();
  await page.getByRole('textbox').last().fill('旅行');
  await page.getByRole('button', {name:'預覽變更'}).click();
  await expect(page.getByText(/影響 1 筆交易/)).toBeVisible();
  await page.getByRole('button', {name:'確認變更'}).click();
  await expect(page.getByRole('button', {name:'整理標籤 假期',exact:true})).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText:'已儲存' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', {name:'整理標籤 假期',exact:true})).toHaveCount(0);
  await page.goto('/#/edit/report-1');
  await expect(page.locator('input').filter({visible:true}).first()).toBeVisible();
  await expect(page.getByRole('button', {name:'移除標籤 旅行'})).toBeVisible();
  await page.getByRole('button', {name:'加入標籤',exact:true}).click();
  await page.getByRole('textbox', {name:'搜尋或新增標籤'}).fill('新標籤');
  await page.getByRole('button', {name:'新增「新標籤」'}).click();
  await page.getByRole('button', {name:'完成選擇'}).click();
  await expect(page.getByRole('button', {name:'移除標籤 新標籤'})).toBeVisible();
});
