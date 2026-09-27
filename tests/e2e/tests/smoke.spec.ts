import { test, expect } from '../fixtures/base.fixture';

const ROUTES: Array<[string, string]> = [
  ['dashboard', 'Dashboard'],
  ['programs', 'Programs'],
  ['assets', 'Assets & subdomains'],
  ['checklist', 'Testing checklist'],
  ['findings', 'Findings'],
  ['reports', 'Reports'],
];

test.describe('smoke', () => {
  test('every route renders its shell without JS errors', async ({ app, page }) => {
    for (const [route, crumb] of ROUTES) {
      await app.goto(route);
      // main panel must be wide (guards the #app flex-container regression that
      // previously left only the sidebar visible)
      const width = await page.locator('.main').evaluate((el) => el.getBoundingClientRect().width);
      expect(width, `main panel width on ${route}`).toBeGreaterThan(700);
      await expect(page.locator('.crumb')).toContainText(crumb);
    }
    // errorGuard auto-fixture asserts no JS/console errors across all routes.
  });

  test('dashboard shows seeded KPI numbers', async ({ app, page }) => {
    await app.goto('dashboard');
    const kpis = page.locator('.kpi-num');
    await expect(kpis.first()).toBeVisible();
    await expect(kpis.first()).toContainText('$'); // total bounties earned
    // seeded DB has data, so total findings KPI is non-zero
    await expect(page.getByText('findings logged')).toBeVisible();
  });

  test('active nav item reflects the current route', async ({ app }) => {
    await app.goto('reports');
    await expect(app.activeNav()).toContainText('Reports');
  });

  test('sidebar nav has only Dashboard, Programs, Reports', async ({ app, page }) => {
    await app.goto('dashboard');
    const labels = await page.locator('#sidebar .nav-item .lbl').allTextContents();
    expect(labels).toEqual(['Dashboard', 'Programs', 'Reports']);
  });

  test('dashboard now includes analytics (over-time + funnel)', async ({ app, page }) => {
    await app.goto('dashboard');
    await expect(page.getByRole('heading', { name: /Bounties.*reports over time/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Status funnel' })).toBeVisible();
  });

  test('New report lives on the Reports page and opens the editor directly (no modal)', async ({ app, page }) => {
    // not shown on the dashboard/topbar anymore
    await app.goto('dashboard');
    await expect(page.getByRole('button', { name: /New report/ })).toHaveCount(0);
    // Reports page has it, and it goes straight to the editor
    await app.goto('reports');
    await page.getByRole('button', { name: /New report/ }).click();
    await expect(page).toHaveURL(/#\/reports\?open=/);
    await expect(page.locator('.modal')).toHaveCount(0);
    await expect(page.locator('#rep-body')).toBeVisible();
  });
});
