import { test, expect } from '../fixtures/base.fixture';

test.describe('programs', () => {
  test('lists seeded programs', async ({ app, programs }) => {
    await app.goto('programs');
    await expect(programs.rows().first()).toBeVisible();
    await expect(programs.rows()).not.toHaveCount(0);
    await expect(programs.row('Acme Cloud')).toBeVisible();
  });

  test('private filter narrows the list', async ({ app, programs }) => {
    await app.goto('programs');
    await programs.filterChip('private').click();
    await expect(programs.filterChip('private')).toHaveClass(/on/);
    // seeded private programs (Nimbus Pay, Vertex API) remain; public ones drop out
    await expect(programs.row('Nimbus Pay')).toBeVisible();
    await expect(programs.row('Orbit Social')).toHaveCount(0);
  });

  test('opening a program row navigates to its full page (not a side drawer)', async ({ app, programs, page }) => {
    await app.goto('programs');
    await programs.row('Acme Cloud').click();
    await expect(page).toHaveURL(/#\/program\?id=/);
    // full-page, not a drawer
    await expect(page.locator('.drawer')).toHaveCount(0);
    await expect(programs.programTitle).toContainText('Acme Cloud');

    await programs.programTab('notes').click();
    await expect(programs.notesEditor).toBeVisible();

    await programs.programTab('timeline').click();
    await expect(page.locator('.timeline')).toBeVisible();

    // breadcrumb returns to the list
    await programs.backToProgramsLink.click();
    await expect(page).toHaveURL(/#\/programs/);
    await expect(programs.rows().first()).toBeVisible();
  });

  test('create a program via the modal opens its full page', async ({ app, programs, page }) => {
    await app.goto('programs');
    await programs.newProgramButton.click();
    await expect(page.locator('#np-name')).toBeVisible();
    await programs.fillNewProgram({ name: 'E2E Recon Co', platform: 'Bugcrowd', assets: 'e2e.example.com' });
    await expect(page).toHaveURL(/#\/program\?id=/);
    await expect(programs.programTitle).toContainText('E2E Recon Co');
    await expect(app.toastWith(/created/i)).toBeVisible();
  });

  test('programs show as cards (box view)', async ({ app, page }) => {
    await app.goto('programs');
    await expect(page.locator('.prog-grid')).toBeVisible();
    await expect(page.locator('.prog-card').first()).toBeVisible();
  });

  test('delete a program', async ({ app, programs, page }) => {
    await app.goto('programs');
    await programs.newProgramButton.click();
    await programs.fillNewProgram({ name: 'DeleteMe Co' });
    await expect(page).toHaveURL(/#\/program\?id=/);
    await page.locator('[data-delprog2]').click();        // delete from the program header
    await page.locator('[data-yes]').click();             // in-app confirm
    await expect(page).toHaveURL(/#\/programs/);
    await expect(page.locator('.prog-card', { hasText: 'DeleteMe Co' })).toHaveCount(0);
  });
});
