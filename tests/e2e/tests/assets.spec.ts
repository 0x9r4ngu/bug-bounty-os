import { test, expect } from '../fixtures/base.fixture';

test.describe('assets & subdomains', () => {
  test('shows a program with assets and expands/collapses a row', async ({ app, assets, page }) => {
    await app.goto('assets');
    // pick a seeded program that actually has assets
    await assets.selectProgram('Acme Cloud');
    await expect(assets.assets().first()).toBeVisible();

    const sub = assets.firstSubList();
    const before = await sub.evaluate((el) => getComputedStyle(el).display);
    await assets.firstToggle().click();
    await expect
      .poll(async () => sub.evaluate((el) => getComputedStyle(el).display))
      .not.toBe(before);
  });

  test('add-asset modal opens and closes', async ({ app, assets, page }) => {
    await app.goto('assets');
    await assets.selectProgram('Acme Cloud');
    await assets.addAssetButton.click();
    await expect(page.locator('#a-hosts')).toBeVisible();
    await page.locator('.modal-h .x').click();
    await expect(page.locator('#a-hosts')).toHaveCount(0);
  });
});
