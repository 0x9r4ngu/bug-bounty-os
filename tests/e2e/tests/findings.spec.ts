import { test, expect } from '../fixtures/base.fixture';

test.describe('findings', () => {
  test('lists seeded findings and opens a detail aside', async ({ app, findings }) => {
    await app.goto('findings');
    await expect(findings.rows().first()).toBeVisible();
    await findings.row(/exposes PII/).click(); // unique seeded title (avoids the IDOR/BOLA class column)
    await expect(findings.detail).toBeVisible();
    await expect(findings.detailTitle()).toContainText('exposes PII');
  });

  test('status tab filters the table', async ({ app, findings, page }) => {
    await app.goto('findings');
    await findings.statusTab('Resolved').click();
    await expect(page.locator('.tab.on')).toContainText('Resolved');
    // every visible row shows the Resolved status pill
    const statuses = page.locator('[data-fopen] .st');
    const count = await statuses.count();
    for (let i = 0; i < count; i++) {
      await expect(statuses.nth(i)).toHaveText('Resolved');
    }
  });

  test('status pipeline click updates the finding', async ({ app, findings }) => {
    await app.goto('findings');
    await findings.rows().first().click();
    await expect(findings.statusStage('Triaged')).toBeVisible();
    await findings.statusStage('Triaged').click();
    await expect(app.toast).toContainText(/Triaged/);
  });

  // Note: creating findings is superseded by "New report" (findings == reports); that flow is
  // covered in program-page.spec. The legacy findings view remains read-only for seeded data.
});
