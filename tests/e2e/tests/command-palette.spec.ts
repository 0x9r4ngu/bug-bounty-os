import { test, expect } from '../fixtures/base.fixture';

test.describe('command palette', () => {
  test('Ctrl+K opens, searches seeded data, and Escape closes', async ({ app, page }) => {
    await app.goto('dashboard');
    await page.keyboard.press('Control+KeyK');
    const input = page.locator('#cmdk-input');
    await expect(input).toBeVisible();

    await input.fill('IDOR');
    await expect(page.locator('.cmdk-row').first()).toBeVisible();
    await expect(page.locator('.cmdk-results')).toContainText(/IDOR/i);

    await page.keyboard.press('Escape');
    await expect(page.locator('.cmdk-scrim')).toHaveCount(0);
  });

  test('running a command navigates', async ({ app, page }) => {
    await app.goto('dashboard');
    await app.openCommandPalette();
    await page.locator('#cmdk-input').fill('Reports');
    const row = page.locator('.cmdk-row', { hasText: 'Reports' }).first();
    await expect(row).toBeVisible();
    await row.click();
    await expect(page).toHaveURL(/#\/reports/);
  });

  test('keyboard shortcut g then a jumps to Assets', async ({ app, page }) => {
    await app.goto('dashboard');
    await page.keyboard.press('g');
    await page.keyboard.press('a');
    await expect(page).toHaveURL(/#\/assets/);
  });
});
