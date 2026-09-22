import { test, expect } from '@playwright/test';

test('six destinations fit and calendar returns to today in both Fluid themes', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByLabel('搜尋設定').fill('主題');
  for (const theme of ['淺色', '深色']) {
    await page.getByRole('button', { name: theme, exact: true }).click();
    const nav = page.getByRole('navigation', { name: '主要導航' });
    await nav.getByRole('button', { name: '月曆', exact: true }).click();
    const summary = page.locator('[data-month-key]');
    await expect(summary).toBeVisible();
    const current = await summary.getAttribute('data-month-key');
    await page.getByRole('button', { name: '下個月', exact: true }).click();
    await expect(summary).not.toHaveAttribute('data-month-key', current!);
    await page.getByRole('button', { name: '今天', exact: true }).click();
    await expect(summary).toHaveAttribute('data-month-key', current!);
    await expect(nav.getByRole('button')).toHaveText(['記帳', '月曆', '統計', '記錄', '信用卡', '設定']);
    const boxes = await nav.getByRole('button').evaluateAll(buttons => buttons.map(button => {
      const r = button.getBoundingClientRect(); return { left:r.left, right:r.right, width:r.width, height:r.height };
    }));
    for (let i = 0; i < boxes.length; i++) {
      expect(boxes[i].width).toBeGreaterThanOrEqual(44);
      expect(boxes[i].height).toBeGreaterThanOrEqual(44);
      if (i) expect(boxes[i].left).toBeGreaterThanOrEqual(boxes[i - 1].right);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await nav.getByRole('button', { name: '設定', exact: true }).click();
    await page.getByLabel('搜尋設定').fill('主題');
  }
});
