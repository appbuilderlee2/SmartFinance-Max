import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'Australia/Adelaide' });
test('draft dates follow local today unless explicitly selected', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-01T15:00:00Z'));
  await page.goto('/#/add');
  const date = page.getByLabel('交易日期');
  await expect(date).toHaveValue('2026-10-02');
  await page.clock.setFixedTime(new Date('2026-10-02T15:00:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(date).toHaveValue('2026-10-03');
  await date.fill('2026-09-24');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.goto('/#/add');
  await expect(page.getByLabel('交易日期')).toHaveValue('2026-09-24');
  await page.getByRole('button', { name: '今天', exact: true }).click();
  await expect(page.getByLabel('交易日期')).toHaveValue('2026-10-03');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.clock.setFixedTime(new Date('2026-10-03T15:00:00Z'));
  await page.goto('/#/add');
  await expect(page.getByLabel('交易日期')).toHaveValue('2026-10-04');
});
