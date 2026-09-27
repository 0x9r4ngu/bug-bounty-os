import { test as base, expect, type Page } from '@playwright/test';
import { AppPage } from '../pages/app.page';
import { ProgramsPage } from '../pages/programs.page';
import { FindingsPage } from '../pages/findings.page';
import { ReportsPage } from '../pages/reports.page';
import { ChecklistPage } from '../pages/checklist.page';
import { AssetsPage } from '../pages/assets.page';

type Fixtures = {
  app: AppPage;
  programs: ProgramsPage;
  findings: FindingsPage;
  reports: ReportsPage;
  checklist: ChecklistPage;
  assets: AssetsPage;
  errorGuard: void;
};

// Benign errors we don't want to fail on: offline Google Fonts, favicon, generic
// resource-load failures. Real app bugs (uncaught exceptions, console.error from our
// code) are what we care about.
const BENIGN = /favicon|fonts\.googleapis|fonts\.gstatic|net::ERR|Failed to load resource|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED/i;

export const test = base.extend<Fixtures>({
  // Auto-fixture: every test fails if the page raised an uncaught JS error or a
  // (non-benign) console error. This is what would have caught the blank-view bug.
  errorGuard: [
    async ({ page }: { page: Page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
      page.on('console', (m) => {
        if (m.type() === 'error' && !BENIGN.test(m.text())) errors.push('console.error: ' + m.text());
      });
      await use();
      expect(errors, 'page must have no uncaught JS / console errors').toEqual([]);
    },
    { auto: true },
  ],

  app: async ({ page }, use) => { await use(new AppPage(page)); },
  programs: async ({ page }, use) => { await use(new ProgramsPage(page)); },
  findings: async ({ page }, use) => { await use(new FindingsPage(page)); },
  reports: async ({ page }, use) => { await use(new ReportsPage(page)); },
  checklist: async ({ page }, use) => { await use(new ChecklistPage(page)); },
  assets: async ({ page }, use) => { await use(new AssetsPage(page)); },
});

export { expect };
