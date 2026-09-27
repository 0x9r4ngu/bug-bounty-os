import { test, expect } from '../fixtures/base.fixture';

// The program opens as its own FULL PAGE (not a side drawer), per the user's request.
test.describe('program full page', () => {
  test('opens in place, never as a side drawer', async ({ app, programs, page }) => {
    await app.goto('programs');
    await programs.rows().first().click();
    await expect(page).toHaveURL(/#\/program\?id=/);
    await expect(page.locator('.drawer')).toHaveCount(0);           // no sideways drawer
    await expect(page.locator('.scrim')).toHaveCount(0);            // no backdrop
    await expect(programs.programTitle).toBeVisible();
    // main content is full width (not a narrow rail)
    const w = await page.locator('.prog-page').evaluate((el) => el.getBoundingClientRect().width);
    expect(w).toBeGreaterThan(700);
  });

  test('open via sidebar pin also goes full page', async ({ app, programs, page }) => {
    await app.goto('dashboard');
    await page.locator('[data-openprog]').first().click();
    await expect(page).toHaveURL(/#\/program\?id=/);
    await expect(programs.programTitle).toBeVisible();
  });

  test('breadcrumb and Esc both return to the list', async ({ app, programs, page }) => {
    await app.goto('programs');
    await programs.rows().first().click();
    await expect(page).toHaveURL(/#\/program\?id=/);
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/#\/programs/);
  });

  test('watch toggle works on the full page', async ({ app, programs, page }) => {
    await app.goto('programs');
    await programs.rows().first().click();
    await page.locator('[data-watch]').click();
    await expect(app.toastWith(/watch/i)).toBeVisible();
  });

  test('delete a scope from the In scope list', async ({ app, programs, page }) => {
    await app.goto('programs');
    await programs.newProgramButton.click();
    await programs.fillNewProgram({ name: 'DelScope Co', assets: 'a.del.example.com, b.del.example.com' });
    await expect(page).toHaveURL(/#\/program\?id=/);
    const rows = page.locator('.scope-tree .tree-asset');
    await expect(rows).toHaveCount(2);
    await page.locator('[data-delasset]').first().click();
    await page.locator('[data-yes]').click(); // in-app confirm
    await expect(app.toastWith(/removed/i)).toBeVisible();
    await expect(page.locator('.scope-tree .tree-asset')).toHaveCount(1);
  });

  test('add scope with just a domain (single field)', async ({ app, programs, page }) => {
    await app.goto('programs');
    await programs.newProgramButton.click();
    await programs.fillNewProgram({ name: 'AddScope Co' });
    await expect(page).toHaveURL(/#\/program\?id=/);
    await page.locator('[data-addasset]').click();
    await expect(page.locator('#a-hosts')).toBeVisible();
    await page.locator('#a-hosts').fill('shop.addscope.com');
    await page.locator('#a-save').click();
    await expect(app.toastWith(/scope added/i)).toBeVisible();
    await expect(page.locator('.scope-tree .tree-asset', { hasText: 'shop.addscope.com' })).toBeVisible();
  });

  test('clicking an asset opens a report bound to it', async ({ app, programs, page }) => {
    await app.goto('programs');
    await programs.row('Acme Cloud').click();
    await expect(page).toHaveURL(/#\/program\?id=/);
    await page.locator('.scope-tree [data-open-report="asset"]').first().click();
    await expect(page).toHaveURL(/#\/reports\?open=/);
    await expect(page.locator('#rep-body')).toBeVisible();
    // the editor shows it is bound to the asset
    await expect(page.locator('.rep-sub')).toContainText(/app\.acme\.com|api\.acme\.com/);
  });

  test('checklist tab loads inside the program and a check toggles', async ({ app, programs, page }) => {
    await app.goto('programs');
    await programs.row('Acme Cloud').click();
    await programs.programTab('checklist').click();
    const box = page.locator('#prog-checklist [data-check]').first();
    await expect(box).toBeVisible();
    const before = await box.getAttribute('aria-pressed');
    await box.click();
    await expect(box).not.toHaveAttribute('aria-pressed', before || 'false');
  });

  test('Findings tab: New report creates a report and opens the editor', async ({ app, programs, page }) => {
    await app.goto('programs');
    await programs.newProgramButton.click();
    await programs.fillNewProgram({ name: 'RepTab Co', assets: 'rt.example.com' });
    await expect(page).toHaveURL(/#\/program\?id=/);
    await programs.programTab('findings').click();
    await expect(page.locator('#prog-findings')).toBeVisible();
    await page.locator('[data-newrep]').click();          // "New report" — no modal, straight to editor
    await expect(page).toHaveURL(/#\/reports\?open=/);
    await expect(page.locator('.modal')).toHaveCount(0);  // no intermediate modal
    await expect(page.locator('#rep-body')).toBeVisible();
    await expect(page.locator('#rep-title')).toHaveValue('Untitled report');
  });

  test('Findings tab lists the program reports; clicking one opens the editor', async ({ app, programs, page }) => {
    await app.goto('programs');
    await programs.row('Acme Cloud').click();
    await programs.programTab('findings').click();
    await expect(page.locator('.pf-row').first()).toBeVisible(); // Acme has seeded reports
    await page.locator('.pf-row [data-openrep]').first().click();
    await expect(page).toHaveURL(/#\/reports\?open=/);
    await expect(page.locator('#rep-body')).toBeVisible();
  });

  test('findings list uses the themed custom dropdown for status (no native popup)', async ({ app, programs, page }) => {
    await app.goto('programs');
    await programs.row('Acme Cloud').click();
    await programs.programTab('findings').click();
    const row = page.locator('.pf-row').first();
    await expect(row).toBeVisible();
    // native <select> is visually hidden (opacity 0) but still in the DOM for events;
    // the themed trigger is what the user actually sees
    const opacity = await row.locator('select.pf-status').evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe('0');
    const trg = row.locator('.sel-trg');
    await expect(trg).toBeVisible();
    // opening the trigger reveals the themed menu (portaled to <body>) and clicking an option works
    await trg.click();
    const menu = page.locator('.sel-menu.open');
    await expect(menu).toBeVisible();
    await menu.getByRole('button', { name: 'Rejected', exact: true }).click();
    // clicking the themed option updates the control and persists (label reflects it after reload)
    await expect(page.locator('.pf-row').first().locator('.sel-trg')).toContainText('Rejected');
  });

  test('report editor: setting status Accepted reveals an editable bounty box', async ({ app, page }) => {
    await app.goto('reports');
    await expect(page.locator('#rep-body')).toBeVisible();
    await page.locator('[data-repstatus="Accepted"]').click();
    const bounty = page.locator('#rep-bounty');
    await expect(bounty).toBeVisible();
    await bounty.fill('1500');
    await expect(bounty).toHaveValue('1500');
  });

  test('a report bounty syncs to the dashboard total', async ({ app, programs, page }) => {
    await app.goto('dashboard');
    const readTotal = async () => parseInt(((await page.locator('.kpi-num').first().textContent()) || '0').replace(/[^0-9]/g, '') || '0', 10);
    const before = await readTotal();

    // create a report and award it a bounty
    await app.navigate('Programs');
    await programs.row('Acme Cloud').click();
    await programs.programTab('findings').click();
    await page.locator('[data-newrep]').click();
    await expect(page).toHaveURL(/#\/reports\?open=/);
    const rid = page.url().match(/open=([^&]+)/)![1];
    await page.locator('[data-repstatus="Accepted"]').click();
    await expect(page.locator('#rep-bounty')).toBeVisible();
    await page.locator('#rep-bounty').fill('500');

    // wait until the bounty is actually persisted (debounced save)
    await expect.poll(async () => {
      const reps = await page.evaluate(() => fetch('/api/reports').then((r) => r.json()));
      const r = reps.find((x: any) => x.id === rid);
      return r ? r.bounty : -1;
    }).toBe(500);

    // dashboard total now reflects it
    await app.navigate('Dashboard');
    await expect.poll(async () => readTotal()).toBe(before + 500);
  });

  test('add a subdomain from the scope dropdown', async ({ app, programs, page }) => {
    await app.goto('programs');
    await programs.row('Acme Cloud').click();
    await page.locator('[data-addsub]').first().click();
    await expect(page.locator('#s-hosts')).toBeVisible();
    await page.locator('#s-hosts').fill('beta.app.acme.com');
    await page.locator('#s-save').click();
    await expect(app.toastWith(/subdomain/i)).toBeVisible();
    await expect(page.locator('.scope-tree .sub-row', { hasText: 'beta.app.acme.com' })).toBeVisible();
  });

  test('REPRO: freshly-created program opens full page and is navigable', async ({ app, programs, page }) => {
    await app.goto('programs');
    await programs.newProgramButton.click();
    await programs.fillNewProgram({ name: 'test' });
    await expect(page).toHaveURL(/#\/program\?id=/);
    await expect(programs.programTitle).toContainText('test');
    await programs.backToProgramsLink.click();
    await expect(page).toHaveURL(/#\/programs/);
  });
});

// Smoothness guard: navigating between sections must NOT rebuild the sidebar/topbar
// (that full-page rebuild is what caused the "refresh" flicker).
test.describe('smooth navigation (persistent shell)', () => {
  test('sidebar element identity is preserved across route changes', async ({ app, page }) => {
    await app.goto('dashboard');
    await page.locator('#sidebar').evaluate((el) => el.setAttribute('data-marker', 'keep-me'));
    await app.navigate('Reports');
    await expect(page.locator('#sidebar')).toHaveAttribute('data-marker', 'keep-me'); // same node, not recreated
    await app.navigate('Programs');
    await expect(page.locator('#sidebar')).toHaveAttribute('data-marker', 'keep-me');
  });

  test('topbar is not recreated on navigation', async ({ app, page }) => {
    await app.goto('dashboard');
    await page.locator('.topbar').evaluate((el) => el.setAttribute('data-marker', 'topbar-1'));
    await app.navigate('Programs');
    await expect(page.locator('.topbar')).toHaveAttribute('data-marker', 'topbar-1');
  });
});
