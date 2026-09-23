import { test, expect } from '@playwright/test';
test('draft survives navigation and reload, clears after durable save, and deletion can be undone', async ({ page }) => {
  await page.goto('/#/add');
  await page.getByRole('button',{name:'輸入金額'}).click();
  await page.getByRole('button',{name:'7',exact:true}).click();
  await page.getByRole('button',{name:'完成輸入'}).click();
  await page.getByRole('button',{name:'餐飲',exact:true}).click();
  await page.getByRole('button',{name:/詳細資訊/}).click();
  await page.getByPlaceholder('輸入備註...').fill('保留草稿測試');
  const nav=page.getByRole('navigation',{name:'主要導航'});
  await nav.getByRole('button',{name:'月曆',exact:true}).click();
  await nav.getByRole('button',{name:'記帳',exact:true}).click();
  await expect(page.getByPlaceholder('輸入備註...')).toHaveValue('保留草稿測試');
  await page.reload();
  await expect(page.getByPlaceholder('輸入備註...')).toHaveValue('保留草稿測試');
  await page.getByRole('button',{name:'儲存',exact:true}).click();
  await expect(page).toHaveURL(/#\/records$/);
  expect(await page.evaluate(()=>sessionStorage.getItem('sf.entryDraft.v1'))).toBeNull();
  await page.getByText('保留草稿測試',{exact:true}).click();
  await page.getByRole('button',{name:/刪除/}).click();
  await page.getByRole('alertdialog', { name: '刪除帳目？' }).getByRole('button', { name: '刪除帳目' }).click();
  await page.getByRole('button',{name:'復原',exact:true}).click();
  await expect(page.getByText('保留草稿測試',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByText('保留草稿測試',{exact:true})).toBeVisible();
});

test('failed database write keeps the form and retries without a duplicate', async ({ page }) => {
  await page.goto('/#/add');
  await page.getByRole('button',{name:'輸入金額'}).click();
  await page.getByRole('button',{name:'8',exact:true}).click();
  await page.getByRole('button',{name:'完成輸入'}).click();
  await page.getByRole('button',{name:'餐飲',exact:true}).click();
  await page.getByRole('button',{name:/詳細資訊/}).click();
  await page.getByPlaceholder('輸入備註...').fill('失敗重試唯一帳目');
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'transactions') {
        IDBObjectStore.prototype.put = original;
        throw new DOMException('Simulated write failure', 'QuotaExceededError');
      }
      return original.apply(this, args);
    };
  });
  await page.getByRole('button',{name:'儲存',exact:true}).click();
  await expect(page.locator('.sf-entry-error')).toContainText('儲存失敗');
  await expect(page.getByPlaceholder('輸入備註...')).toHaveValue('失敗重試唯一帳目');
  await page.getByRole('button',{name:'儲存',exact:true}).click();
  await expect(page).toHaveURL(/#\/records$/);
  await page.reload();
  await expect(page.getByText('失敗重試唯一帳目',{exact:true})).toHaveCount(1);
});
