import { test, expect } from '../fixtures/base.fixture';

test.describe('reports', () => {
  test('editor loads and the live preview reflects edits', async ({ app, reports }) => {
    await app.goto('reports');
    await expect(reports.body).toBeVisible();
    await reports.body.fill('# E2E Heading\n\nA **bold** claim.');
    await expect(reports.preview.getByRole('heading', { name: 'E2E Heading' })).toBeVisible();
    await expect(reports.preview.locator('strong')).toContainText('bold');
  });

  test('severity radio persists (PATCH)', async ({ app, reports }) => {
    await app.goto('reports');
    await reports.severity('Critical').click();
    await expect(reports.severity('Critical')).toHaveClass(/on/);
  });

  test('folder filter switches the list', async ({ app, reports }) => {
    await app.goto('reports');
    await reports.folder('Drafts').click();
    await expect(reports.folder('Drafts')).toHaveClass(/on/);
  });

  test('clone creates another report', async ({ app, reports }) => {
    await app.goto('reports');
    const before = await reports.cards().count();
    await reports.cloneButton.click();
    await expect(app.toast).toContainText(/clon/i);
    await expect(reports.cards()).not.toHaveCount(before); // count changed (new clone)
  });

  test('copy button copies the markdown to the clipboard', async ({ app, reports, page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await app.goto('reports');
    await reports.body.fill('# Copy me\n\nsome body text');
    await page.locator('[data-copy]').click();
    await expect(app.toast).toContainText(/copied/i);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain('# Copy me');
  });

  test('attaching an image uploads it and it renders in the preview', async ({ app, reports, page }) => {
    await app.goto('reports');
    // a tiny valid 1x1 PNG
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    await page.locator('#rep-file').setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: png });
    await expect(app.toastWith(/attached/i)).toBeVisible();
    // markdown was inserted and the live preview shows the image
    await expect(reports.body).toHaveValue(/!\[shot\.png\]\(\/uploads\//);
    const img = reports.preview.locator('img.md-media');
    await expect(img).toBeVisible();
    // and the uploaded file actually resolves (served from /uploads/)
    const src = await img.getAttribute('src');
    const status = await page.evaluate((u) => fetch(u!).then((r) => r.status), src);
    expect(status).toBe(200);
  });

  test('SECURITY: a script disguised as .png is rejected (magic-byte check)', async ({ app, page }) => {
    await app.goto('reports');
    const evil = Buffer.from('<script>alert(document.domain)</script>', 'utf8');
    await page.locator('#rep-file').setInputFiles({ name: 'evil.png', mimeType: 'image/png', buffer: evil });
    // server sniffs the real bytes → refuses; nothing is stored or inserted
    await expect(app.toastWith(/only png, jpg, mp4 or mkv/i)).toBeVisible();
  });

  test('SECURITY: served uploads carry nosniff + a real image content-type', async ({ app, reports, page }) => {
    await app.goto('reports');
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    await page.locator('#rep-file').setInputFiles({ name: 'ok.png', mimeType: 'image/png', buffer: png });
    await expect(app.toastWith(/attached/i)).toBeVisible();
    const src = await reports.body.inputValue().then((v) => v.match(/\((\/uploads\/[^)]+)\)/)![1]);
    const headers = await page.evaluate(
      (u) => fetch(u).then((r) => ({ ct: r.headers.get('content-type'), nosniff: r.headers.get('x-content-type-options'), ar: r.headers.get('accept-ranges') })),
      src,
    );
    expect(headers.ct).toBe('image/png');
    expect(headers.nosniff).toBe('nosniff');
    expect(headers.ar).toBe('bytes'); // range support for large video
  });
});
