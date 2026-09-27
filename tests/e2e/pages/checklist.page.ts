import { type Page, type Locator } from '@playwright/test';

export class ChecklistPage {
  constructor(readonly page: Page) {}

  checkboxes(): Locator {
    return this.page.locator('[data-check]');
  }

  firstCheckbox(): Locator {
    return this.checkboxes().first();
  }

  part(index: number): Locator {
    return this.page.locator(`#chk-part-${index}`);
  }

  jump(index: number): Locator {
    return this.page.locator(`[data-jump="${index}"]`);
  }

  scopeButton(): Locator {
    return this.page.locator('[data-scope-toggle]');
  }

  scopeTree(): Locator {
    return this.page.locator('.chk-scope-menu');
  }

  scopeSubs(): Locator {
    return this.page.locator('.chk-scope-menu .cst-row.sub');
  }

  activeScopeLabel(): Locator {
    return this.page.locator('.chk-scope-btn .cst-name');
  }

  panelHeading(): Locator {
    return this.page.locator('.chk-part-title').first();
  }

  ringPercent(): Locator {
    return this.page.locator('.chk-ring .ring .n');
  }
}
