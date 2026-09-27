import { type Page, type Locator } from '@playwright/test';

export class ReportsPage {
  constructor(readonly page: Page) {}

  cards(): Locator {
    return this.page.locator('[data-repopen]');
  }

  folder(name: 'All' | 'Drafts' | 'Submitted' | 'Accepted' | 'Resolved' | 'Favorites'): Locator {
    return this.page.locator(`[data-folder="${name}"]`);
  }

  get body(): Locator {
    return this.page.locator('#rep-body');
  }

  get preview(): Locator {
    return this.page.locator('#rep-prev');
  }

  get title(): Locator {
    return this.page.locator('#rep-title');
  }

  severity(sev: string): Locator {
    return this.page.locator(`[data-sev="${sev}"]`);
  }

  status(st: string): Locator {
    return this.page.locator(`[data-repstatus="${st}"]`);
  }

  get cloneButton(): Locator {
    return this.page.locator('[data-clone]');
  }
}
