import { test, expect } from '../fixtures/base.fixture';

test.describe('checklist', () => {
  test('loads test items for the current program', async ({ app, checklist }) => {
    await app.goto('checklist');
    await expect(checklist.checkboxes().first()).toBeVisible();
    await expect(checklist.checkboxes()).not.toHaveCount(0);
  });

  test('toggling a check persists across a reload (POST)', async ({ app, checklist, page }) => {
    await app.goto('checklist');
    const box = checklist.firstCheckbox();
    await expect(box).toHaveAttribute('aria-pressed', 'false');
    await box.click();
    await expect(box).toHaveAttribute('aria-pressed', 'true');

    // reload the whole SPA — progress must come back from the server
    await page.reload();
    await expect(checklist.firstCheckbox()).toHaveAttribute('aria-pressed', 'true');
  });

  test('all parts render as collapsible dropdowns; jump opens a section', async ({ app, checklist, page }) => {
    await app.goto('checklist');
    await expect(page.locator('.chk-part')).not.toHaveCount(0); // every part is on the page at once
    await checklist.jump(1).click();
    await expect(checklist.part(1)).toHaveAttribute('open', '');
  });

  test('scope dropdown opens a nested domain/subdomain menu and selecting updates it', async ({ app, checklist, page }) => {
    await page.goto('/#/checklist');
    await page.locator('.prog-switch').selectOption({ label: 'Acme Cloud' }); // seeded subdomains
    await expect(checklist.scopeButton()).toBeVisible();
    await expect(checklist.scopeTree()).toBeHidden();       // collapsed by default
    await checklist.scopeButton().click();                  // open the dropdown
    await expect(checklist.scopeTree()).toBeVisible();
    await expect(checklist.scopeSubs().first()).toBeVisible(); // subdomains nested under a domain
    const subName = (await checklist.scopeSubs().first().locator('.cst-name').textContent())!.trim();
    await checklist.scopeSubs().first().click();            // pick a subdomain
    await expect(checklist.activeScopeLabel()).toHaveText(subName); // button now shows it
    await expect(checklist.scopeTree()).toBeHidden();       // menu closed after select
  });
});
