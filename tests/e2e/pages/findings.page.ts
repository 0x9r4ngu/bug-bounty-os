import { type Page, type Locator } from '@playwright/test';

export class FindingsPage {
  constructor(readonly page: Page) {}

  rows(): Locator {
    return this.page.locator('[data-fopen]');
  }

  row(text: string | RegExp): Locator {
    return this.page.locator('[data-fopen]', { hasText: text });
  }

  statusTab(status: string): Locator {
    return this.page.locator(`[data-status="${status}"]`);
  }

  get detail(): Locator {
    return this.page.locator('#finding-detail');
  }

  detailTitle(): Locator {
    return this.detail.locator('h2');
  }

  statusStage(status: string): Locator {
    return this.page.locator(`[data-setstatus="${status}"]`);
  }

  get newFindingButton(): Locator {
    return this.page.getByRole('button', { name: /Log finding|New finding/ });
  }

  async fillNewFinding(fields: { title: string; severity?: string; vulnClass?: string }): Promise<void> {
    await this.page.locator('#f-title').fill(fields.title);
    if (fields.severity) await this.page.locator('#f-sev').selectOption(fields.severity);
    if (fields.vulnClass) await this.page.locator('#f-class').fill(fields.vulnClass);
    await this.page.locator('#f-save').click();
  }

  get makeReportButton(): Locator {
    return this.page.locator('[data-makereport]');
  }

  get deleteButton(): Locator {
    return this.page.locator('[data-delfinding]');
  }
}
