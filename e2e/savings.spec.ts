import {test,expect} from '@playwright/test';
test('savings deposits and interest persist without counting deposits as income',async({page})=>{
 await page.goto('/#/wallet');
 await page.getByRole('button',{name:'新增第一個儲蓄戶口'}).click();
 await page.getByLabel('戶口名稱').fill('銀行儲蓄');await page.getByLabel('戶口幣別').selectOption('AUD');await page.getByLabel('起始結餘',{exact:true}).fill('5000');await page.getByRole('dialog').getByRole('button',{name:'儲存',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'存入',exact:true}).click();await page.getByLabel('金額',{exact:true}).fill('500');await page.getByRole('dialog').getByRole('button',{name:'儲存',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'利息',exact:true}).click();await page.getByLabel('金額',{exact:true}).fill('20');await page.getByRole('dialog').getByRole('button',{name:'儲存',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByText('A$ 5,520',{exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:/銀行儲蓄/}).click();await expect(page.getByText('A$ 5,520',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'提取',exact:true}).click();await page.getByLabel('金額',{exact:true}).fill('6000');await page.getByRole('dialog').getByRole('button',{name:'儲存',exact:true}).click();await expect(page.getByRole('alert')).toContainText('餘額不足');
});
